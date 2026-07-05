// 案件並置 — one row per project, each cell coming from THAT project's own
// independent derivation (issue #23). Cross-project accounting is deliberately
// NOT synthesized: the unit (attention-time MD, A6 single currency) IS common
// across projects so a Σ would be dimensionally possible — we decline it as a
// design judgment (aggregation hides per-project variance; presentation-layer
// knob proliferation, D-73/ADR-0005). Only COUNTS are totalled (readable
// projects only, granularity caveat). loadError homes stay visible error rows.

import { EVM } from '../../theme/tokens';
import { usePortfolio } from '../../moira/hooks';
import type { PortfolioProjectData } from '../../moira/portfolio-context';
import { bufferCell, fmtIndex, fmtPct, type CellTone } from './portfolio-format';

const toneColor: Record<CellTone, string> = {
  ok: EVM.ink,
  crit: EVM.crit,
  na: EVM.na,
  neutral: EVM.ink3,
};

const th: React.CSSProperties = {
  textAlign: 'right',
  fontSize: 11,
  color: EVM.ink3,
  fontWeight: 500,
  padding: '6px 10px',
  borderBottom: `1px solid ${EVM.rule}`,
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  textAlign: 'right',
  fontSize: 12.5,
  fontFamily: EVM.fontMono,
  padding: '7px 10px',
  borderBottom: `1px solid ${EVM.ruleSoft}`,
  whiteSpace: 'nowrap',
};

export function PortfolioOverview({ onOpenProject }: { onOpenProject: (key: string) => void }) {
  const { projects, asOf } = usePortfolio();
  const ok = projects.flatMap((p) => (p.kind === 'ok' ? [p.data] : []));
  const errors = projects.flatMap((p) => (p.kind === 'error' ? [p.error] : []));

  const totalReviewWait = ok.reduce((s, d) => s + d.derived.humanReviewQueue.length, 0);
  const totalStructural = ok.reduce((s, d) => s + d.derived.structuralErrors.length, 0);

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>案件並置</div>
      <div style={{ fontSize: 11.5, color: EVM.ink3, marginBottom: 12, lineHeight: 1.6 }}>
        各行はその案件の home を統一基準日 {asOf} で独立に導出した値 —
        同じ基準日で単独ダッシュボードを開いたときと同じ数値です（案件自身の config.asOf
        とは基準日が異なり得ます）。横断の合成会計は行いません（D-50）。
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', background: EVM.card, borderRadius: 8 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>案件</th>
            <th style={th}>EV%</th>
            <th style={th}>見積カバレッジ</th>
            <th style={th}>SPI</th>
            <th style={th}>CPI</th>
            <th style={th}>バッファ残</th>
            <th style={th}>レビュー待ち</th>
            <th style={th}>構造エラー</th>
            <th style={{ ...th, textAlign: 'center' }} />
          </tr>
        </thead>
        <tbody>
          {ok.map((d, i) => (
            <ProjectRow key={d.key} d={d} index={i} onOpen={() => onOpenProject(d.key)} />
          ))}
          {errors.map((e) => (
            <tr key={e.key} data-testid="portfolio-error-row">
              <td style={{ ...td, textAlign: 'left', fontFamily: EVM.font, color: EVM.crit, fontWeight: 600 }}>
                {e.label}
              </td>
              <td colSpan={8} style={{ ...td, textAlign: 'left', fontFamily: EVM.font, color: EVM.crit }}>
                読込エラー: {e.loadError}
              </td>
            </tr>
          ))}
          <tr data-testid="portfolio-total-row">
            <td style={{ ...td, textAlign: 'left', fontFamily: EVM.font, fontWeight: 600, borderBottom: 'none' }}>
              合計（読めた{ok.length}案件・件数のみ）
            </td>
            <td style={{ ...td, color: EVM.ink4, borderBottom: 'none' }}>—</td>
            <td style={{ ...td, color: EVM.ink4, borderBottom: 'none' }}>—</td>
            <td style={{ ...td, color: EVM.ink4, borderBottom: 'none' }}>—</td>
            <td style={{ ...td, color: EVM.ink4, borderBottom: 'none' }}>—</td>
            <td style={{ ...td, color: EVM.ink4, borderBottom: 'none' }}>—</td>
            <td style={{ ...td, fontWeight: 600, borderBottom: 'none' }}>{totalReviewWait}件</td>
            <td style={{ ...td, fontWeight: 600, borderBottom: 'none' }}>{totalStructural}件</td>
            <td style={{ borderBottom: 'none' }} />
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 10.5, color: EVM.ink4, marginTop: 10, lineHeight: 1.7 }}>
        EV%・SPI・CPI の横断合成は出しません — 単位（アテンション時間 MD）は全案件共通で Σ は計算可能ですが、
        集約は案件間の分散（危機案件）を平均で隠すため採らない設計判断です（D-73）。
        合計は読めた案件のみの件数の和（レビュー待ち・構造エラー）で、件数はノード分解の粒度
        （案件ごとの人間裁量）に依存するため案件間の比較には向きません。
        SPI はスケジュールカバレッジとの対読み（cov 表示は 1.0 未満のときのみ）。
        レビュー待ちの最古経過日数は「人間ゲート待ち」計器の導入時に追加予定（現状は件数のみ）。
      </div>
    </div>
  );
}

function ProjectRow({ d, index, onOpen }: { d: PortfolioProjectData; index: number; onOpen: () => void }) {
  const buf = bufferCell(d.landing, d.deadline);
  const cov = d.derived.spiScheduleCoverage;
  return (
    <tr data-testid={`portfolio-row:${index}`}>
      <td style={{ ...td, textAlign: 'left', fontFamily: EVM.font, fontWeight: 600 }}>
        <button
          onClick={onOpen}
          data-testid={`portfolio-open:${index}`}
          style={{
            border: 'none',
            background: 'transparent',
            color: EVM.brandDeep,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          {d.label}
        </button>
      </td>
      <td style={td}>{fmtPct(d.derived.evPercent)}</td>
      <td style={td}>{fmtPct(d.derived.estimateCoverage)}</td>
      <td style={td}>
        {fmtIndex(d.derived.spi)}
        {d.derived.spi !== null && cov < 1 && (
          <span style={{ color: EVM.ink4, fontSize: 10 }}> (cov {fmtPct(cov)})</span>
        )}
      </td>
      <td style={td}>{fmtIndex(d.derived.cpi)}</td>
      <td style={{ ...td, color: toneColor[buf.tone] }}>{buf.text}</td>
      <td style={td}>{d.derived.humanReviewQueue.length}件</td>
      <td style={{ ...td, color: d.derived.structuralErrors.length > 0 ? EVM.crit : EVM.ink }}>
        {d.derived.structuralErrors.length}件
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <button
          onClick={onOpen}
          style={{
            border: `1px solid ${EVM.rule}`,
            borderRadius: 6,
            background: EVM.paperWarm,
            fontSize: 11,
            padding: '3px 10px',
            cursor: 'pointer',
            color: EVM.ink2,
          }}
        >
          開く →
        </button>
      </td>
    </tr>
  );
}
