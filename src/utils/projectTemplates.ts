// プロジェクトテンプレート: よくある工事パターン
// startOffset と duration はすべて「日数」で指定

export interface TemplateTask {
  name: string;
  /** プロジェクト開始日からのオフセット日数 (0 = 開始日当日) */
  startOffset: number;
  /** バーの長さ(日数, 両端含む) */
  duration: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** 推奨工期(日数) */
  defaultDurationDays: number;
  tasks: TemplateTask[];
  icon?: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: '空のプロジェクト',
    description: '何もない状態から自分で組み立てる',
    defaultDurationDays: 30,
    tasks: [],
    icon: '📄',
  },
  {
    id: 'shintiku',
    name: '戸建て新築工事',
    description: '基礎・躯体・内装・外構までの一般的な戸建て新築 (約3ヶ月)',
    defaultDurationDays: 90,
    icon: '🏠',
    tasks: [
      { name: '仮設工事', startOffset: 0, duration: 3 },
      { name: '土工事', startOffset: 3, duration: 5 },
      { name: '基礎工事', startOffset: 8, duration: 12 },
      { name: '土台敷込', startOffset: 20, duration: 2 },
      { name: '上棟', startOffset: 22, duration: 3 },
      { name: '屋根工事', startOffset: 25, duration: 7 },
      { name: '外壁工事', startOffset: 32, duration: 14 },
      { name: '電気工事(配線)', startOffset: 30, duration: 10 },
      { name: '給排水工事', startOffset: 30, duration: 10 },
      { name: '断熱工事', startOffset: 40, duration: 5 },
      { name: '内装下地', startOffset: 45, duration: 10 },
      { name: '建具工事', startOffset: 55, duration: 5 },
      { name: 'クロス工事', startOffset: 60, duration: 7 },
      { name: '塗装工事', startOffset: 60, duration: 7 },
      { name: 'タイル工事', startOffset: 67, duration: 5 },
      { name: '電気工事(器具)', startOffset: 70, duration: 5 },
      { name: '設備機器据付', startOffset: 70, duration: 5 },
      { name: '外構工事', startOffset: 75, duration: 10 },
      { name: 'クリーニング', startOffset: 85, duration: 3 },
      { name: '検査・引渡し', startOffset: 88, duration: 2 },
    ],
  },
  {
    id: 'naisou',
    name: '内装リフォーム',
    description: 'マンション・住宅の内装改修(約1ヶ月)',
    defaultDurationDays: 30,
    icon: '🛋️',
    tasks: [
      { name: '養生・解体', startOffset: 0, duration: 3 },
      { name: '電気工事(配線)', startOffset: 3, duration: 3 },
      { name: '給排水工事', startOffset: 3, duration: 3 },
      { name: '大工工事', startOffset: 6, duration: 7 },
      { name: 'クロス工事', startOffset: 13, duration: 4 },
      { name: '建具工事', startOffset: 17, duration: 3 },
      { name: '塗装工事', startOffset: 20, duration: 3 },
      { name: '設備機器据付', startOffset: 23, duration: 3 },
      { name: 'クリーニング', startOffset: 26, duration: 2 },
      { name: '検査・引渡し', startOffset: 28, duration: 2 },
    ],
  },
  {
    id: 'gaiheki',
    name: '外壁塗装工事',
    description: '足場〜塗装〜足場解体の標準工程(約2週間)',
    defaultDurationDays: 14,
    icon: '🎨',
    tasks: [
      { name: '足場仮設', startOffset: 0, duration: 1 },
      { name: '高圧洗浄', startOffset: 1, duration: 1 },
      { name: '養生', startOffset: 2, duration: 1 },
      { name: '下塗り', startOffset: 3, duration: 2 },
      { name: '中塗り', startOffset: 5, duration: 2 },
      { name: '上塗り', startOffset: 7, duration: 2 },
      { name: '付帯部塗装', startOffset: 9, duration: 2 },
      { name: '点検・手直し', startOffset: 11, duration: 1 },
      { name: '足場解体', startOffset: 12, duration: 1 },
      { name: 'クリーニング', startOffset: 13, duration: 1 },
    ],
  },
  {
    id: 'kaitai',
    name: '解体工事',
    description: '事前調査〜解体〜整地の標準工程(約10日)',
    defaultDurationDays: 10,
    icon: '🏗️',
    tasks: [
      { name: '事前調査', startOffset: 0, duration: 1 },
      { name: '足場・養生', startOffset: 1, duration: 1 },
      { name: '内部解体', startOffset: 2, duration: 3 },
      { name: '屋根解体', startOffset: 5, duration: 1 },
      { name: '本体解体', startOffset: 6, duration: 2 },
      { name: '基礎解体', startOffset: 8, duration: 1 },
      { name: '整地・引渡し', startOffset: 9, duration: 1 },
    ],
  },
  {
    id: 'yane',
    name: '屋根工事',
    description: '屋根の葺き替え・補修工事(約1週間)',
    defaultDurationDays: 7,
    icon: '🔨',
    tasks: [
      { name: '足場設置', startOffset: 0, duration: 1 },
      { name: '既存屋根撤去', startOffset: 1, duration: 1 },
      { name: '下地補修', startOffset: 2, duration: 1 },
      { name: 'ルーフィング', startOffset: 3, duration: 1 },
      { name: '屋根材葺き', startOffset: 4, duration: 2 },
      { name: '足場解体・清掃', startOffset: 6, duration: 1 },
    ],
  },
];

export function findTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
