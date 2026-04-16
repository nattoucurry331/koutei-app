// PDFページレイアウト計算
// プレビューと実際のPDF生成で同じロジックを使うため、純粋関数として切り出し

export interface PageLayout {
  pageW_mm: number;
  pageH_mm: number;
  margin_mm: number;
  // ガントチャートに適用するスケール (autoBalance時はXとYで異なる場合あり)
  scaleX: number;
  scaleY: number;
  // ページ左上からのオフセット (mm) - 中央配置
  offsetX_mm: number;
  offsetY_mm: number;
  // スケール後のサイズ
  finalW_mm: number;
  finalH_mm: number;
  // 元のチャートサイズ (px)
  chartW_px: number;
  chartH_px: number;
  // ストレッチ量 (1.0 = 等倍, 1.3 = 30%拡大)
  stretchRatio: number;
}

export interface LayoutOptions {
  chartW_px: number;
  chartH_px: number;
  pageW_mm: number;
  pageH_mm: number;
  margin_mm: number;
  /**
   * 余白を埋めるため軽度の非等倍スケールを許可するか
   * - false: アスペクト比を保ったまま中央配置 (端に余白できる)
   * - true: アスペクトずれを最大 maxStretch まで許容して埋める
   */
  autoBalance: boolean;
  /**
   * autoBalance=true 時の最大ストレッチ比率 (1.3 = 30%)
   */
  maxStretch?: number;
}

// 96dpi で 1mm = 3.7795px
export const PX_PER_MM = 96 / 25.4;

export function computePageLayout(opts: LayoutOptions): PageLayout {
  const maxStretch = opts.maxStretch ?? 1.3;
  const innerW_mm = opts.pageW_mm - opts.margin_mm * 2;
  const innerH_mm = opts.pageH_mm - opts.margin_mm * 2;
  const chartW_mm = opts.chartW_px / PX_PER_MM;
  const chartH_mm = opts.chartH_px / PX_PER_MM;

  // ベース倍率(各軸独立に余白いっぱいまで使った場合)
  const scaleXBase = innerW_mm / chartW_mm;
  const scaleYBase = innerH_mm / chartH_mm;

  let scaleX: number;
  let scaleY: number;
  let stretchRatio = 1;

  if (opts.autoBalance) {
    // 小さい方を起点に、大きい方の最大ストレッチを許容
    const minScale = Math.min(scaleXBase, scaleYBase);
    const cap = minScale * maxStretch;
    scaleX = Math.min(scaleXBase, cap);
    scaleY = Math.min(scaleYBase, cap);
    stretchRatio = Math.max(scaleX, scaleY) / Math.min(scaleX, scaleY);
  } else {
    // 等倍: 縦横で小さい方に揃える
    const s = Math.min(scaleXBase, scaleYBase);
    scaleX = s;
    scaleY = s;
  }

  const finalW_mm = chartW_mm * scaleX;
  const finalH_mm = chartH_mm * scaleY;

  // ページ中央に配置
  const offsetX_mm = (opts.pageW_mm - finalW_mm) / 2;
  const offsetY_mm = (opts.pageH_mm - finalH_mm) / 2;

  return {
    pageW_mm: opts.pageW_mm,
    pageH_mm: opts.pageH_mm,
    margin_mm: opts.margin_mm,
    scaleX,
    scaleY,
    offsetX_mm,
    offsetY_mm,
    finalW_mm,
    finalH_mm,
    chartW_px: opts.chartW_px,
    chartH_px: opts.chartH_px,
    stretchRatio,
  };
}

/** 1枚にぴったり収まるかどうか (autoBalance考慮) */
export function detectFit(opts: LayoutOptions): {
  fitsWithoutStretch: boolean;
  fitsWithStretch: boolean;
  whitespaceRatio: number; // 0=ぴったり, 1=ほぼ全部余白
} {
  const innerW_mm = opts.pageW_mm - opts.margin_mm * 2;
  const innerH_mm = opts.pageH_mm - opts.margin_mm * 2;
  const innerArea = innerW_mm * innerH_mm;

  const layoutNoStretch = computePageLayout({ ...opts, autoBalance: false });
  const layoutStretched = computePageLayout({ ...opts, autoBalance: true });

  const usedArea = layoutNoStretch.finalW_mm * layoutNoStretch.finalH_mm;
  const whitespaceRatio = 1 - usedArea / innerArea;

  // 元のサイズがページ内に収まる = 縮小せずに済む = 1枚に収まる
  const chartW_mm = opts.chartW_px / PX_PER_MM;
  const chartH_mm = opts.chartH_px / PX_PER_MM;
  const fitsWithoutStretch = chartW_mm <= innerW_mm * 1.05 && chartH_mm <= innerH_mm * 1.05;

  // ストレッチで埋められる範囲 (ほぼ常にtrueになる、表示の参考用)
  const fitsWithStretch =
    layoutStretched.finalW_mm <= opts.pageW_mm + 1 &&
    layoutStretched.finalH_mm <= opts.pageH_mm + 1;

  return { fitsWithoutStretch, fitsWithStretch, whitespaceRatio };
}
