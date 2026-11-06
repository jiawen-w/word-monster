"""
单词怪兽乐园 — 后端（FastAPI + SQLite）

玩法：每个英文单词是一颗蛋，答对 HATCH_NEED 次孵出专属怪兽；
孵出后进入间隔复习（艾宾浩斯式分箱），按时复习怪兽升级，过期没复习怪兽会"睡着"。

运行：.venv/bin/python 单词怪兽乐园/server.py   →  http://localhost:8750
"""

import datetime as dt
import random
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from words import CATEGORIES, WORD_MAP, WORDS

# ============ 配置 ============
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "monster.db"
TTS_DIR = DATA_DIR / "tts"
STATIC_DIR = BASE_DIR / "static"

TTS_VOICE = "en-US-AnaNeural"   # 儿童音色
TTS_RATE = "-15%"
HATCH_NEED = 3                  # 答对几次孵化
DAILY_NEW = 5                   # 每天新蛋数
REVIEW_LIMIT = 15               # 每次最多复习几只
MAX_LEVEL = 7
INTERVALS = {1: 1, 2: 2, 3: 4, 4: 7, 5: 15, 6: 30, 7: 60}   # 等级 → 下次复习间隔（天）
EGG_QTYPES = ["listen", "picture", "word"]                    # 孵蛋时题型由易到难

SCHEMA = """
CREATE TABLE IF NOT EXISTS kids(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS progress(
    kid_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,      -- 0 = 还是蛋
    egg_hits INTEGER NOT NULL DEFAULT 0,
    started_on TEXT,
    hatched_on TEXT,
    next_review TEXT,
    PRIMARY KEY(kid_id, word)
);
CREATE TABLE IF NOT EXISTS answers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    correct INTEGER NOT NULL,
    answered_on TEXT NOT NULL
);
"""


# ============ 工具函数 ============
def today() -> dt.date:
    return dt.date.today()


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    DATA_DIR.mkdir(exist_ok=True)
    TTS_DIR.mkdir(exist_ok=True)
    with db() as c:
        c.executescript(SCHEMA)


def require_kid(conn, kid_id: int):
    row = conn.execute("SELECT * FROM kids WHERE id=?", (kid_id,)).fetchone()
    if not row:
        raise HTTPException(404, "小朋友不存在")
    return row


def load_progress(conn, kid_id: int) -> dict:
    return {r["word"]: dict(r) for r in conn.execute("SELECT * FROM progress WHERE kid_id=?", (kid_id,))}


def make_question(w: dict, qtype: str) -> dict:
    """出一道四选一，干扰项优先同类（更考验辨别）"""
    same = [x for x in WORDS if x["cat"] == w["cat"] and x["word"] != w["word"]]
    other = [x for x in WORDS if x["cat"] != w["cat"]]
    distractors = random.sample(same, min(2, len(same)))
    distractors += random.sample(other, 3 - len(distractors))
    options = [w] + distractors
    random.shuffle(options)
    return {
        "type": qtype,
        "answer": w["word"],
        "options": [{"word": o["word"], "emoji": o["emoji"]} for o in options],
    }


