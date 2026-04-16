// PDF出力ロジック
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Project } from '../types';
import { computePageLayout, PX_PER_MM, type PageLayout } from './pdfLayout';

// A4 mm
const A4_LANDSCAPE_W = 297;
const A4_LANDSCAPE_H = 210;

export interface PdfOptions {
  mode: 'fit' | 'week' | 'month' | 'long';
  /** 余白を埋めるため軽度ストレッチを許容 */
  autoBalance?: boolean;
  /** 余白(mm) - デフォルト8 */
  marginMm?: number;
}

async function captureGantt(ganttEl: HTMLElement): Promise<{ dataUrl: string; w: number; h: number }> {
  const canvas = await html2canvas(ganttEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });
  return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height };
}

/** PageLayout に従って画像をPDFページに配置 */
function placeWithLayout(pdf: jsPDF, dataUrl: string, layout: PageLayout) {
  pdf.addImage(
    dataUrl,
    'PNG',
    layout.offsetX_mm,
    layout.offsetY_mm,
    layout.finalW_mm,
    layout.finalH_mm,
    undefined,
    'FAST'
  );
}

function getLongPageWidth(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const ratio = rect.width / rect.height;
  return Math.min(Math.max(A4_LANDSCAPE_H * ratio + 16, A4_LANDSCAPE_W), 1500);
}

/** メイン: 印刷エリアを PDF 化 */
export async function exportPDF(printAreaEl: HTMLElement, project: Project, options: PdfOptions) {
  const margin_mm = options.marginMm ?? 8;
  const autoBalance = options.autoBalance ?? true;
  const isLong = options.mode === 'long';
  const pageW_mm = isLong ? getLongPageWidth(printAreaEl) : A4_LANDSCAPE_W;
  const pageH_mm = A4_LANDSCAPE_H;

  let pdf: jsPDF;
  if (isLong) {
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageW_mm, pageH_mm] });
  } else {
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  }

  if (options.mode === 'month') {
    await renderMonthSplit(pdf, printAreaEl, margin_mm, autoBalance);
  } else {
    const captured = await captureGantt(printAreaEl);
    const layout = computePageLayout({
      chartW_px: captured.w / 2, // scale=2 で撮ってるので元px換算
      chartH_px: captured.h / 2,
      pageW_mm,
      pageH_mm,
      margin_mm,
      autoBalance,
    });
    placeWithLayout(pdf, captured.dataUrl, layout);
  }

  pdf.save(`${project.name || 'koutei'}.pdf`);
}

/** 月分割: 月境界でクロップして複数ページに */
async function renderMonthSplit(
  pdf: jsPDF,
  printAreaEl: HTMLElement,
  margin_mm: number,
  autoBalance: boolean
) {
  const taskNameEl = printAreaEl.querySelector('.gantt-task-name') as HTMLElement | null;
  const nameWidthPx = taskNameEl?.offsetWidth ?? 240;

  // ヘッダー(現場名・元請・工期)とフッター(備考)もクロップに含めるため、
  // 印刷エリア全体を撮影して上下のメタ情報も保持する
  const fullCanvas = await html2canvas(printAreaEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  // ガント部分の月セルを取得
  const ganttTable = printAreaEl.querySelector('.gantt-table') as HTMLElement | null;
  const monthRow = ganttTable?.querySelector('.gantt-month-row');
  const months = monthRow ? Array.from(monthRow.querySelectorAll('.gantt-month-cell')) : [];

  if (months.length === 0 || !ganttTable) {
    const layout = computePageLayout({
      chartW_px: fullCanvas.width / 2,
      chartH_px: fullCanvas.height / 2,
      pageW_mm: A4_LANDSCAPE_W,
      pageH_mm: A4_LANDSCAPE_H,
      margin_mm,
      autoBalance,
    });
    placeWithLayout(pdf, fullCanvas.toDataURL('image/png'), layout);
    return;
  }

  // ガントテーブル位置 (印刷エリア内のオフセット)
  const printRect = printAreaEl.getBoundingClientRect();
  const ganttRect = ganttTable.getBoundingClientRect();
  const scale = fullCanvas.width / printAreaEl.scrollWidth;
  const ganttOffsetX_px = (ganttRect.left - printRect.left) * scale;

  let cumulativePx = 0;
  let isFirstChartPage = true;
  for (let i = 0; i < months.length; i++) {
    const m = months[i] as HTMLElement;
    const widthPx = m.offsetWidth;
    const cropX = Math.round(ganttOffsetX_px + (nameWidthPx + cumulativePx) * scale);
    const cropW = Math.round(widthPx * scale);
    const headerW = Math.round((ganttOffsetX_px + nameWidthPx * scale));

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = headerW + cropW;
    pageCanvas.height = fullCanvas.height;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    // 左: 印刷エリア左端〜工種列までを再掲 (現場名・元請なども入る)
    ctx.drawImage(fullCanvas, 0, 0, headerW, fullCanvas.height, 0, 0, headerW, fullCanvas.height);
    // 右: 当月分
    ctx.drawImage(fullCanvas, cropX, 0, cropW, fullCanvas.height, headerW, 0, cropW, fullCanvas.height);

    if (!isFirstChartPage) {
      pdf.addPage('a4', 'landscape');
    }
    isFirstChartPage = false;

    const layout = computePageLayout({
      chartW_px: pageCanvas.width / 2,
      chartH_px: pageCanvas.height / 2,
      pageW_mm: A4_LANDSCAPE_W,
      pageH_mm: A4_LANDSCAPE_H,
      margin_mm,
      autoBalance,
    });
    placeWithLayout(pdf, pageCanvas.toDataURL('image/png'), layout);

    cumulativePx += widthPx;
  }
}

/** 互換: 旧API */
export function fitsOnA4Landscape(el: HTMLElement): boolean {
  const w_mm = el.scrollWidth / PX_PER_MM;
  const h_mm = el.scrollHeight / PX_PER_MM;
  return w_mm <= (A4_LANDSCAPE_W - 16) * 1.05 && h_mm <= (A4_LANDSCAPE_H - 16) * 1.05;
}
