/* 单词怪兽乐园 — 前端（无构建，原生 JS，hash 路由） */
const $app = document.getElementById("app");
const $overlay = document.getElementById("overlay");
const $toast = document.getElementById("toast");
const AVATARS = ["🐣", "🦊", "🐼", "🐯", "🐰", "🐸", "🦄", "🐙"];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stars = (n, max = 7) => "★".repeat(n) + "☆".repeat(Math.max(0, max - n));

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 无痕模式等 */ } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};

async function api(path, body) {
  const res = await fetch("/api" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}

/* ---------- 声音 ---------- */
const audioCache = {};
function speak(word) {
  return new Promise((resolve) => {
    const a = audioCache[word] || (audioCache[word] = new Audio(`/api/tts/${encodeURIComponent(word)}`));
    a.currentTime = 0;
    a.onended = resolve;
    a.play().catch(() => {           // 后端发音失败时退回浏览器朗读
      if (!("speechSynthesis" in window)) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US"; u.rate = 0.8; u.onend = resolve;
      speechSynthesis.speak(u);
    });
  });
}
let actx;
function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [660, 990], bad: [220, 180], hatch: [523, 659, 784, 1047] }[kind];
    notes.forEach((freq, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = kind === "bad" ? "square" : "triangle";
      o.frequency.value = freq;
      const t = actx.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.25);
    });
  } catch { }
}
function toast(msg, ms = 1600) {
  $toast.textContent = msg; $toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => ($toast.hidden = true), ms);
}

