import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDatabasePath = process.platform === "win32"
    ? path.join(projectRoot, "data", "albums", "catkinsblog.sqlite")
    : "/var/lib/catkinsblog/catkinsblog.sqlite";
const databasePath = path.resolve(process.env.BLOG_DB_FILE || defaultDatabasePath);
const imageRoot = "/archives/bingxi";
const cover = "/covers/bingxi-cover.jpg";

const imageFiles = {
    31: "微信图片_20260712131231_375_31.jpg",
    32: "微信图片_20260712131232_376_31.jpg",
    33: "微信图片_20260712131233_377_31.jpg",
    34: "微信图片_20260712131234_378_31.jpg",
    35: "微信图片_20260712131235_379_31.jpg",
    36: "微信图片_20260712131236_380_31.jpg",
    37: "微信图片_20260712131237_381_31.jpg",
    38: "微信图片_20260712131238_382_31.jpg",
    39: "微信图片_20260712131239_383_31.jpg",
    40: "微信图片_20260712131240_384_31.jpg",
    41: "微信图片_20260712131241_385_31.jpg",
    42: "微信图片_20260712131242_387_31.jpg",
    43: "微信图片_20260712131243_388_31.jpg",
    44: "微信图片_20260712131244_389_31.jpg",
    45: "微信图片_20260712131245_390_31.jpg",
    46: "微信图片_20260712131246_391_31.jpg",
    47: "微信图片_20260712131247_392_31.jpg",
    48: "微信图片_20260712131248_393_31.jpg",
    49: "微信图片_20260712131249_394_31.jpg",
    50: "微信图片_20260712131250_395_31.jpg",
    51: "微信图片_20260712131251_396_31.jpg",
    52: "微信图片_20260712131252_397_31.jpg",
    53: "微信图片_20260712131253_398_31.jpg",
    54: "微信图片_20260712131254_399_31.jpg",
    55: "微信图片_20260712131255_400_31.jpg",
    57: "微信图片_20260712131257_401_31.jpg",
    58: "微信图片_20260712131258_402_31.jpg",
    59: "微信图片_20260712131259_403_31.jpg",
    60: "微信图片_20260712131300_404_31.jpg",
};

function image(number, alt = "原始笔记页") {
    return `![${alt}](${imageRoot}/${encodeURIComponent(imageFiles[number])})`;
}

function originals(numbers) {
    return ["", "## 原图", ...numbers.map((number) => image(number))].join("\n\n");
}

function article({ slug, title, pubDate, description, body, images, tags = [] }) {
    return {
        slug,
        title: `【病隙碎笔】${title}`,
        pubDate,
        description,
        author: "willow_Catkin",
        category: "病隙碎笔",
        imageUrl: cover,
        imageAlt: "病隙碎笔记录-1原图",
        tags: ["病隙碎笔", ...tags],
        featured: false,
        draft: false,
        body: `${body.trim()}\n${originals(images)}`,
    };
}

