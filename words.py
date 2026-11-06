"""单词怪兽乐园 — 内置词库（按由易到难、由具体到抽象排列，新蛋按这个顺序孵）"""

# (英文, 中文, emoji, 分类)
_RAW = [
    # 动物
    ("cat", "猫", "🐱", "animal"), ("dog", "狗", "🐶", "animal"), ("fish", "鱼", "🐟", "animal"),
    ("bird", "鸟", "🐦", "animal"), ("duck", "鸭子", "🦆", "animal"), ("pig", "猪", "🐷", "animal"),
    ("cow", "奶牛", "🐮", "animal"), ("rabbit", "兔子", "🐰", "animal"), ("monkey", "猴子", "🐵", "animal"),
    ("tiger", "老虎", "🐯", "animal"), ("lion", "狮子", "🦁", "animal"), ("panda", "熊猫", "🐼", "animal"),
    ("elephant", "大象", "🐘", "animal"), ("horse", "马", "🐴", "animal"), ("frog", "青蛙", "🐸", "animal"),
    ("bear", "熊", "🐻", "animal"),
    # 水果
    ("apple", "苹果", "🍎", "fruit"), ("banana", "香蕉", "🍌", "fruit"), ("orange", "橙子", "🍊", "fruit"),
    ("grape", "葡萄", "🍇", "fruit"), ("pear", "梨", "🍐", "fruit"), ("peach", "桃子", "🍑", "fruit"),
    ("watermelon", "西瓜", "🍉", "fruit"), ("strawberry", "草莓", "🍓", "fruit"),
    # 食物
    ("egg", "鸡蛋", "🥚", "food"), ("milk", "牛奶", "🥛", "food"), ("bread", "面包", "🍞", "food"),
    ("rice", "米饭", "🍚", "food"), ("cake", "蛋糕", "🍰", "food"), ("candy", "糖果", "🍬", "food"),
    ("noodles", "面条", "🍜", "food"), ("pizza", "披萨", "🍕", "food"),
    # 身体
    ("eye", "眼睛", "👁️", "body"), ("ear", "耳朵", "👂", "body"), ("nose", "鼻子", "👃", "body"),
    ("mouth", "嘴巴", "👄", "body"), ("hand", "手", "✋", "body"), ("foot", "脚", "🦶", "body"),
    # 颜色
    ("red", "红色", "🔴", "color"), ("yellow", "黄色", "🟡", "color"), ("blue", "蓝色", "🔵", "color"),
    ("green", "绿色", "🟢", "color"), ("purple", "紫色", "🟣", "color"), ("black", "黑色", "⚫", "color"),
    # 家里的东西
    ("book", "书", "📖", "home"), ("bag", "书包", "🎒", "home"), ("pen", "笔", "🖊️", "home"),
    ("ball", "球", "⚽", "home"), ("bed", "床", "🛏️", "home"), ("chair", "椅子", "🪑", "home"),
    ("door", "门", "🚪", "home"), ("clock", "钟", "⏰", "home"),
    # 自然
    ("sun", "太阳", "☀️", "nature"), ("moon", "月亮", "🌙", "nature"), ("star", "星星", "⭐", "nature"),
    ("rain", "雨", "🌧️", "nature"), ("snow", "雪", "❄️", "nature"), ("tree", "树", "🌳", "nature"),
    ("flower", "花", "🌸", "nature"), ("water", "水", "💧", "nature"),
    # 交通
    ("car", "小汽车", "🚗", "vehicle"), ("bus", "公交车", "🚌", "vehicle"), ("bike", "自行车", "🚲", "vehicle"),
    ("train", "火车", "🚆", "vehicle"), ("plane", "飞机", "✈️", "vehicle"), ("boat", "船", "⛵", "vehicle"),
]

WORDS = [{"word": w, "zh": zh, "emoji": e, "cat": c} for w, zh, e, c in _RAW]
WORD_MAP = {w["word"]: w for w in WORDS}

CATEGORIES = {
    "animal": "动物", "fruit": "水果", "food": "食物", "body": "身体",
    "color": "颜色", "home": "生活用品", "nature": "大自然", "vehicle": "交通工具",
}
