import { useEffect, useMemo, useRef, useState } from 'react';
import { computePageLayout, PX_PER_MM, type PageLayout } from '../../utils/pdfLayout';

interface Props {
  ganttEl: HTMLElement;
  autoBalance: boolean;
  pageW_mm: number;
  pageH_mm: number;
  margin_mm: number;
}

/**
 * A4ページを縮小サイズで実物大プレビュー表示する。
 * モーダル内で「実際に印刷されたらこう見える」を確認できる。
 */
export function A4Preview({ ganttEl, autoBalance, pageW_mm, pageH_mm, margin_mm }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(0.4);

  // チャートサイズ取得
  const { chartW_px, chartH_px } = useMemo(() => {
    return { chartW_px: ganttEl.scrollWidth, chartH_px: ganttEl.scrollHeight };
  }, [ganttEl]);

  // レイアウト計算
  const layout: PageLayout = useMemo(
    () =>
      computePageLayout({
        chartW_px,
        chartH_px,
        pageW_mm,
        pageH_mm,
        margin_mm,
        autoBalance,
      }),
    [chartW_px, chartH_px, pageW_mm, pageH_mm, margin_mm, autoBalance]
  );

  // ステージ幅に応じて表示倍率を自動調整
  useEffect(() => {
    const update = () => {
      if (!stageRef.current) return;
      const stageW = stageRef.current.clientWidth - 16; // padding
      const pageW_px = pageW_mm * PX_PER_MM;
      const scale = Math.min(stageW / pageW_px, 0.6); // 最大60%
      setDisplayScale(Math.max(scale, 0.2));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [pageW_mm]);

  // ガントクローンを差し込み (DOMをそのまま複製してCSSスタイルもキープ)
  useEffect(() => {
    if (!frameRef.current) return;
    frameRef.current.innerHTML = '';

    const inner = document.createElement('div');
    inner.style.cssText = `
      position: absolute;
      left: ${layout.offsetX_mm * PX_PER_MM * displayScale}px;
      top: ${layout.offsetY_mm * PX_PER_MM * displayScale}px;
      width: ${chartW_px}px;
      height: ${chartH_px}px;
      transform: scale(${layout.scaleX * displayScale}, ${layout.scaleY * displayScale});
      transform-origin: top left;
      pointer-events: none;
    `;

    const clone = ganttEl.cloneNode(true) as HTMLElement;
    // クローン側でstickyやscrollを無効化(プレビュー描画の歪み防止)
    clone.style.position = 'static';
    clone.style.overflow = 'visible';
    clone.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.position === 'sticky') el.style.position = 'static';
    });
    inner.appendChild(clone);

    frameRef.current.appendChild(inner);
  }, [ganttEl, layout, displayScale, chartW_px, chartH_px]);

  const pageW_px = pageW_mm * PX_PER_MM;
  const pageH_px = pageH_mm * PX_PER_MM;

  return (
    <div className="a4-stage" ref={stageRef}>
      <div
        ref={frameRef}
        className="a4-frame"
        style={{
          width: `${pageW_px * displayScale}px`,
          height: `${pageH_px * displayScale}px`,
          position: 'relative',
        }}
      >
        {/* マージン補助線 (薄く表示) */}
        <div
          className="a4-margin-guide"
          style={{
            position: 'absolute',
            left: `${margin_mm * PX_PER_MM * displayScale}px`,
            top: `${margin_mm * PX_PER_MM * displayScale}px`,
            width: `${(pageW_mm - margin_mm * 2) * PX_PER_MM * displayScale}px`,
            height: `${(pageH_mm - margin_mm * 2) * PX_PER_MM * displayScale}px`,
            border: '1px dashed rgba(79, 70, 229, 0.18)',
            pointerEvents: 'none',
          }}
        />
      </div>
      <div className="a4-stage-meta">
        <span>
          A4 {pageW_mm === 297 ? '横' : `${pageW_mm}mm幅`} ・ プレビュー約{Math.round(displayScale * 100)}%
        </span>
        {layout.stretchRatio > 1.01 && (
          <span className="a4-stretch-badge">
            自動調整: {Math.round((layout.stretchRatio - 1) * 100)}% ストレッチ
          </span>
        )}
      </div>
    </div>
  );
}
