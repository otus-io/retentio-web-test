export type HomeLang = "en" | "zh" | "ja" | "de";

export interface HomeStrings {
  // Header
  logIn: string;
  dashboard: string;
  help: string;

  // Hero
  heroTagline: string;
  heroSubtitle: string;

  // What is Retentio (box left of Why SRS)
  whatIsRetentioTitle: string;
  whatIsRetentioDesc: string;

  // Why SRS
  whySrsTitle: string;
  whySrsP1: string;
  whySrsP2: string;
  whySrsBullet1: string;
  whySrsBullet2: string;
  whySrsBullet3: string;
  whySrsLearnMore: string;

  // What Retentio does (cards)
  whatTitle: string;
  whatVerified: string;
  whatVerifiedDesc: string;
  whatAlgorithm: string;
  whatAlgorithmDesc: string;
  whatUi: string;
  whatUiDesc: string;
  whatPremadeDecks: string;
  whatPremadeDecksDesc: string;

  // Features
  featuresTitle: string;
  featureTagging: string;
  featureHoliday: string;

  // Footer
  footerTagline: string;

  // Manual page
  manualTitle: string;
  manualIntro: string;
}

/** Ordered list for the language dropdown. Add new languages here and to HomeLang + homeStrings/researchStrings. */
export const LANGUAGES: { code: HomeLang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "de", label: "Deutsch" },
];

