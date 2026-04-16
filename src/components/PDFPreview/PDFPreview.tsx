import { useEffect, useState } from 'react';
import type { Project } from '../../types';
import { exportPDF, fitsOnA4Landscape, type PdfOptions } from '../../utils/pdf';
import './PDFPreview.css';

interface Props {
  project: Project;
  ganttEl: HTMLElement | null;
  onClose: () => void;
}

type Mode = PdfOptions['mode'];

export function PDFPreview({ project, ganttEl, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('fit');
  const [withCover, setWithCover] = useState(false);
  const [selfCompany, setSelfCompany] = useState('');
  const [assignee, setAssignee] = useState('');
  const [exporting, setExporting] = useState(false);
  const [fits, setFits] = useState(true);

  useEffect(() => {
    if (ganttEl) setFits(fitsOnA4Landscape(ganttEl));
  }, [ganttEl]);

  const handleDownload = async () => {
    if (!ganttEl) {
      alert('ガントチャートが見つかりません');
      return;
    }
    setExporting(true);
    try {
      await exportPDF(ganttEl, project, {
        mode,
        withCover,
        selfCompany: selfCompany || undefined,
        assignee: assignee || undefined,
      });
      onClose();
    } catch (e) {
      alert('PDF生成に失敗しました: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pdf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">PDF出力プレビュー</div>
        <div className="modal-body pdf-body">
          {/* 収まり判定 */}
          <div className={'pdf-fit-status ' + (fits ? 'is-ok' : 'is-overflow')}>
            {fits ? (
              <>
                <strong>✓ A4横1枚に収まります。</strong>
                <span>そのまま出力できます。</span>
              </>
            ) : (
              <>
                <strong>⚠ A4横1枚に収まりません。</strong>
                <span>出力モードを選んでください。</span>
              </>
            )}
          </div>

          {/* モード選択 */}
          {!fits && (
            <div className="pdf-options">
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
                    画面が日単位でも、PDF出力時だけ週単位に変換して1枚にまとめます。全体俯瞰向け。
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
                    日単位のまま、月で改ページして複数枚に分けます。各ページに工種リストを再掲載。
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
                    A4高さで横幅のみ延長します。画面閲覧用。印刷には不向き。
                  </div>
                </div>
              </label>
            </div>
          )}

          {fits && (
            <div className="pdf-options">
              <label className="pdf-option is-default">
                <input type="radio" name="mode" checked={mode === 'fit'} onChange={() => setMode('fit')} />
                <div>
                  <div className="pdf-option-title">A4横 1枚で出力</div>
                </div>
              </label>
            </div>
          )}

          {/* 表紙オプション */}
          <div className="pdf-cover-section">
            <label className="pdf-cover-toggle">
              <input
                type="checkbox"
                checked={withCover}
                onChange={(e) => setWithCover(e.target.checked)}
              />
              <span>表紙ページを追加(A4縦)</span>
            </label>

            {withCover && (
              <div className="pdf-cover-fields">
                <div>
                  <label className="label">自社名</label>
                  <input
                    className="input"
                    value={selfCompany}
                    onChange={(e) => setSelfCompany(e.target.value)}
                    placeholder="例: ○○建設"
                  />
                </div>
                <div>
                  <label className="label">担当者名</label>
                  <input
                    className="input"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="例: 山田 太郎"
                  />
                </div>
                <div className="pdf-cover-hint">
                  表紙には現場名・元請会社・工期・備考が自動的に入ります。
                </div>
              </div>
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