const articles = [
    article({
        slug: "bingxi-record-1",
        title: "记录-1",
        pubDate: "2026-04-01",
        description: "从睡梦、考试、朋友和零散古文中留下的早期生活记录。",
        tags: ["生活记录"],
        images: [31],
        body: `## 乐的一些杂想\n\n我们的一次睡觉都不如强迫自己醒来。假设我在睡梦中舒适地睡着，那不会给自己造成伤害。因此，珍惜每一次睡眠。\n\n## 小记（2026-1-29）\n\n关于 Catkin、小试题和考试时的零散想法，原页还保留了数字、批注及倒置文字。\n\n## 朋友\n\n“我的技术成绩多了前来的传统同学，每次我也控题不会的时候都会向他询问。他都会拿出他的手机帮我查询，时不时还用电脑帮我跑程序。尤其是考试的时候，他都在厕所里帮我传递纸条。”\n\n这是一页混合了生活片段、考试记录和手写材料的笔记，难以拆分的部分保留原图。`,
    }),
    article({
        slug: "bingxi-hrh-notes",
        title: "HRH失误与训练小记",
        pubDate: "2026-03-11",
        description: "记录 HRH 相关游戏、失误复盘、训练结果和几段临场分析。",
        tags: ["HRH", "游戏记录"],
        images: [32, 35],
        body: `## HRH 说他要成为球痴\n\n页面记录了 2 月至 3 月间的几次失败、打球和训练结果，也留下了“完成作业率小于 40% 以及正在做”的纸条。\n\n## 临场分析\n\n另一页以题目形式分析开局前的选项：从材料中判断谁能及时干扰、谁适合封锁，以及不同选择会对后续造成什么影响。原笔记同时夹有纸条、书法和短句，按原貌保留。`,
    }),
    article({
        slug: "bingxi-xia-yishi",
        title: "下意识与三月趣事",
        pubDate: "2026-03-13",
        description: "一段关于记忆、身体感受和日常趣事的随笔，夹杂校园生活片段。",
        tags: ["随笔", "校园"],
        images: [33, 34],
        body: `## 下意识\n\n他们说，下意识这个词，就是我。\n\n我在回到教室以后，看见黑板旁的格子仍有初冬的白风。下一秒，胸口像被热浪击中。意识到一切的终生，我正在低下头，努力让自己的情绪从眼前退开。\n\n我感到有一股强烈的、无法阻止的冲动，时间的线条在身体里旋转。我捧起了这个世界的手，也许它也捧起了我。\n\n## 记 3/13 趣事\n\n校园播放安全教育视频，King of Swallow 因为教室人数不全而不能生气；晚自习、点名、同学之间的玩笑和最近的大风天气，也被写在这一页。\n\n页面另一侧是“科研角”的数学推导，内容按原图一并保存。`,
    }),
    article({
        slug: "bingxi-keji-jishu",
        title: "技术价值与序",
        pubDate: "2026-04-01",
        description: "把技术的价值、性质、原则与个人记忆放在一起思考的笔记。",
        tags: ["技术", "随笔"],
        images: [36],
        body: `## 通用技术知识强化\n\n笔记以表格整理技术的价值、性质和原则：\n\n- 保护人：匪之保护周围，起头开\n- 解放人：自瞄、一键连锁 cfg\n- 发展人：打 BOT、AWP、[不可辨认的批注]\n- 目的性：这把打 B\n- 实践性：删除 B 隔墙（原笔记如此记录）\n- 综合性：软件虫\n- 创新性：fake\n\n后半页写给“Catkin”，讨论深夜、记忆、朋友与时间如何把人带回过去。部分句子和纸条难以可靠转录，保留原图。`,
    }),
    article({
        slug: "bingxi-cs2-tactics",
        title: "CS2基础题与战术笔记",
        pubDate: "2026-03-01",
        description: "合并整理笔记中的 CS2 基础题、地图理解、道具、阵容和战术执行方案。",
        tags: ["CS2", "战术"],
        images: [35, 38, 39, 40, 41, 42, 43, 44],
        body: `## 基础题与理论选择\n\n笔记从“CS2 的中文全称”、地图名称、武器类型、阵营、道具消耗和 CT 防守题开始，使用选择题形式复习基础知识。\n\n## 地图与道具\n\n内容涉及 VIP、A 区、B 区、中路、Jungle、下水道、警察出生点，以及烟雾、闪光、燃烧瓶和诱饵等道具的配合。页面中还记录了根据队友位置选择假打、转点、封锁或反清的思路。\n\n## 阵容与执行\n\n笔记整理了多套开局分配：\n\n- 人员按 A、B、VIP 和 Jungle 分配，先手负责道具和探点。\n- 通过烟雾、闪光和燃烧瓶制造进点窗口。\n- 分阶段执行：第一阶段控图，第二阶段补烟或转点，第三阶段处理残局。\n- ECO 回合记录了低经济下的赌点、短枪和双人协同方案。\n\n原稿中的地图草图、道具落点和部分缩写无法完全转换为 Markdown，全部附在文末。`,
    }),
    article({
        slug: "bingxi-mie-shijie-jihua",
        title: "毁灭世界计划",
        pubDate: "2026-04-01",
        description: "一份以游戏道具和朋友互动为素材写下的荒诞计划清单。",
        tags: ["计划", "游戏"],
        images: [45],
        body: `## 毁灭世界计划\n\n1. 在前桌下学放 C4。\n2. 在左桌下放土豆地雷。\n3. 走廊放洋装钢并与 2、4、6 三碟基甲本连接。\n4. C 死 HRH。\n5. 内格夫给 Catk 洗头。\n6. C 死 Catk。\n7. 在前桌右安放地刺、毁灭菇、樱桃炸弹、火焰树桩、小推车。\n8. 对上 HRH 的嘴两次。\n9. 逼前桌代写语文作业。\n\n原页面另一侧是重复抄写的句子和一张便签，保留原图。`,
    }),
    article({
        slug: "bingxi-xu-2026-11-29",
        title: "病隙碎笔·序",
        pubDate: "2026-11-29",
        description: "从病中、记忆、朋友和时间出发，解释为什么要留下这本病隙碎笔。",
        tags: ["序", "记忆"],
        images: [46],
        body: `## 病隙碎笔·序\n\n2026/11/29，猫王（Catkin）沉迷导致大脑陷入脑瘫状态。我觉得假性怪病、病魔狂，符合高二的精神状态，便把这段记录下来。猫王同意了，赞助了一本笔记。\n\n“忆往昔，繁华尽逐。”\n\n我曾思考过中国或者教育给我们带来的是什么。当海中的学习重担压倒我们，磨掉性格与认知，我惹上了一种名为“学”的病。当科举与考试成为生活日常，当歌于发声的人们在背后的指点下不断想起感恩教育，无意间看到一个词的英文翻译“Rat race”——内卷，可怜而又可悲啊。为了学习而卷，为了生活而卷，为了生存而卷。\n\n多年后，朋友们各奔东西，中国的友谊在时间和地理距离的冲刷下能否留得不朽？这本本子或许会成为一枚记录、一枚时间胶囊，成为青春的回忆。\n\n“柳絮因风起，风止意难平。”\n\n后半页继续写到时间、记忆和未来：如果物质以超越光速运动，我们能否看到过去的自己？记忆中的青春往往带着遗憾，而遗憾也是一次蜕变。\n\n“活在当下。”`,
    }),
    article({
        slug: "bingxi-hai-gui-tang",
        title: "海龟汤",
        pubDate: "2026-04-01",
        description: "记录一则以孤儿院、相遇和误会为线索的海龟汤故事，以及相关草稿。",
        tags: ["故事", "海龟汤"],
        images: [47, 48],
        body: `## 海龟汤 I：孤儿院\n\n1. 我和 Ta 从孤儿院出来。\n2. 我爱上了 Ta。\n3. 我终于得到了 Ta。\n4. “正如你深受着我一样，我也深受着你呀。”\n5. 一天 Ta 从外边回来，身上有一股焦味，但我仍深爱着 Ta。\n6. 有一天我去外面办事。\n7. “Ta 怎么会在这里？”\n8. “你怎么能这样！”\n9. Ta 吞笑了一下。\n10. “正如你深爱着我一样，我也深爱着你呀。”\n\n这组对白的完整谜底没有在图片中明确写出，故保留原始页面，不擅自补全。另一页同时有数学草稿和续写片段，也一并附上。`,
    }),
    article({
        slug: "bingxi-mao-wang-zuopin",
        title: "猫王作品集",
        pubDate: "2026-04-09",
        description: "收录猫王作品集中的手绘、文字排列、表情和零散图画。",
        tags: ["图画", "作品集"],
        images: [49, 50],
        body: `这一篇以图像为主，收录“猫王作品集”标题页、人物速写、文字排列、表情和小型漫画。图画、书写实验和贴纸不适合改写为 Markdown，因此只保留必要的说明并展示原图。`,
    }),
    article({
        slug: "bingxi-qisi-miaoxiang",
        title: "奇思妙想",
        pubDate: "2026-04-28",
        description: "关于椭圆、双曲线、空间投影和机械结构的小型数学与设计构想。",
        tags: ["数学", "设计"],
        images: [51, 52, 55],
        body: `## 奇思妙想 I：椭圆工具\n\n尝试设计一把能画椭圆的尺子或工具：通过固定点、滑动结构和连杆约束，让笔尖的轨迹满足椭圆定义。笔记还尝试用参数方程\n\n$$x=a\\cos\\theta,\\qquad y=b\\sin\\theta$$\n\n描述轨迹，并讨论如何依据定义调整焦点和离心率。\n\n## 奇思妙想 II：混沌推栈\n\n假设桌面上堆了一摞书，思考如何从混乱中找到目标书，再把它放到栈顶。\n\n## 奇思妙想 III：空间投影\n\n对同一个正方体尝试用不同的画法表达，比较斜二测画法与正等轴测法，并思考怎样通过平面与滑轨结构制造可运动的投影。\n\n## 奇思妙想 IV：双曲线工具\n\n继续讨论双曲线的定义、线性斜率关系和机械结构实现。公式推导和草图较多，无法完全转成电子稿，原图全部附后。`,
    }),
    article({
        slug: "bingxi-houpai-wangshi",
        title: "后排往事",
        pubDate: "2026-04-28",
        description: "以课堂后排为背景的五日片段，记录对话、玩笑和观察。",
        tags: ["校园", "片段"],
        images: [52, 53],
        body: `## 说明\n\n原稿主要视角为 HRH，部分人物已经多处处理。\n\n### Day I：本尼迪特\n\n围绕“six、生物书里用来检验微算棉的试剂”和美国总统名字的文字游戏。\n\n### Day II：排球（改）\n\n“我问：小余吃，你为什么学排球？”\n\n“山乞：广播网。”\n\n“我问：那如果没有鱼呢？”\n\n“山乞：那说明我不适合打排球。”\n\n### Day III：江南可采莲（改）\n\n关于拍照、专业相机和手机的争论，最后落到“这倒提醒我了”。\n\n### Day IV-V\n\n记录课堂迟到、叫醒同学、闲聊和“人脸识别注册成功”等片段。原文有大量对话和无法确定的专名，按规则保留原图。`,
    }),
    article({
        slug: "bingxi-keyan-jiao",
        title: "科研角与算法草稿",
        pubDate: "2026-04-01",
        description: "整理概率、排列组合、C++流程和游戏机制分析等学习草稿。",
        tags: ["数学", "算法"],
        images: [34, 54],
        body: `## 概率题\n\n以五个出生胎位为例，记录队伍中出现快枪数量的概率：\n\n$$P(X=k)=\\frac{A_5^k A_{10-m}^{5-k}}{A_{10}^5}$$\n\n并进一步讨论“至少有一颗快枪”的事件。原稿还列出了 m 从 0 到 5 时的结果。\n\n## 算法与流程\n\n另一页是 C++/算法流程图和“刺蜘蛛刀入门路线”，将问题拆成若干判断、循环和输出步骤。流程图中的文字和箭头关系难以完整转录，保留原图。\n\n## 科研角 II\n\n页面还讨论荒漠迷城下方 VIP 快枪理论概率，并以组合数表达不同出生位的概率。`,
    }),
    article({
        slug: "bingxi-moyu-xianyansuoyu",
        title: "摸鱼一笑与闲言碎语",
        pubDate: "2026-04-01",
        description: "零散的游戏联想、语言游戏、诗句和对日常的短暂观察。",
        tags: ["零散记录", "诗歌"],
        images: [57],
        body: `## 摸鱼一笑\n\n- CI：打一勾古文。\n- CII：儿子是儒家的敌人，那么儿子是“巨儒”呢？\n- CIII：HRH 的称号是 policeman，梗是条枪。\n\n## 闲言碎语\n\n轻轻的我走了，正如我轻轻地来。\n\n我好像做了个很久的梦，因为记不清了，剩下的只有醒来的怅然和没能构成的感动。正如窗外早已燃而山的梦，我在整理脱逸记忆，也不访问星星。\n\n其余内容以短诗、字词排列和小图画为主，使用原图保存。`,
    }),
    article({
        slug: "bingxi-hrh-zuopin-2",
        title: "HRH作品集 II",
        pubDate: "2026-04-01",
        description: "一封写给 HRH 的信，以及夹在页面中的书法和作品。",
        tags: ["书信", "书法"],
        images: [58],
        body: `## 给 HRH 的信\n\n“兄弟，最近过得怎么样？听说前不久你作为 OH SHIT 队员的 IGL 带领队伍在上海 Major 里 3:0 夺冠。其实你在信息轰炸、工费杯和精英眼里被技术的时候，我就知道 Donk 强了不久了。我也要告诉你一个好消息，再过几天，我就可以上网游了。希望你能来我们比赛！”\n\n页面右侧为“HRH作品集 II”，主体是书法和手写作品，按要求直接展示原图。`,
    }),
    article({
        slug: "bingxi-bingren-riji",
        title: "病人日记与无题",
        pubDate: "2026-04-01",
        description: "关于病中感受、数学函数和一些无法归类的拼贴文字。",
        tags: ["日记", "数学"],
        images: [59],
        body: `## 病人日记\n\n- 认真的样子真帅\n- 反对\n- 双曲线和她的渐进线真是一对苦命鸳鸯\n\n页面下方继续推导函数、三角函数和曲线的性质，旁边有一张图示。\n\n## 无题\n\n这一页围绕“什么样最猛烈的性向才能配得上今年的黄花青鸟呢？”展开，混合了图片、书名、人物和零散词语。内容无法可靠归纳，摘要保留为原页展示。`,
    }),
    article({
        slug: "bingxi-wuti-xinliantixin",
        title: "无题与有前信念题",
        pubDate: "2026-04-01",
        description: "一页零散的毕业与告别文字，以及一组概率、复数、数列和集合题。",
        tags: ["学习", "告别"],
        images: [60],
        body: `## 无题 II\n\n“世人皆可止步于此，殊不知时间也追的笑，歪而不安，泪出不尽，很能梦到终。”\n\n页面左侧还写有告别、毕业、CS、朋友和“我们遥远的相依”等零散词语。\n\n## 有前信念题\n\n右侧是五道选择题，涉及事件概率、复数方程、样本数据、集合包含关系和三角形恒等式。题目保留原样，图片中部分符号和选项已按可辨认内容转录，其余请以原图为准。`,
    }),
];

mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        slug TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        pub_date TEXT NOT NULL,
        description TEXT NOT NULL,
        author TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '未分类',
        image_url TEXT NOT NULL DEFAULT '',
        image_alt TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        featured INTEGER NOT NULL DEFAULT 0,
        draft INTEGER NOT NULL DEFAULT 0,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blog_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        nickname_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (post_slug, nickname_key)
    );
    CREATE TABLE IF NOT EXISTS post_comments (
        id INTEGER PRIMARY KEY,
        post_slug TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
`);

const now = new Date().toISOString();
const upsert = db.prepare(`
    INSERT INTO posts (
        slug, title, pub_date, description, author, category,
        image_url, image_alt, tags_json, featured, draft, body,
        created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        pub_date = excluded.pub_date,
        description = excluded.description,
        author = excluded.author,
        category = excluded.category,
        image_url = excluded.image_url,
        image_alt = excluded.image_alt,
        tags_json = excluded.tags_json,
        featured = excluded.featured,
        draft = excluded.draft,
        body = excluded.body,
        updated_at = excluded.updated_at
`);

db.exec("BEGIN IMMEDIATE");
try {
    for (const post of articles) {
        upsert.run(
            post.slug,
            post.title,
            post.pubDate,
            post.description,
            post.author,
            post.category,
            post.imageUrl,
            post.imageAlt,
            JSON.stringify([...new Set(post.tags)]),
            post.featured ? 1 : 0,
            post.draft ? 1 : 0,
            post.body,
            now,
            now,
        );
    }
    db.prepare(`
        UPDATE posts
        SET image_url = ?, image_alt = ?, updated_at = ?
        WHERE category = ?
    `).run(cover, "病隙碎笔文章封面", now, "病隙碎笔");
    db.exec("COMMIT");
} catch (error) {
    db.exec("ROLLBACK");
    throw error;
}

console.log(`已导入 ${articles.length} 篇“病隙碎笔”文章`);
console.log(`数据库：${databasePath}`);
