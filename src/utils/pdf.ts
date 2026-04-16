// PDF出力ロジック
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Project } from '../types';
import { formatJPLong } from './dates';
import { computePageLayout, PX_PER_MM, type PageLayout } from './pdfLayout';

// A4 mm
const A4_LANDSCAPE_W = 297;
const A4_LANDSCAPE_H = 210;
const A4_PORTRAIT_W = 210;
const A4_PORTRAIT_H = 297;

export interface PdfOptions {
  withCover: boolean;
  mode: 'fit' | 'week' | 'month' | 'long';
  selfCompany?: string;
  assignee?: string;
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

/** 表紙HTML → 画像化 */
async function buildCoverImage(
  project: Project,
  opts: PdfOptions
): Promise<{ dataUrl: string; width: number; height: number }> {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '-10000px';
  wrapper.style.left = '0';
  wrapper.style.width = '794px'; // A4縦 96dpi
  wrapper.style.height = '1123px';
  wrapper.style.background = '#ffffff';
  wrapper.style.padding = '80px 64px';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.fontFamily = "-apple-system, 'Hiragino Sans', 'Yu Gothic UI', sans-serif";
  wrapper.style.color = '#1f2937';

  wrapper.innerHTML = `
    <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 60px; display: flex; justify-content: space-between; align-items: center;">
      <div style="font-size: 14px; color: #6b7280; letter-spacing: 0.05em;">工 程 表</div>
      <div style="font-size: 11px; color: #9ca3af;">KOUTEI.app</div>
    </div>
    <div style="text-align: center; margin: 40px 0 80px;">
      <div style="font-size: 42px; font-weight: 700; line-height: 1.4; word-break: break-word;">
        ${escapeHTML(project.name || '無題')}
      </div>
    </div>
    <div style="margin-top: 100px; display: flex; flex-direction: column; gap: 24px; font-size: 16px; line-height: 1.6;">
      ${row('元 請 会 社', project.contractor || '—')}
      ${row('工　　　　期', `${formatJPLong(project.startDate)} 〜 ${formatJPLong(project.endDate)}`)}
      ${opts.selfCompany ? row('自 社 名', opts.selfCompany) : ''}
      ${opts.assignee ? row('担　 当　 者', opts.assignee) : ''}
    </div>
    ${
      project.memo
        ? `<div style="margin-top: 60px; padding: 20px; background: #f8f9fb; border-left: 4px solid #4f46e5; border-radius: 4px;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px; font-weight: 600;">備　考</div>
            <div style="font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${escapeHTML(project.memo)}</div>
          </div>`
        : ''
    }
    <div style="position: absolute; bottom: 60px; left: 64px; right: 64px; border-top: 1px solid #e5e7eb; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af;">
      <div>作 成 日: ${formatDateAscii(project.createdAt)}</div>
      <div>更 新 日: ${formatDateAscii(project.updatedAt)}</div>
    </div>
  `;

  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
  } finally {
    document.body.removeChild(wrapper);
  }
}

function row(label: string, value: string): string {
  return `<div style="display: flex; gap: 24px; align-items: baseline;">
    <div style="width: 130px; font-size: 12px; color: #6b7280; font-weight: 600; flex-shrink: 0;">${label}</div>
    <div style="flex: 1; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; font-size: 16px;">${escapeHTML(value)}</div>
  </div>`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateAscii(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10).replace(/-/g, '/');
}

/** メイン: ガントチャート + 表紙(任意) を PDF 化 */
export async function exportPDF(ganttEl: HTMLElement, project: Project, options: PdfOptions) {
  const margin_mm = options.marginMm ?? 8;
  const autoBalance = options.autoBalance ?? true;
  const isLong = options.mode === 'long';
  const pageW_mm = isLong ? getLongPageWidth(ganttEl) : A4_LANDSCAPE_W;
  const pageH_mm = A4_LANDSCAPE_H;

  let pdf: jsPDF;
  if (isLong) {
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageW_mm, pageH_mm] });
  } else {
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  }

  let firstPageUsed = false;

  // === 表紙 ===
  if (options.withCover) {
    const cover = await buildCoverImage(project, options);
    pdf.deletePage(1);
    pdf.addPage('a4', 'portrait');
    // 表紙はマージン無しで全面配置
    const coverLayout = computePageLayout({
      chartW_px: cover.width,
      chartH_px: cover.height,
      pageW_mm: A4_PORTRAIT_W,
      pageH_mm: A4_PORTRAIT_H,
      margin_mm: 0,
      autoBalance: false,
    });
    placeWithLayout(pdf, cover.dataUrl, coverLayout);
    firstPageUsed = true;
  }

  // === ガント本体 ===
  if (options.mode === 'month') {
    await renderMonthSplit(pdf, ganttEl, firstPageUsed, margin_mm, autoBalance);
  } else {
    const captured = await captureGantt(ganttEl);
    if (firstPageUsed) {
      if (isLong) {
        pdf.addPage([pageW_mm, pageH_mm], 'landscape');
      } else {
        pdf.addPage('a4', 'landscape');
      }
    }
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
  ganttEl: HTMLElement,
  hasCover: boolean,
  margin_mm: number,
  autoBalance: boolean
) {
  const taskNameEl = ganttEl.querySelector('.gantt-task-name') as HTMLElement | null;
  const nameWidthPx = taskNameEl?.offsetWidth ?? 240;

  const fullCanvas = await html2canvas(ganttEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const monthRow = ganttEl.querySelector('.gantt-month-row');
  const months = monthRow ? Array.from(monthRow.querySelectorAll('.gantt-month-cell')) : [];

  if (months.length === 0) {
    if (hasCover) pdf.addPage('a4', 'landscape');
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

  let cumulativePx = 0;
  let isFirstChartPage = true;
  for (let i = 0; i < months.length; i++) {
    const m = months[i] as HTMLElement;
    const widthPx = m.offsetWidth;
    const scale = fullCanvas.width / ganttEl.scrollWidth;
    const cropX = Math.round((nameWidthPx + cumulativePx) * scale);
    const cropW = Math.round(widthPx * scale);
    const headerW = Math.round(nameWidthPx * scale);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = headerW + cropW;
    pageCanvas.height = fullCanvas.height;
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(fullCanvas, 0, 0, headerW, fullCanvas.height, 0, 0, headerW, fullCanvas.height);
    ctx.drawImage(fullCanvas, cropX, 0, cropW, fullCanvas.height, headerW, 0, cropW, fullCanvas.height);

    if (!isFirstChartPage || hasCover) {
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
export function fitsOnA4Landscape(ganttEl: HTMLElement): boolean {
  const w_mm = ganttEl.scrollWidth / PX_PER_MM;
  const h_mm = ganttEl.scrollHeight / PX_PER_MM;
  return w_mm <= (A4_LANDSCAPE_W - 16) * 1.05 && h_mm <= (A4_LANDSCAPE_H - 16) * 1.05;
}
