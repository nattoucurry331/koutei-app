// PDF出力ロジック
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Project } from '../types';
import { formatJPLong } from './dates';

// A4 mm
const A4_LANDSCAPE_W = 297;
const A4_LANDSCAPE_H = 210;
const A4_PORTRAIT_W = 210;
const A4_PORTRAIT_H = 297;
const MARGIN = 10;

interface RenderToImageOptions {
  scale?: number;
}

async function renderElementToImage(el: HTMLElement, opts: RenderToImageOptions = {}) {
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: opts.scale ?? 2,
    useCORS: true,
    logging: false,
  });
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

/** A4横1枚に画像を収める。アスペクト比保持。 */
function placeImageOnPage(
  pdf: jsPDF,
  dataUrl: string,
  imgW: number,
  imgH: number,
  pageW: number,
  pageH: number,
  margin: number
) {
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const ratio = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * ratio;
  const drawH = imgH * ratio;
  const x = (pageW - drawW) / 2;
  const y = margin; // 上揃え
  pdf.addImage(dataUrl, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
}

/** ピクセル -> mm 変換 (PDF配置用; 比率計算でしか使わない) */
function pxToMm(px: number, dpi = 96) {
  return (px / dpi) * 25.4;
}

export interface PdfOptions {
  /** 表紙ページを追加 */
  withCover: boolean;
  /** 出力モード: A=週圧縮, B=月分割, C=横長, fit=そのまま1枚 */
  mode: 'fit' | 'week' | 'month' | 'long';
  /** 自社情報(表紙用) */
  selfCompany?: string;
  /** 担当者名(表紙用) */
  assignee?: string;
}

/**
 * ガントチャート要素をPDF化する。
 * @param ganttEl ガントチャート全体のDOM (.gantt-table を含む親)
 * @param project プロジェクト情報
 * @param options 出力オプション
 */
export async function exportGanttToPDF(
  ganttEl: HTMLElement,
  project: Project,
  options: PdfOptions
): Promise<void> {
  const orientation = options.mode === 'long' ? 'landscape' : 'landscape';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: options.mode === 'long' ? [getLongPageWidth(ganttEl), A4_LANDSCAPE_H] : 'a4',
  });

  // === 表紙 ===
  if (options.withCover) {
    addCoverPage(pdf, project, options);
    pdf.addPage('a4', 'landscape');
  }

  // === ガントチャート ===
  if (options.mode === 'fit' || options.mode === 'week' || options.mode === 'long') {
    // 1枚に収める (またはそのまま長尺PDF)
    const { dataUrl, width, height } = await renderElementToImage(ganttEl, { scale: 2 });
    if (options.mode === 'long') {
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      placeImageOnPage(pdf, dataUrl, width, height, pageW, pageH, MARGIN);
    } else {
      placeImageOnPage(pdf, dataUrl, width, height, A4_LANDSCAPE_W, A4_LANDSCAPE_H, MARGIN);
    }
  } else if (options.mode === 'month') {
    // 月ごとに分割: ガントチャート内の月境界で切り出す
    await renderMonthSplit(pdf, ganttEl, options.withCover);
  }

  pdf.save(`${project.name || 'koutei'}.pdf`);
}

function getLongPageWidth(el: HTMLElement): number {
  // 横長PDFの幅: 要素の縦横比に合わせる
  const rect = el.getBoundingClientRect();
  const ratio = rect.width / rect.height;
  return Math.min(Math.max(A4_LANDSCAPE_H * ratio + MARGIN * 2, A4_LANDSCAPE_W), 1500);
}

/** 月分割: 各月のセル群だけクロップした画像を1ページずつ出力 */
async function renderMonthSplit(pdf: jsPDF, ganttEl: HTMLElement, hasCover: boolean) {
  // 戦略: ガント全体をhtml2canvasで撮ってから、月境界でcropしたcanvasを各ページに置く
  // 月境界はDOMから読む: .gantt-month-cell の widths を順に合計
  const monthCells = ganttEl.querySelectorAll('.gantt-month-cell');
  const taskNameEl = ganttEl.querySelector('.gantt-task-name') as HTMLElement | null;
  const nameWidthPx = taskNameEl?.offsetWidth ?? 220;

  const fullCanvas = await html2canvas(ganttEl, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  // monthCells (同じmonth-rowの中の.gantt-month-cell) のうち、ヘッダ行の物だけ抽出
  const monthRow = ganttEl.querySelector('.gantt-month-row');
  const months = monthRow ? Array.from(monthRow.querySelectorAll('.gantt-month-cell')) : [];

  if (months.length === 0) {
    // フォールバック: そのまま1ページ
    placeImageOnPage(pdf, fullCanvas.toDataURL('image/png'), fullCanvas.width, fullCanvas.height, A4_LANDSCAPE_W, A4_LANDSCAPE_H, MARGIN);
    return;
  }

  let cumulativePx = 0;
  let firstPage = true;
  for (let i = 0; i < months.length; i++) {
    const m = months[i] as HTMLElement;
    const widthPx = m.offsetWidth;

    // crop: 工種列(name) + 当月の幅
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
    // 左: 工種列
    ctx.drawImage(fullCanvas, 0, 0, headerW, fullCanvas.height, 0, 0, headerW, fullCanvas.height);
    // 右: 当月分
    ctx.drawImage(fullCanvas, cropX, 0, cropW, fullCanvas.height, headerW, 0, cropW, fullCanvas.height);

    if (!firstPage || hasCover) {
      pdf.addPage('a4', 'landscape');
    }
    firstPage = false;
    placeImageOnPage(
      pdf,
      pageCanvas.toDataURL('image/png'),
      pageCanvas.width,
      pageCanvas.height,
      A4_LANDSCAPE_W,
      A4_LANDSCAPE_H,
      MARGIN
    );

    cumulativePx += widthPx;
  }
}

/** 表紙ページ生成 (A4縦) */
function addCoverPage(pdf: jsPDF, project: Project, options: PdfOptions) {
  // 1ページ目に表紙
  pdf.deletePage(1);
  pdf.addPage('a4', 'portrait');

  const pageW = A4_PORTRAIT_W;
  const pageH = A4_PORTRAIT_H;

  // 日本語表示はjsPDFでは難しいが、デフォルトフォントは英字+一部記号のみ。
  // ここでは html2canvas を使って表紙HTMLを画像化する方式が確実。
  // ただし簡易版として、英字とプロジェクト名は画像化が必要。
  // 画像化フローはこの関数の外で実施するため、placeholder的に枠だけ書いておく。

  // タイトル枠
  pdf.setDrawColor(220);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, 50, pageW - MARGIN, 50);
  pdf.line(MARGIN, pageH - 30, pageW - MARGIN, pageH - 30);

  // 日付ラベル(英字なので問題なし)
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text(`Created: ${formatDateAscii(project.createdAt)}`, MARGIN, pageH - 22);
  pdf.text(`Updated: ${formatDateAscii(project.updatedAt)}`, MARGIN, pageH - 16);
  pdf.text(`KOUTEI.app`, pageW - MARGIN - 30, pageH - 16);

  // 内容: html2canvasで日本語コンテンツを画像化して埋め込む
  // 同期関数では非同期できないので、別関数で扱う必要あり。
  // ここでは枠のみ。実コンテンツは exportWithCover() で renderCoverImage して上から貼る。
  pdf.setFontSize(11);
  pdf.text(`(See cover image overlay)`, pageW / 2 - 25, pageH / 2);
  // ↑ 実装簡略化: HTMLテンプレートをhtml2canvasで丸ごと撮る方式に切り替える
}