def build_session(conn, kid_id: int, extra: int = 0) -> list:
    t = today().isoformat()
    prog = load_progress(conn, kid_id)

    reviews = sorted(
        (p for p in prog.values() if p["level"] > 0 and p["next_review"] <= t),
        key=lambda p: p["next_review"],
    )[:REVIEW_LIMIT]

    started_today = sum(1 for p in prog.values() if p["started_on"] == t)
    quota = max(0, DAILY_NEW - started_today) + extra
    eggs = [(WORD_MAP[p["word"]], HATCH_NEED - p["egg_hits"], False)
            for p in prog.values() if p["level"] == 0 and p["word"] in WORD_MAP]
    eggs += [(w, HATCH_NEED, True) for w in WORDS if w["word"] not in prog][:quota]

    # 孵蛋题按轮次穿插：A B C → A B C → ...，复习题均匀插在各轮之间
    rounds = max((need for _, need, _ in eggs), default=0)
    review_items = [{**WORD_MAP[p["word"]], "kind": "review", "level": p["level"],
                     "question": make_question(WORD_MAP[p["word"]], random.choice(EGG_QTYPES))}
                    for p in reviews if p["word"] in WORD_MAP]
    chunk = -(-len(review_items) // rounds) if rounds else len(review_items)

    items = []
    for k in range(rounds):
        for w, need, is_new in eggs:
            if k < need:
                done = HATCH_NEED - need + k
                items.append({**w, "kind": "egg", "intro": is_new and k == 0, "egg_hits": done,
                              "question": make_question(w, EGG_QTYPES[min(done, 2)])})
        items += review_items[k * chunk:(k + 1) * chunk]
    if not rounds:
        items = review_items
    return items


# ============ API ============
app = FastAPI(title="单词怪兽乐园")


class KidIn(BaseModel):
    name: str = Field(min_length=1, max_length=12)
    avatar: str = Field(default="🐣", max_length=8)


class AnswerIn(BaseModel):
    word: str
    correct: bool


@app.get("/api/words")
def api_words():
    return {"words": WORDS, "categories": CATEGORIES}


@app.get("/api/kids")
def api_kids():
    with db() as c:
        return [dict(r) for r in c.execute("SELECT id, name, avatar FROM kids ORDER BY id")]


@app.post("/api/kids")
def api_add_kid(kid: KidIn):
    with db() as c:
        cur = c.execute("INSERT INTO kids(name, avatar) VALUES(?, ?)", (kid.name.strip(), kid.avatar))
        return {"id": cur.lastrowid, "name": kid.name.strip(), "avatar": kid.avatar}


@app.get("/api/kids/{kid_id}/session")
def api_session(kid_id: int, extra: int = 0):
    with db() as c:
        require_kid(c, kid_id)
        return {"items": build_session(c, kid_id, max(0, min(extra, 10)))}


@app.post("/api/kids/{kid_id}/answer")
def api_answer(kid_id: int, ans: AnswerIn):
    if ans.word not in WORD_MAP:
        raise HTTPException(400, "未知单词")
    t = today()
    ts = t.isoformat()
    event = None
    with db() as c:
        require_kid(c, kid_id)
        c.execute("INSERT INTO answers(kid_id, word, correct, answered_on) VALUES(?,?,?,?)",
                  (kid_id, ans.word, int(ans.correct), ts))
        p = c.execute("SELECT * FROM progress WHERE kid_id=? AND word=?", (kid_id, ans.word)).fetchone()
        if not p:
            c.execute("INSERT INTO progress(kid_id, word, started_on) VALUES(?,?,?)", (kid_id, ans.word, ts))
            p = c.execute("SELECT * FROM progress WHERE kid_id=? AND word=?", (kid_id, ans.word)).fetchone()
        p = dict(p)

        if p["level"] == 0:                                   # 还是蛋：答对加裂纹，答错不惩罚
            if ans.correct:
                p["egg_hits"] += 1
                if p["egg_hits"] >= HATCH_NEED:
                    p.update(level=1, hatched_on=ts, next_review=(t + dt.timedelta(days=INTERVALS[1])).isoformat())
                    event = "hatch"
                else:
                    event = "crack"
        elif p["next_review"] <= ts:                          # 到期复习的怪兽
            if ans.correct:
                p["level"] = min(p["level"] + 1, MAX_LEVEL)
                p["next_review"] = (t + dt.timedelta(days=INTERVALS[p["level"]])).isoformat()
                event = "levelup"
            else:
                p["level"] = max(1, p["level"] - 1)           # 答错降一级，今天仍需再复习
                event = "leveldown"

        c.execute("UPDATE progress SET level=?, egg_hits=?, hatched_on=?, next_review=? WHERE kid_id=? AND word=?",
                  (p["level"], p["egg_hits"], p["hatched_on"], p["next_review"], kid_id, ans.word))
    return {"event": event, "level": p["level"], "egg_hits": p["egg_hits"]}


@app.get("/api/kids/{kid_id}/collection")
def api_collection(kid_id: int):
    ts = today().isoformat()
    with db() as c:
        require_kid(c, kid_id)
        prog = load_progress(c, kid_id)
    out = []
    for w in WORDS:
        p = prog.get(w["word"])
        if not p:
            out.append({**w, "status": "locked"})
        elif p["level"] == 0:
            out.append({**w, "status": "egg", "egg_hits": p["egg_hits"]})
        else:
            out.append({**w, "status": "monster", "level": p["level"], "hatched_on": p["hatched_on"],
                        "next_review": p["next_review"], "sleepy": p["next_review"] <= ts})
    return {"items": out, "need": HATCH_NEED, "max_level": MAX_LEVEL}


@app.get("/api/kids/{kid_id}/stats")
def api_stats(kid_id: int):
    t = today()
    ts = t.isoformat()
    with db() as c:
        kid = dict(require_kid(c, kid_id))
        prog = load_progress(c, kid_id)
        week_ago = (t - dt.timedelta(days=6)).isoformat()
        acc = c.execute("SELECT COUNT(*) n, COALESCE(SUM(correct),0) ok FROM answers WHERE kid_id=? AND answered_on>=?",
                        (kid_id, week_ago)).fetchone()
        days = {r[0] for r in c.execute("SELECT DISTINCT answered_on FROM answers WHERE kid_id=?", (kid_id,))}
        today_n = c.execute("SELECT COUNT(*) FROM answers WHERE kid_id=? AND answered_on=?", (kid_id, ts)).fetchone()[0]

    streak, d = 0, t if ts in days else t - dt.timedelta(days=1)
    while d.isoformat() in days:
        streak += 1
        d -= dt.timedelta(days=1)

    monsters = [p for p in prog.values() if p["level"] > 0]
    started_today = sum(1 for p in prog.values() if p["started_on"] == ts)
    return {
        "kid": kid,
        "total_words": len(WORDS),
        "monsters": len(monsters),
        "eggs": sum(1 for p in prog.values() if p["level"] == 0),
        "due": sum(1 for p in monsters if p["next_review"] <= ts),
        "new_left": max(0, DAILY_NEW - started_today),
        "accuracy_7d": round(acc["ok"] / acc["n"] * 100) if acc["n"] else None,
        "answers_today": today_n,
        "active_days": len(days),
        "streak": streak,
        "mastered": sum(1 for p in monsters if p["level"] >= 5),
        "words": sorted(
            [{**WORD_MAP[p["word"]], "level": p["level"], "next_review": p["next_review"]}
             for p in monsters if p["word"] in WORD_MAP],
            key=lambda x: x["next_review"]),
    }


@app.get("/api/tts/{word}")
async def api_tts(word: str):
    """只给词库里的词发音（防止公网滥用），首次生成后缓存 mp3"""
    word = word.lower().strip()
    if word not in WORD_MAP:
        raise HTTPException(404, "不在词库中")
    path = TTS_DIR / f"{word.replace(' ', '_')}.mp3"
    if not path.exists():
        import edge_tts
        await edge_tts.Communicate(word, TTS_VOICE, rate=TTS_RATE).save(str(path))
    return FileResponse(path, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=2592000"})


# 静态前端放最后挂载，避免吃掉 /api 路由
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


# ============ 主流程 ============
def run(host: str = "127.0.0.1", port: int = 8750):
    import uvicorn
    init_db()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="单词怪兽乐园")
    ap.add_argument("--host", default="127.0.0.1", help="局域网访问用 0.0.0.0")
    ap.add_argument("--port", type=int, default=8750)
    args = ap.parse_args()
    run(args.host, args.port)
