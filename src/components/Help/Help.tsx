import './Help.css';

interface Props {
  onClose: () => void;
}

export function Help({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>使い方ガイド</span>
        </div>
        <div className="modal-body help-body">
          <section className="help-section">
            <h3>1. 工程表を作る</h3>
            <p>
              トップ画面の <span className="hl">+ 新規作成</span> から、現場名・工期を入力して工程表を作成します。
              JSONファイルがある場合は <span className="hl">JSONを開く</span> から読み込めます。
            </p>
          </section>

          <section className="help-section">
            <h3>2. 工種を追加する</h3>
            <p>
              工程表の編集画面で、ガントチャート上の <span className="hl">+ 工種を追加</span> をクリック。
              よく使う工種は <span className="hl">📋 プリセット工種</span> から1クリックで追加できます。
            </p>
            <ul>
              <li>工種名はクリックで編集</li>
              <li>左端の色チップで色を変更</li>
              <li>左端の <span className="kbd">⋮⋮</span> でドラッグ並び替え</li>
              <li>▲▼ボタンでも上下に移動</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>3. バーを引く</h3>
            <p>
              ガントチャートのセルを<strong>ドラッグ</strong>するとバーが作成されます。
              バーをクリックすると削除できます。
            </p>
            <p>1つの工種に何本でもバーを引けます (中断・再開を表現可能)。</p>
          </section>

          <section className="help-section">
            <h3>4. 表示単位を切替える</h3>
            <p>
              ツールバーの <span className="hl">日 / 半日 / 週</span> ボタンで表示単位を変更できます。
              長期工程は週表示、細かい作業は半日表示が便利です。
            </p>
          </section>

          <section className="help-section">
            <h3>5. PDF出力する</h3>
            <p>
              <span className="hl">🖨 PDF出力</span> から PDFを書き出せます。
              A4横1枚に収まらない場合は、自動的に「週圧縮 / 月分割 / 横長」のオプションが選べます。
              元請への提出時は <span className="hl">表紙ページを追加</span> をONに。
            </p>
          </section>

          <section className="help-section">
            <h3>6. 共有・保存</h3>
            <p>
              編集内容は<strong>自動でブラウザに保存</strong>されます (localStorage)。
              他のPC・他の人と共有するときは <span className="hl">📤 共有書き出し</span> から JSON
              ファイルを書き出してください。受け取った側は「JSONを開く」で読み込めます。
            </p>
            <p className="help-note">
              💡 データはサーバーに送信されません。すべてご自身のPC内で完結します。
            </p>
          </section>

          <section className="help-section">
            <h3>表示の見方</h3>
            <ul>
              <li>
                <span className="legend-swatch" style={{ background: 'var(--color-weekend-sat)' }} />{' '}
                土曜日
              </li>
              <li>
                <span className="legend-swatch" style={{ background: 'var(--color-weekend-sun)' }} />{' '}
                日曜日・祝日
              </li>
              <li>
                <span className="legend-line" /> 当日 (本日の日付)
              </li>
            </ul>
          </section>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