function formatDateAscii(iso: string): string {
  if (!iso) return '';
  return iso.slice(0, 10).replace(/-/g, '/');
}

/** 表紙HTMLテンプレートを生成し、PDFに画像として貼る */
export async function buildCoverImage(project: Project, opts: PdfOptions): Promise<{ dataUrl: string; width: number; height: number }> {
  // 仮要素を作って撮る
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
    const canvas = await html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
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

/**
 * 完全版: 表紙(画像)+ ガントチャートを統合
 */
export async function exportPDF(ganttEl: HTMLElement, project: Project, options: PdfOptions) {
  const pageW = A4_LANDSCAPE_W;
  const pageH = A4_LANDSCAPE_H;

  let pdf: jsPDF;
  if (options.mode === 'long') {
    const longW = getLongPageWidth(ganttEl);
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [longW, pageH] });
  } else {
    pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  }

  let firstPageUsed = false;

  // 表紙
  if (options.withCover) {
    const cover = await buildCoverImage(project, options);
    // 表紙はA4縦に差し替え
    pdf.deletePage(1);
    pdf.addPage('a4', 'portrait');
    placeImageOnPage(pdf, cover.dataUrl, cover.width, cover.height, A4_PORTRAIT_W, A4_PORTRAIT_H, 0);
    firstPageUsed = true;
  }

  // ガント
  if (options.mode === 'month') {
    await renderMonthSplitV2(pdf, ganttEl, firstPageUsed);
  } else {
    const { dataUrl, width, height } = await renderElementToImage(ganttEl, { scale: 2 });
    if (firstPageUsed) {
      pdf.addPage(options.mode === 'long' ? [getLongPageWidth(ganttEl), pageH] : 'a4', 'landscape');
    }
    if (options.mode === 'long') {
      const longPageW = pdf.internal.pageSize.getWidth();
      placeImageOnPage(pdf, dataUrl, width, height, longPageW, pageH, MARGIN);
    } else {
      placeImageOnPage(pdf, dataUrl, width, height, pageW, pageH, MARGIN);
    }
  }

  pdf.save(`${project.name || 'koutei'}.pdf`);
}

/** 月分割v2: hasCover考慮 */
async function renderMonthSplitV2(pdf: jsPDF, ganttEl: HTMLElement, hasCover: boolean) {
  const taskNameEl = ganttEl.querySelector('.gantt-task-name') as HTMLElement | null;
  const nameWidthPx = taskNameEl?.offsetWidth ?? 220;

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
    placeImageOnPage(pdf, fullCanvas.toDataURL('image/png'), fullCanvas.width, fullCanvas.height, A4_LANDSCAPE_W, A4_LANDSCAPE_H, MARGIN);
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
    placeImageOnPage(pdf, pageCanvas.toDataURL('image/png'), pageCanvas.width, pageCanvas.height, A4_LANDSCAPE_W, A4_LANDSCAPE_H, MARGIN);

    cumulativePx += widthPx;
  }
}

/** ガントが1枚A4横に収まるかを判定 (px比較) */
export function fitsOnA4Landscape(ganttEl: HTMLElement): boolean {
  // A4横は297mm×210mm。ピクセルで概算: 96dpi基準で 1123 x 794
  // 余白を引いて 1050 x 740 くらいに収まればOK
  const rect = ganttEl.getBoundingClientRect();
  const widthMm = pxToMm(rect.width);
  const heightMm = pxToMm(rect.height);
  return widthMm <= (A4_LANDSCAPE_W - MARGIN * 2) * 1.05 && heightMm <= (A4_LANDSCAPE_H - MARGIN * 2) * 1.05;
}
