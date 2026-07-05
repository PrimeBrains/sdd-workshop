// 案件並置 — one row per project, each cell coming from THAT project's own
// independent derivation (issue #23). Cross-project accounting is deliberately
// NOT synthesized: EV%/SPI/CPI have per-project BACs and units, and a weighting
// scheme would be a discretionary knob Moira's canon refuses to hold — only
// unit-safe COUNTS are totalled. loadError homes stay visible error rows.

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
  const { projects } = usePortfolio();
  const ok = projects.flatMap((p) => (p.kind === 'ok' ? [p.data] : []));
  const errors = projects.flatMap((p) => (p.kind === 'error' ? [p.error] : []));

  const totalReviewWait = ok.reduce((s, d) => s + d.derived.humanReviewQueue.length, 0);
  const totalStructural = ok.reduce((s, d) => s + d.derived.structuralErrors.length, 0);

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>案件並置</div>
      <div style={{ fontSize: 11.5, color: EVM.ink3, marginBottom: 12, lineHeight: 1.6 }}>
        各行はその案件の home を単独で導出した値 —
        その案件を単独ダッシュボードで開いたときと同じ数値です。横断の合成会計は行いません（D-50）。
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
              合計（件数のみ）
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
        EV%・SPI・CPI は案件ごとに BAC も単位も異なるため合成しません（重み付けは正典に持たない裁量パラメータ）。
        合計するのは単位安全な件数のみ。SPI はスケジュールカバレッジとの対読み（cov 表示は 1.0 未満のときのみ）。
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
