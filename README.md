# 🥚 单词怪兽乐园 Word Monster

给小学低年级孩子的英语单词学习网站：**每学会一个单词，就孵出一只专属小怪兽**。

- 每个单词是一颗蛋，答对 3 次孵化，怪兽收进图鉴
- 孵出后按间隔复习（1 → 2 → 4 → 7 → 15 → 30 → 60 天），按时复习怪兽升级、长皇冠；该复习时怪兽会"睡着"
- 三种题型由易到难：听音选图 → 看图选词 → 看词选图，答错的词本轮末尾再考一次
- 发音用 Edge-TTS 儿童音色（`en-US-AnaNeural`），首次生成后缓存
- 怪兽由单词哈希生成 SVG，同一个词永远是同一只，不需要任何出图 API
- 支持多个孩子分别建档，附家长看板（掌握数、正确率、连续天数、复习计划）
- 内置 66 个低年级常用词，分 8 类；**零 API key**

## 运行

```bash
pip install -r requirements.txt
python server.py            # 打开 http://localhost:8750
python server.py --host 0.0.0.0   # 局域网内手机/平板也能访问
```

数据存在 `data/monster.db`（SQLite），发音缓存在 `data/tts/`。

## 技术栈

| 部分 | 实现 |
|---|---|
| 后端 | FastAPI + SQLite（[server.py](server.py)） |
| 词库 | [words.py](words.py)，加词只需加一行 `(英文, 中文, emoji, 分类)` |
| 前端 | 原生 HTML/CSS/JS，无构建步骤（[static/](static/)） |
| 怪兽生成 | [static/monster.js](static/monster.js) |
| 发音 | edge-tts，失败时退回浏览器 speechSynthesis |

## 可调参数（server.py 顶部）

| 常量 | 默认 | 含义 |
|---|---|---|
| `HATCH_NEED` | 3 | 答对几次孵化 |
| `DAILY_NEW` | 5 | 每天新蛋数 |
| `REVIEW_LIMIT` | 15 | 每轮最多复习几只 |
| `INTERVALS` | 1/2/4/7/15/30/60 | 各等级复习间隔（天） |
| `TTS_VOICE` | en-US-AnaNeural | 发音音色 |

## ⚠️ 部署到公网前

目前**没有登录/权限**：任何能打开网址的人都能看到、操作所有孩子的进度。适合家里或局域网使用；放到公网前建议至少加一层访问码或账号体系。

## License

MIT
