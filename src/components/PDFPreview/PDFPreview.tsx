import { useMemo, useState } from 'react';
import type { Project } from '../../types';
import { exportPDF, type PdfOptions } from '../../utils/pdf';
import { detectFit } from '../../utils/pdfLayout';
import { A4Preview } from './A4Preview';
import './PDFPreview.css';

interface Props {
  project: Project;
  ganttEl: HTMLElement | null;
  onClose: () => void;
}

type Mode = PdfOptions['mode'];

const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const MARGIN_MM = 8;

export function PDFPreview({ project, ganttEl, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('fit');
  const [autoBalance, setAutoBalance] = useState(true);
  const [exporting, setExporting] = useState(false);

  // 収まり判定
  const fit = useMemo(() => {
    if (!ganttEl) return null;
    return detectFit({
      chartW_px: ganttEl.scrollWidth,
      chartH_px: ganttEl.scrollHeight,
      pageW_mm: PAGE_W_MM,
      pageH_mm: PAGE_H_MM,
      margin_mm: MARGIN_MM,
      autoBalance: false,
    });
  }, [ganttEl]);

  const handleDownload = async () => {
    if (!ganttEl) {
      alert('印刷エリアが見つかりません');
      return;
    }
    setExporting(true);
    try {
      await exportPDF(ganttEl, project, {
        mode,
        autoBalance,
        marginMm: MARGIN_MM,
      });
      onClose();
    } catch (e) {
      alert('PDF生成に失敗しました: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const fitsOnPage = fit?.fitsWithoutStretch ?? true;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pdf-modal pdf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">PDF出力プレビュー</div>
        <div className="modal-body pdf-body-wide">
          {/* === 左側: 設定 === */}
          <div className="pdf-settings">
            {/* 収まり判定 */}
            <div className={'pdf-fit-status ' + (fitsOnPage ? 'is-ok' : 'is-overflow')}>
              {fitsOnPage ? (
                <>
                  <strong>✓ A4横1枚に収まります</strong>
                  <span>
                    {fit && fit.whitespaceRatio > 0.3
                      ? `余白が約${Math.round(fit.whitespaceRatio * 100)}%。「自動バランス調整」で見栄えが良くなります。`
                      : 'バランスよく配置されます。'}
                  </span>
                </>
              ) : (
                <>
                  <strong>⚠ A4横1枚に収まりません</strong>
                  <span>下から出力モードを選んでください。</span>
                </>
              )}
            </div>

            {/* 自動バランス */}
            <label className="pdf-toggle">
              <input
                type="checkbox"
                checked={autoBalance}
                onChange={(e) => setAutoBalance(e.target.checked)}
              />
              <div>
                <div className="pdf-toggle-title">余白を自動調整(推奨)</div>
                <div className="pdf-toggle-desc">
                  情報量が少ない時、最大30%まで広げて余白を減らします。
                </div>
              </div>
            </label>

            {/* モード選択 (収まらない時のみ) */}
            {!fitsOnPage && (
              <div className="pdf-options">
                <div className="pdf-options-label">出力モード</div>
                <label className="pdf-option">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'fit'}
                    onChange={() => setMode('fit')}
                  />
                  <div>
                    <div className="pdf-option-title">そのまま縮小して1枚</div>
                    <div className="pdf-option-desc">
                      アスペクト比保持で縮小。文字が小さくなる場合あり。
                    </div>
                  </div>
                </label>
                <label className="pdf-option">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'week'}
                    onChange={() => setMode('week')}
                  />
                  <div>
                    <div className="pdf-option-title">A. 週単位に圧縮して1枚</div>
                    <div className="pdf-option-desc">
                      日表示でも週単位で出力。全体俯瞰向け。
                    </div>
                  </div>
                </label>
                <label className="pdf-option">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'month'}
                    onChange={() => setMode('month')}
                  />
                  <div>
                    <div className="pdf-option-title">B. 月ごとに分割して複数ページ</div>
                    <div className="pdf-option-desc">
                      日単位のまま月で改ページ。各ページに工種列を再掲。
                    </div>
                  </div>
                </label>
                <label className="pdf-option">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'long'}
                    onChange={() => setMode('long')}
                  />
                  <div>
                    <div className="pdf-option-title">C. 横長PDF (非推奨)</div>
                    <div className="pdf-option-desc">
                      A4高さで横幅延長。画面閲覧用、印刷不向き。
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* === 右側: A4実物大プレビュー === */}
          <div className="pdf-preview-pane">
            <div className="pdf-preview-label">印刷プレビュー (A4横)</div>
            {ganttEl ? (
              <A4Preview
                ganttEl={ganttEl}
                autoBalance={autoBalance}
                pageW_mm={PAGE_W_MM}
                pageH_mm={PAGE_H_MM}
                margin_mm={MARGIN_MM}
              />
            ) : (
              <div className="pdf-preview-empty">プレビュー読み込み中…</div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={exporting}>
            キャンセル
          </button>
          <button className="btn btn-primary" onClick={handleDownload} disabled={exporting}>
            {exporting ? '生成中…' : '⬇ PDFをダウンロード'}
          </button>
        </div>
      </div>
    </div>
  );
}