/* ---------- 路由 ---------- */
let kid = null;
try { kid = JSON.parse(store.get("wm_kid") || "null"); } catch { }
const routes = { "": viewKids, home: viewHome, play: viewPlay, dex: viewDex, parent: viewParent };
async function router() {
  const name = location.hash.replace(/^#\/?/, "").split("?")[0];
  if (name && !kid) return (location.hash = "#/");
  $overlay.hidden = true;
  window.scrollTo(0, 0);
  try { await (routes[name] || viewKids)(); }
  catch (e) { $app.innerHTML = `<div class="card">出错了：${esc(e.message)} <button class="btn-soft" onclick="location.reload()">重试</button></div>`; }
}
window.addEventListener("hashchange", router);
const topbar = (title, back = "#/home") => `<div class="topbar"><a class="back" href="${back}">← 返回</a><h1>${title}</h1><span style="width:70px"></span></div>`;

/* ---------- 选小朋友 ---------- */
async function viewKids() {
  const kids = await api("/kids");
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const demo = ["apple", "cat", "star", "bus"].map((w) => `<span class="floaty" style="display:inline-block;width:70px;animation-delay:${Math.random()}s">${MonsterArt.monster(w, "", { showEmoji: false })}</span>`).join("");
  $app.innerHTML = `
    <div class="hero"><div>${demo}</div><h1>单词怪兽乐园</h1><p class="muted">每学会一个英文单词，就孵出一只专属小怪兽！</p></div>
    <div class="kids">${kids.map((k) => `<button class="card kid" data-id="${k.id}"><span class="av">${esc(k.avatar)}</span>${esc(k.name)}</button>`).join("")}</div>
    <div class="card">
      <h3 style="margin-bottom:12px">${kids.length ? "添加新的小朋友" : "先告诉我你叫什么名字吧"}</h3>
      <div class="avatars">${AVATARS.map((a) => `<button data-av="${a}" class="${a === avatar ? "on" : ""}">${a}</button>`).join("")}</div>
      <div class="add-kid" style="margin-top:12px"><input id="kname" maxlength="12" placeholder="名字，比如 豆豆"><button class="btn-soft" id="kadd">开始 →</button></div>
    </div>`;
  $app.querySelectorAll(".kid").forEach((b) => b.onclick = () => {
    kid = kids.find((k) => k.id == b.dataset.id);
    store.set("wm_kid", JSON.stringify(kid));
    location.hash = "#/home";
  });
  $app.querySelectorAll("[data-av]").forEach((b) => b.onclick = () => {
    avatar = b.dataset.av;
    $app.querySelectorAll("[data-av]").forEach((x) => x.classList.toggle("on", x === b));
  });
  const add = async () => {
    const name = document.getElementById("kname").value.trim();
    if (!name) return document.getElementById("kname").focus();
    kid = await api("/kids", { name, avatar });
    store.set("wm_kid", JSON.stringify(kid));
    location.hash = "#/home";
  };
  document.getElementById("kadd").onclick = add;
  document.getElementById("kname").onkeydown = (e) => e.key === "Enter" && add();
}

/* ---------- 首页 ---------- */
async function viewHome() {
  const [s, col] = await Promise.all([api(`/kids/${kid.id}/stats`), api(`/kids/${kid.id}/collection`)]);
  const monsters = col.items.filter((x) => x.status === "monster");
  const sleepy = monsters.filter((m) => m.sleepy);
  const eggs = col.items.filter((x) => x.status === "egg");
  const next = col.items.filter((x) => x.status === "locked").slice(0, s.new_left);
  const todo = s.due + eggs.length + next.length;
  const pics = [...sleepy.slice(0, 3).map((m) => MonsterArt.monster(m.word, m.emoji, { level: m.level, sleepy: true })),
                ...[...eggs, ...next].slice(0, 3).map((e) => MonsterArt.egg(e.word, { hits: e.egg_hits || 0 }))].join("");
  $app.innerHTML = `
    <div class="topbar"><div class="hello">${esc(kid.avatar)} 你好，${esc(kid.name)}！</div><a class="back" href="#/" onclick="localStorage.removeItem('wm_kid')">换人</a></div>
    <div class="card mission">
      <div class="pics">${pics || MonsterArt.monster("happy", "🎉", { showEmoji: true })}</div>
      <div class="grow">
        <h2>${todo ? "今日冒险" : "今天的任务全完成啦！"}</h2>
        <p>${todo ? [s.due && `${s.due} 只怪兽睡着了，快去叫醒它`, (eggs.length + next.length) && `${eggs.length + next.length} 颗蛋等你孵`].filter(Boolean).join("，") : "怪兽们吃饱睡好，明天再来吧"}</p>
      </div>
    </div>
    ${todo ? `<button class="btn-big" onclick="location.hash='#/play'">开始冒险 ▶</button>`
           : `<button class="btn-big sun" onclick="location.hash='#/play?extra=3'">再孵 3 颗蛋 🥚</button>`}
    <div class="stats">
      <div class="card stat"><b>${s.monsters}</b><span>只怪兽 / ${s.total_words}</span></div>
      <div class="card stat"><b>${s.streak}🔥</b><span>连续天数</span></div>
      <div class="card stat"><b>${s.mastered}</b><span>只已熟记 Lv.5+</span></div>
    </div>
    ${monsters.length ? `<div class="card"><h3>我的怪兽</h3><div class="shelf">${monsters.slice(-12).reverse().map((m) => MonsterArt.monster(m.word, m.emoji, { level: m.level, sleepy: m.sleepy })).join("")}</div></div>` : ""}
    <div class="home-links">
      <a class="card" href="#/dex"><span class="ic">📒</span>怪兽图鉴</a>
      <a class="card" href="#/parent"><span class="ic">👨‍👩‍👧</span>家长看板</a>
    </div>`;
}

/* ---------- 答题 ---------- */
async function viewPlay() {
  const extra = new URLSearchParams(location.hash.split("?")[1] || "").get("extra") || 0;
  const { items } = await api(`/kids/${kid.id}/session?extra=${extra}`);
  if (!items.length) {
    $app.innerHTML = `${topbar("今日冒险")}<div class="card" style="text-align:center"><h2>今天都完成啦 🎉</h2><p class="muted">怪兽们明天会醒来找你玩</p><button class="btn-big sun" onclick="location.hash='#/play?extra=3'">再孵 3 颗蛋</button></div>`;
    return;
  }
  const queue = items.map((it) => ({ ...it }));
  const total = queue.length;
  let done = 0, right = 0;
  const hatched = [], ups = [];
  const retried = new Set();
  const token = (viewPlay.token = Symbol());   // 中途离开页面时停止流程
  const alive = () => viewPlay.token === token && location.hash.startsWith("#/play");

  while (queue.length && alive()) {
    const it = queue.shift();
    if (it.intro) { await showLearn(it, done / total); if (!alive()) return; }
    const ok = await askQuestion(it, done / total);
    if (!alive()) return;
    done++;
    if (ok) right++;
    let res = null;
    try { res = await api(`/kids/${kid.id}/answer`, { word: it.word, correct: ok }); } catch (e) { toast("网络不太好，答案没存上"); }
    if (res?.event === "hatch") { hatched.push(it); await showHatch(it); }
    else if (res?.event === "levelup") { ups.push(it); toast(`⭐ ${cap(it.word)} 升到 Lv.${res.level}！`); }
    else if (res?.event === "crack") toast(`🥚 蛋壳裂开了一点（${res.egg_hits}/3）`, 1100);
    if (!ok && !retried.has(it.word)) {           // 答错的词放到最后再考一次
      retried.add(it.word);
      queue.push({ ...it, intro: false, retry: true, question: { ...it.question, options: [...it.question.options].sort(() => Math.random() - 0.5) } });
    }
  }
  if (!alive()) return;
  sfx("hatch");
  $app.innerHTML = `${topbar("冒险完成")}
    <div class="card" style="text-align:center">
      <h2>太棒啦！答对 ${right} / ${done} 题</h2>
      ${hatched.length ? `<p>新孵出 ${hatched.length} 只怪兽：</p><div class="shelf" style="justify-content:center;flex-wrap:wrap">${hatched.map((h) => MonsterArt.monster(h.word, h.emoji, { level: 1 })).join("")}</div>` : ""}
      ${ups.length ? `<p class="muted">${ups.length} 只怪兽升级了 ⭐</p>` : ""}
      <div class="row" style="margin-top:16px"><a class="btn-big grow" href="#/dex">看图鉴</a></div>
      <p><a class="muted" href="#/home">回首页</a></p>
    </div>`;
}

function playHeader(it, pct) {
  const tag = it.kind === "egg" ? `<span class="tag">🥚 孵蛋 ${it.egg_hits || 0}/3</span>` : `<span class="tag review">😴 叫醒怪兽</span>`;
  return `<div class="topbar"><a class="back" href="#/home">✕</a><div class="progress"><i style="width:${Math.round(pct * 100)}%"></i></div>${tag}</div>`;
}

function showLearn(it, pct) {
  return new Promise((resolve) => {
    $app.innerHTML = `${playHeader(it, pct)}
      <div class="card learn">
        <p class="question-title">新单词 ✨</p>
        <div class="prompt-emoji">${it.emoji}</div>
        <div class="prompt-word">${esc(it.word)} <button class="speaker small" id="say">🔊</button></div>
        <div class="zh">${esc(it.zh)}</div>
        <button class="btn-big" id="ok">我记住啦 →</button>
      </div>`;
    const say = () => speak(it.word);
    document.getElementById("say").onclick = say;
    document.getElementById("ok").onclick = resolve;
    say();
  });
}

function askQuestion(it, pct) {
  return new Promise((resolve) => {
    const q = it.question;
    let stage, title, optHTML;
    if (q.type === "listen") {
      title = "听一听，是哪一个？";
      stage = `<button class="speaker" id="say">🔊</button>`;
      optHTML = q.options.map((o) => `<button class="opt" data-w="${o.word}">${o.emoji}</button>`).join("");
    } else if (q.type === "picture") {
      title = "这个用英语怎么说？";
      stage = `<div class="prompt-emoji">${it.emoji}</div>`;
      optHTML = q.options.map((o) => `<button class="opt text" data-w="${o.word}">${esc(o.word)}<span class="say" data-say="${o.word}">🔈</span></button>`).join("");
    } else {
      title = "这个单词是哪一个？";
      stage = `<div class="prompt-word">${esc(it.word)} <button class="speaker small" id="say">🔊</button></div>`;
      optHTML = q.options.map((o) => `<button class="opt" data-w="${o.word}">${o.emoji}</button>`).join("");
    }
    $app.innerHTML = `${playHeader(it, pct)}
      <div class="stage"><p class="question-title">${title}</p>${stage}</div>
      <div class="options">${optHTML}</div>
      <div class="feedback" id="fb"></div>`;

    const sayBtn = document.getElementById("say");
    const say = async () => { sayBtn?.classList.add("playing"); await speak(it.word); sayBtn?.classList.remove("playing"); };
    if (sayBtn) sayBtn.onclick = say;
    if (q.type === "listen") setTimeout(say, 250);

    let answered = false;
    $app.querySelectorAll(".opt").forEach((b) => b.onclick = async (e) => {
      const hint = e.target.closest("[data-say]");
      if (hint) { e.stopPropagation(); return speak(hint.dataset.say); }   // 小喇叭只读音，不算作答
      if (answered) return;
      answered = true;
      const ok = b.dataset.w === q.answer;
      $app.querySelectorAll(".opt").forEach((x) => {
        x.disabled = true;
        if (x.dataset.w === q.answer) x.classList.add("right");
      });
      const fb = document.getElementById("fb");
      if (ok) {
        sfx("good");
        fb.innerHTML = `<div class="msg" style="color:var(--good)">${pick(["真棒！", "答对啦！", "Great!", "Wow!", "厉害！"])} 🎉</div>`;
        await speak(it.word);
        await sleep(350);
        resolve(true);
      } else {
        b.classList.add("wrong");
        sfx("bad");
        fb.innerHTML = `<div class="msg" style="color:var(--bad)">没关系，是 ${it.emoji} <b>${esc(it.word)}</b>（${esc(it.zh)}）</div><button class="btn-soft" id="next">知道啦，继续 →</button>`;
        speak(it.word);
        document.getElementById("next").onclick = () => resolve(false);
      }
    });
  });
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function confetti(box) {
  const bits = ["🎉", "⭐", "✨", "🎈", "💖", "🌟"];
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.textContent = pick(bits);
    s.style.left = Math.random() * 100 + "%";
    s.style.animationDelay = Math.random() * 0.5 + "s";
    box.appendChild(s);
  }
}

function showHatch(it) {
  return new Promise(async (resolve) => {
    $overlay.innerHTML = `<div class="modal hatching"><p class="muted">咦？蛋在动……</p>${MonsterArt.egg(it.word, { hits: 2 })}</div>`;
    $overlay.hidden = false;
    await sleep(1300);
    sfx("hatch");
    $overlay.innerHTML = `<div class="modal">
        <p class="muted">孵出来啦！</p>
        <div class="pop">${MonsterArt.monster(it.word, it.emoji, { level: 1 })}</div>
        <h2>${esc(cap(it.word))}</h2>
        <div class="zh">${esc(it.zh)}怪兽 · 已收入图鉴</div>
        <button class="btn-big" id="hok">太好啦！</button>
      </div>`;
    confetti($overlay.querySelector(".modal"));
    speak(it.word);
    document.getElementById("hok").onclick = () => { $overlay.hidden = true; resolve(); };
  });
}

/* ---------- 图鉴 ---------- */
async function viewDex() {
  const [col, meta] = await Promise.all([api(`/kids/${kid.id}/collection`), api("/words")]);
  let cat = "all";
  const owned = col.items.filter((x) => x.status === "monster").length;
  const render = () => {
    const list = col.items.filter((x) => cat === "all" || x.cat === cat);
    $app.innerHTML = `${topbar("怪兽图鉴")}
      <div class="dex-head"><b>已收集 ${owned} / ${col.items.length}</b><span class="muted">按时复习，怪兽会升级长皇冠 👑</span></div>
      <div class="chips"><button class="chip ${cat === "all" ? "on" : ""}" data-c="all">全部</button>${Object.entries(meta.categories).map(([k, v]) => `<button class="chip ${cat === k ? "on" : ""}" data-c="${k}">${v}</button>`).join("")}</div>
      <div class="dex">${list.map((x) => {
        if (x.status === "monster") return `<button class="slot" data-w="${x.word}">${MonsterArt.monster(x.word, x.emoji, { level: x.level, sleepy: x.sleepy })}<div class="nm">${cap(x.word)}</div><div class="lv">${stars(x.level, col.max_level)}</div></button>`;
        if (x.status === "egg") return `<div class="slot">${MonsterArt.egg(x.word, { hits: x.egg_hits })}<div class="nm">???</div><div class="sub">孵化中 ${x.egg_hits}/${col.need}</div></div>`;
        return `<div class="slot locked">${MonsterArt.egg(x.word, { locked: true })}<div class="nm">???</div><div class="sub">未发现</div></div>`;
      }).join("")}</div>`;
    $app.querySelectorAll(".chip").forEach((b) => b.onclick = () => { cat = b.dataset.c; render(); });
    $app.querySelectorAll(".slot[data-w]").forEach((b) => b.onclick = () => showMonster(col.items.find((x) => x.word === b.dataset.w), col.max_level));
  };
  render();
}

function showMonster(m, maxLevel) {
  $overlay.innerHTML = `<div class="modal">
      ${MonsterArt.monster(m.word, m.emoji, { level: m.level, sleepy: m.sleepy })}
      <h2>${esc(cap(m.word))} <button class="speaker small" id="msay">🔊</button></h2>
      <div class="zh">${esc(m.zh)} · Lv.${m.level} <span style="color:#e0a800">${stars(m.level, maxLevel)}</span></div>
      <p class="muted">${m.sleepy ? "😴 它睡着了，去冒险里复习一下叫醒它！" : `下次复习：${m.next_review}`}</p>
      <button class="btn-soft" id="mclose">关闭</button>
    </div>`;
  $overlay.hidden = false;
  speak(m.word);
  document.getElementById("msay").onclick = () => speak(m.word);
  document.getElementById("mclose").onclick = () => ($overlay.hidden = true);
}
$overlay.addEventListener("click", (e) => {   // 点遮罩 = 点弹层里的确认按钮（孵化动画中不响应）
  if (e.target !== $overlay) return;
  $overlay.querySelector("#hok, #mclose")?.click();
});

/* ---------- 家长看板 ---------- */
async function viewParent() {
  const s = await api(`/kids/${kid.id}/stats`);
  $app.innerHTML = `${topbar("家长看板")}
    <div class="stats">
      <div class="card stat"><b>${s.monsters}</b><span>已掌握单词</span></div>
      <div class="card stat"><b>${s.accuracy_7d ?? "–"}${s.accuracy_7d != null ? "%" : ""}</b><span>近 7 天正确率</span></div>
      <div class="card stat"><b>${s.active_days}</b><span>累计学习天数</span></div>
      <div class="card stat"><b>${s.due}</b><span>今天待复习</span></div>
      <div class="card stat"><b>${s.eggs}</b><span>学习中</span></div>
      <div class="card stat"><b>${s.answers_today}</b><span>今天答题数</span></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:6px">单词掌握情况</h3>
      <p class="muted" style="margin-top:0">等级越高，复习间隔越长（1→2→4→7→15→30→60 天）。Lv.5 以上基本算长期记住了。</p>
      ${s.words.length ? `<table class="ptable"><tr><th>单词</th><th>中文</th><th>等级</th><th>下次复习</th></tr>
        ${s.words.map((w) => `<tr><td>${w.emoji} <b>${esc(w.word)}</b></td><td>${esc(w.zh)}</td><td>Lv.${w.level}</td><td>${w.next_review}</td></tr>`).join("")}</table>`
        : `<p>还没有孵出怪兽，先让孩子玩一次冒险吧。</p>`}
    </div>`;
}

router();