export const homeStrings: Record<HomeLang, HomeStrings> = {
  en: {
    logIn: "Log in",
    dashboard: "Dashboard",
    help: "Help",
    heroTagline: "Learning with spaced repetition",
    heroSubtitle: "Build decks, add facts, and review with science-backed scheduling for better retention. For any subject — languages, exams, or anything you want to remember. Web and mobile.",
    whySrsTitle: "Why spaced repetition?",
    whySrsP1:
      "Spaced Repetition System (SRS) schedules reviews at optimal intervals so you remember more with less effort and improve long-term retention. Instead of cramming, you see each item when you're about to forget it.",
    whySrsP2: "The result: better long-term retention and less time spent re-learning.",
    whySrsBullet1: "Review at the right time — not too early, not too late",
    whySrsBullet2: "Stronger long-term memory with fewer sessions",
    whySrsBullet3: "Less cramming, more sustainable learning",
    whySrsLearnMore: "Learn more about the research",
    whatIsRetentioTitle: "What is Retentio?",
    whatIsRetentioDesc:
      "Retentio comes from the Latin word for “retention” — the act of retaining or keeping something in memory. We chose it because our app is built around spaced repetition, which is designed to improve long-term retention. The name reflects what we help you do: remember more, for longer.",
    whatTitle: "What Retentio does",
    whatVerified: "Human-verified translations",
    whatVerifiedDesc: "Word and phrase translations are human-verified for better accuracy and retention than raw machine output.",
    whatAlgorithm: "Improved SRS algorithm",
    whatAlgorithmDesc: "A new SRS algorithm that addresses limitations of existing algorithms for more effective scheduling and better retention.",
    whatUi: "Intuitive UI",
    whatUiDesc: "Clean, focused interface so you spend time on the subject, not fighting the tool.",
    whatPremadeDecks: "AI-powered decks",
    whatPremadeDecksDesc:
      "AI-analyzed past exams to find patterns and focus on what matters most, making learning more efficient.",
    featuresTitle: "Features",
    featureTagging: "Robust tagging system for flexible reviewing",
    featureHoliday: "Holiday rescheduling of all cards so you don't get overwhelmed",
    footerTagline: "Retentio — learning with spaced repetition for lasting retention",
    manualTitle: "User manual",
    manualIntro: "How to use Retentio: create decks, add facts, and review cards. Content will be expanded here.",
  },
  zh: {
    logIn: "登录",
    dashboard: "控制台",
    help: "帮助",
    heroTagline: "用间隔重复学习",
    heroSubtitle: "创建牌组、添加词条，用科学排程复习，提升记忆保留。语言、考试或任何你想记住的内容都适用。支持网页与移动端。",
    whySrsTitle: "为什么用间隔重复？",
    whySrsP1:
      "间隔重复系统（SRS）在最佳间隔安排复习，让你用更少时间记住更多、长期保留率更高。不用死记硬背，每条内容会在你快要忘记时再次出现。",
    whySrsP2: "结果是：长期记忆更好，重新学习的时间更少。",
    whySrsBullet1: "在最佳时机复习——不太早也不太晚",
    whySrsBullet2: "用更少次数获得更牢的长期记忆",
    whySrsBullet3: "少突击、多可持续的学习",
    whySrsLearnMore: "了解更多研究",
    whatIsRetentioTitle: "什么是 Retentio？",
    whatIsRetentioDesc:
      "Retentio 源自拉丁语「保留、记忆」之意。我们取这个名字，是因为产品围绕间隔重复而设计，目标是提升长期记忆保留。名字即使命：帮你记得更多、更久。",
    whatTitle: "Retentio 能做什么",
    whatVerified: "人工核验的释义",
    whatVerifiedDesc: "单词与短语释义经人工核验，比纯机翻更准确，记忆保留更好。",
    whatAlgorithm: "更优的 SRS 算法",
    whatAlgorithmDesc: "新的间隔重复算法，针对现有算法的不足做了改进，排程更有效，保留率更高。",
    whatUi: "简洁易用的界面",
    whatUiDesc: "界面清晰、专注内容，把时间花在学习上，而不是折腾工具。",
    whatPremadeDecks: "AI 驱动牌组",
    whatPremadeDecksDesc: "AI 分析历年真题，提炼规律与重点，让学习更高效。",
    featuresTitle: "功能",
    featureTagging: "完善的标签系统，支持灵活复习",
    featureHoliday: "假期统一调整卡片排程，避免积压",
    footerTagline: "Retentio — 用间隔重复学习，持久保留",
    manualTitle: "用户手册",
    manualIntro: "如何使用 Retentio：创建牌组、添加词条、复习卡片。此处内容将逐步完善。",
  },
  ja: {
    logIn: "ログイン",
    dashboard: "ダッシュボード",
    help: "ヘルプ",
    heroTagline: "間隔反復で学ぶ",
    heroSubtitle:
      "デッキを作成し、ファクトを追加し、科学的なスケジュールで復習して記憶の定着を高めます。言語、試験、覚えたいあらゆる内容に対応。Webとモバイル。",
    whySrsTitle: "なぜ間隔反復？",
    whySrsP1:
      "間隔反復システム（SRS）は、最適な間隔で復習をスケジュールし、少ない努力でより多く覚え、長期の記憶定着を高めます。詰め込みではなく、忘れそうになった頃に各項目が表示されます。",
    whySrsP2: "結果として、長期記憶が向上し、やり直しの時間が減ります。",
    whySrsBullet1: "適切なタイミングで復習 — 早すぎず遅すぎず",
    whySrsBullet2: "少ないセッションでより強い長期記憶",
    whySrsBullet3: "詰め込みではなく、持続可能な学習",
    whySrsLearnMore: "研究の詳細",
    whatIsRetentioTitle: "Retentio とは？",
    whatIsRetentioDesc:
      "Retentio はラテン語の「保持・記憶」に由来します。間隔反復を中心にしたアプリだからこそ、長期の記憶定着を高めることが目的です。名前がそのまま私たちの目標を表しています——より多く、より長く覚えるお手伝いをします。",
    whatTitle: "Retentioの特徴",
    whatVerified: "人間による翻訳チェック",
    whatVerifiedDesc:
      "単語・フレーズの翻訳は人間が確認し、機械翻訳のみより正確で記憶の定着にも役立ちます。",
    whatAlgorithm: "改良されたSRSアルゴリズム",
    whatAlgorithmDesc:
      "既存アルゴリズムの課題に対応した新しいSRSアルゴリズムで、より効果的なスケジュールと定着を実現。",
    whatUi: "直感的なUI",
    whatUiDesc: "シンプルで集中しやすいインターフェース。ツールではなく、学習内容に集中できます。",
    whatPremadeDecks: "AI搭載デッキ",
    whatPremadeDecksDesc:
      "過去問をAI分析し、パターンと重要点を抽出。学習をより効率的に。",
    featuresTitle: "機能",
    featureTagging: "充実したタグで柔軟に復習",
    featureHoliday: "休暇時に全カードのスケジュールを調整し、負荷を分散",
    footerTagline: "Retentio — 間隔反復で持続する記憶定着",
    manualTitle: "ユーザーマニュアル",
    manualIntro: "Retentio の使い方：デッキ作成、ファクト追加、カード復習。ここに内容を追記します。",
  },
  de: {
    logIn: "Anmelden",
    dashboard: "Dashboard",
    help: "Hilfe",
    heroTagline: "Lernen mit Karteikarten und Abstand",
    heroSubtitle:
      "Erstellen Sie Karteikarten, fügen Sie Fakten hinzu und wiederholen Sie mit wissenschaftlich fundierter Planung für bessere Merkleistung. Für Sprachen, Prüfungen oder alles, was Sie behalten möchten. Web und mobil.",
    whySrsTitle: "Warum Karteikarten mit Abstand?",
    whySrsP1:
      "Ein Karteikartensystem plant Wiederholungen in optimalen Abständen, sodass Sie mit weniger Aufwand mehr behalten und langfristig besser memorieren. Statt zu pauken, sehen Sie jede Karte genau dann, wenn Sie sie fast vergessen hätten.",
    whySrsP2: "Das Ergebnis: bessere Langzeit-Merkleistung und weniger Zeit fürs Neulernen.",
    whySrsBullet1: "Zur richtigen Zeit wiederholen — weder zu früh noch zu spät",
    whySrsBullet2: "Stärkere Langzeiterinnerung mit weniger Sitzungen",
    whySrsBullet3: "Weniger Pauken, nachhaltigeres Lernen",
    whySrsLearnMore: "Mehr zur Forschung",
    whatIsRetentioTitle: "Was ist Retentio?",
    whatIsRetentioDesc:
      "Retentio leitet sich vom lateinischen Wort für „Behalten“ ab — das Festhalten von etwas im Gedächtnis. Wir haben den Namen gewählt, weil die App auf Karteikarten und Abständen aufbaut und langfristiges Behalten fördert. Der Name steht dafür, was wir tun: mehr behalten, länger behalten.",
    whatTitle: "Was Retentio kann",
    whatVerified: "Von Menschen geprüfte Übersetzungen",
    whatVerifiedDesc:
      "Übersetzungen von Wörtern und Phrasen werden von Menschen geprüft für bessere Genauigkeit und Merkleistung als reine Maschinenausgabe.",
    whatAlgorithm: "Verbesserter Karteikarten-Algorithmus",
    whatAlgorithmDesc:
      "Ein neuer Algorithmus, der Grenzen bestehender Systeme adressiert für effektivere Planung und besseres Behalten.",
    whatUi: "Übersichtliche Oberfläche",
    whatUiDesc:
      "Klare, fokussierte Oberfläche, damit Sie Zeit mit dem Stoff verbringen, nicht mit dem Tool.",
    whatPremadeDecks: "KI-gestützte Karteikarten",
    whatPremadeDecksDesc:
      "KI-Analyse vergangener Prüfungen für Muster und Fokus auf das Wichtigste — effizienteres Lernen.",
    featuresTitle: "Funktionen",
    featureTagging: "Stabiles Tagging für flexibles Wiederholen",
    featureHoliday: "Urlaubs-Verschiebung aller Karten, damit Sie nicht überlastet werden",
    footerTagline: "Retentio — Lernen mit Karteikarten für dauerhaftes Behalten",
    manualTitle: "Benutzerhandbuch",
    manualIntro:
      "So nutzen Sie Retentio: Karteikarten anlegen, Fakten hinzufügen, Karten wiederholen. Der Inhalt wird hier schrittweise ergänzt.",
  },
};
