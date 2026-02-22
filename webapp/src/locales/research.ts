import type { HomeLang } from "./home";

export interface ResearchStrings {
  title: string;
  summaryP1: string;
  summaryP2: string;
  summaryP3: string;
  sectionSpacing: string;
  summaryP4: string;
  summaryP5: string;
  sectionForgetting: string;
  summaryP6: string;
  summaryP7: string;
  sectionAlgorithms: string;
  summaryP8: string;
  summaryP9: string;
  sectionPractice: string;
  summaryP10: string;
  summaryP11: string;
  readFullReport: string;
  backToHome: string;
}

export const researchStrings: Record<HomeLang, ResearchStrings> = {
  en: {
    title: "Spaced repetition: a summary",
    summaryP1:
      "Spaced Repetition System (SRS) is the practice of reviewing material at increasing intervals. Instead of seeing the same item every day or cramming before a test, you review each item when it is due — and that interval grows longer each time you remember it. Decades of research show that spacing reviews over time leads to much better long-term retention than massed practice or cramming.",
    summaryP2:
      "The idea is simple: if you see something too soon, you waste time; if you see it too late, you have already forgotten and must relearn it. Spaced repetition aims for the sweet spot — review just when you are about to forget — so that each review strengthens memory without unnecessary repetition.",
    summaryP3:
      "This summary draws on the report from Yudame Research’s podcast episode on spaced repetition (Algorithms for Life, Ep. 1). Below we outline the main concepts and why they matter for learning.",
    sectionSpacing: "The spacing effect",
    summaryP4:
      "The spacing effect is one of the most replicated findings in cognitive psychology: if you study the same material in two sessions, you remember more when those sessions are separated in time than when they are back-to-back. Hermann Ebbinghaus demonstrated this in the 1880s using nonsense syllables; later researchers have confirmed it for vocabulary, facts, and skills across many domains.",
    summaryP5:
      "Why does spacing work? One leading explanation is that each time you successfully recall something after a delay, you strengthen the long-term trace. Forgetting a little (but not completely) before reviewing seems to make the memory more durable. Cramming, by contrast, produces strong short-term memory that fades quickly.",
    sectionForgetting: "The forgetting curve",
    summaryP6:
      "Ebbinghaus also described the forgetting curve: after learning, retention drops quickly at first and then levels off. Without review, most of what we “learn” in a single session is lost within days. The curve is not fixed — it changes with the strength of the memory and how we encode the material.",
    summaryP7:
      "Spaced repetition uses this curve. By reviewing at or just before the point where you would forget, you extend the interval each time. Easy items move to longer intervals (days, weeks, months); hard items stay on shorter intervals until they stabilize. The result is that you spend most of your time on items that actually need review, not on ones you already know well.",
    sectionAlgorithms: "How SRS algorithms work",
    summaryP8:
      "Manual spacing is possible but hard to manage at scale. Algorithms like SM-2 (used in Anki and many other tools) automate the decision: after each review, they compute the next interval based on how well you recalled the item. If you remembered easily, the interval increases; if you struggled or failed, the interval shortens or resets. The exact formula varies, but the principle is the same: use your performance to schedule the next review.",
    summaryP9:
      "Retentio follows this approach. Each card has a due date; when you review it, the system updates the interval and the next due date. You do not choose when to see each card — the algorithm does. That way you can focus on answering and let the system handle the scheduling.",
    sectionPractice: "Why it matters in practice",
    summaryP10:
      "Spaced repetition is not a trick; it is a way of aligning study with how memory actually works. It reduces total study time because you stop over-reviewing material you already know and focus on what is slipping. It also reduces stress: instead of last-minute cramming, you do a steady amount of review each day, and the system keeps track of what is due.",
    summaryP11:
      "Whether you are learning a language, preparing for exams, or building a knowledge base of facts and concepts, spacing your reviews makes the effort more efficient and the results longer-lasting. For a deeper dive and more detail, see the full report linked below.",
    readFullReport: "Read the full report",
    backToHome: "Back to home",
  },
  zh: {
    title: "间隔重复：概要",
    summaryP1:
      "间隔重复系统（SRS）是指在逐渐拉长的间隔下复习同一内容的方法。你不是每天重复同一项内容，也不是考前突击，而是在每一项「到期」时复习它——每次成功回忆后，下次间隔会变长。大量研究表明，把复习分散在时间里，比集中练习或临时抱佛脚更能形成长期记忆。",
    summaryP2:
      "道理很简单：复习得太早是在浪费时间；复习得太晚，已经忘了，又得重新学。间隔重复追求的是「快要忘还没忘」的那个点——在这个时机复习，既能巩固记忆，又不会做太多无效重复。",
    summaryP3:
      "本概要参考了 Yudame Research 播客中关于间隔重复的一期节目（Algorithms for Life 第 1 集）的报告。下面简要梳理其中的主要概念及其对学习的意义。",
    sectionSpacing: "间隔效应",
    summaryP4:
      "间隔效应是认知心理学中最稳定的发现之一：同样的内容学两遍，把两遍学习在时间上拉开，比连续学两遍记得更牢。艾宾浩斯在 19 世纪 80 年代用无意义音节证明了这一点；后来的研究在词汇、事实、技能等多种材料上都得到了类似结果。",
    summaryP5:
      "为什么间隔有效？一种主流解释是：在间隔一段时间后成功回忆，会强化长期记忆痕迹。在「忘了一点但还没全忘」的时候复习，似乎能让记忆更稳固。相比之下，突击式学习只能形成强烈的短期记忆，很快就会消退。",
    sectionForgetting: "遗忘曲线",
    summaryP6:
      "艾宾浩斯还描述了遗忘曲线：学习之后，保持量先快速下降，然后趋于平缓。不复习的话，单次学习的内容大多在几天内就会丢失。这条曲线不是固定的——它会随记忆强度和编码方式变化。",
    summaryP7:
      "间隔重复正是利用这条曲线。在即将遗忘或刚过遗忘点的时候复习，每次复习后把间隔拉长。容易的项目会逐渐变成几天、几周、几个月；难的项目先保持较短间隔，直到稳定后再拉长。这样你可以把大部分时间花在真正需要复习的内容上，而不是已经掌握的内容。",
    sectionAlgorithms: "SRS 算法如何工作",
    summaryP8:
      "理论上可以手动安排间隔，但项目一多就难以管理。像 SM-2（Anki 等工具使用的算法）这类算法可以自动决定：每次复习后，根据你的回忆表现计算下一次复习间隔。记得轻松就拉长间隔；记得吃力或忘记就缩短或重置间隔。具体公式各有不同，但思路一致：用你的表现来安排下次复习。",
    summaryP9:
      "Retentio 采用同样的思路。每张卡片都有一个到期日；你复习后，系统会更新间隔和下一次到期日。你不需要自己决定何时复习哪张卡——由算法来排程，你只需专注作答。",
    sectionPractice: "实践中的意义",
    summaryP10:
      "间隔重复不是窍门，而是让学习方式符合记忆规律。它能减少总学习时间，因为你不再对已经掌握的内容过度复习，而是把精力放在正在遗忘的内容上。同时也能减轻压力：不用考前突击，每天做一定量的复习，由系统帮你记住什么该复习了。",
    summaryP11:
      "无论你在学语言、备考，还是在积累事实与概念，把复习间隔化都能让努力更高效、结果更持久。若想了解更完整的论述与细节，请参阅下方完整报告链接。",
    readFullReport: "阅读完整报告",
    backToHome: "返回首页",
  },
  ja: {
    title: "間隔反復：概要",
    summaryP1:
      "間隔反復システム（SRS）とは、復習の間隔を徐々に延ばしていく学習法です。毎日同じ項目を見るのではなく、試験前に詰め込むのでもなく、各項目が「到期」になったときに復習します。成功して思い出せば、次回の間隔は長くなります。数十年の研究で、復習を時間的に分散すると、集中学習や詰め込みより長期記憶がはるかに良くなることが示されています。",
    summaryP2:
      "考え方はシンプルです：早すぎると時間の無駄、遅すぎると忘れた後で学び直しになります。間隔反復は「忘れかけた頃」に復習することを目指し、不要な反復を減らしながら記憶を強化します。",
    summaryP3:
      "本概要は、Yudame Researchのポッドキャスト「間隔反復」回（Algorithms for Life 第1話）のレポートに基づきます。以下に主要な概念と学習における意義をまとめます。",
    sectionSpacing: "間隔効果",
    summaryP4:
      "間隔効果は認知心理学で最も再現性の高い知見の一つです：同じ教材を2回学ぶとき、連続で学ぶより、時間を空けて学んだ方が記憶に残ります。ヘルマン・エビングハウスが1880年代に無意味音節で示し、その後の研究で語彙、事実、スキルなど多様な領域で確認されています。",
    summaryP5:
      "なぜ間隔が効くのか。有力な説明の一つは、時間を空けてから思い出すと、長期記憶の痕跡が強化されることです。「少し忘れたがまだ完全には忘れていない」ときの復習が、記憶をより持続させると考えられています。詰め込みは、強い短期記憶を作るがすぐに衰えます。",
    sectionForgetting: "忘却曲線",
    summaryP6:
      "エビングハウスは忘却曲線も示しました：学習後、保持量は最初は急速に低下し、やがて横ばいになります。復習しなければ、1回のセッションで「学んだ」ことの多くは数日で失われます。曲線は固定ではなく、記憶の強さや符号化の仕方で変わります。",
    summaryP7:
      "間隔反復はこの曲線を利用します。忘れる直前か直後に復習することで、毎回間隔を延ばします。簡単な項目は数日・数週間・数ヶ月へ、難しい項目は安定するまで短い間隔で復習します。その結果、すでに覚えている項目ではなく、本当に復習が必要な項目に時間を使えます。",
    sectionAlgorithms: "SRSアルゴリズムの仕組み",
    summaryP8:
      "手動で間隔を管理することは可能ですが、規模が大きくなると難しいです。SM-2（Ankiなどで使われるアルゴリズム）のようなアルゴリズムは、各復習後に思い出しの成績に基づいて次回の間隔を計算します。楽に思い出せれば間隔は延び、苦労したり忘れていれば短くなったりリセットされます。式は様々ですが、原理は同じです。",
    summaryP9:
      "Retentioもこの考え方に従います。各カードに到期日があり、復習するとシステムが間隔と次回の到期日を更新します。いつどのカードを見るかはアルゴリズムが決め、あなたは回答に集中し、スケジュールはシステムに任せられます。",
    sectionPractice: "実践での意義",
    summaryP10:
      "間隔反復はトリックではなく、学習を記憶の仕組みに合わせる方法です。すでに知っている内容を過度に復習しなくなり、忘れかけたものに集中できるため、総学習時間が減ります。ストレスも減ります：直前詰め込みではなく、毎日一定量の復習をし、システムが到期を管理します。",
    summaryP11:
      "言語学習、試験対策、事実や概念の知識構築のいずれでも、復習を間隔化することで効率が上がり、結果が長く持続します。より詳しくは下記の完全レポートをご覧ください。",
    readFullReport: "完全レポートを読む",
    backToHome: "ホームに戻る",
  },
};

const RESEARCH_REPORT_URL =
  "https://research.yuda.me/podcast/episodes/algorithms-for-life/ep1-spaced-repetition/report.html";

export { RESEARCH_REPORT_URL };
