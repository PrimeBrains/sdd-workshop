// health — two zones (R-S5/R-C2): 現行進捗 vs 累積稼得. EV% is always paired with
// estimateCoverage; SPI with scheduleCoverage (de-rated). null SPI/CPI are shown
// "算出不能", never potted to 1.0/0. Trend is a single asOf point (valid-time c
// blocker, §0 #3). Fever is a provisional empty state (CCPM not in canon, §0 #4).

import { EVM } from '../../theme/tokens';
import { Bar, Card, Pill, SectionTitle, SummaryStat } from '../../theme/atoms';
import { useDerived } from '../../moira/hooks';

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
const idx = (v: number | null) => (v === null ? '算出不能' : v.toFixed(2));
const signed = (v: number) => (v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0));
const varTone = (v: number): 'crit' | 'ok' | 'neutral' =>
  v < 0 ? 'crit' : v > 0 ? 'ok' : 'neutral';

export function HealthSurface() {
  const d = useDerived();
  const covLow = d.estimateCoverage < 0.999;
  const schedLow = d.scheduleCoverage < 0.999;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 920 }}>
      {/* zone 1 — current progress */}
      <Card>
        <SectionTitle hint="現行有効集合（supersede/cancel 除外）">現行進捗</SectionTitle>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SummaryStat label="EV%" value={pct(d.evPercent, 1)} tone="brand" big sub={`見積カバレッジ ${pct(d.estimateCoverage)}`} />
            <div style={{ width: 150 }}>
              <Bar value={d.estimateCoverage} tone="brand" derate={covLow} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <SummaryStat label="SPI" value={idx(d.spi)} sub={`スケジュールカバレッジ ${pct(d.scheduleCoverage)}`} />
            <div style={{ width: 150 }}>
              <Bar value={d.scheduleCoverage} tone="ok" derate={schedLow} />
            </div>
          </div>
          <SummaryStat label="CPI" value={idx(d.cpi)} />
          <SummaryStat label="EV_abs (MD)" value={d.evAbs.toFixed(0)} />
          <SummaryStat label="PV (MD)" value={d.pv.toFixed(0)} />
          <SummaryStat label="AC (MD)" value={d.ac.toFixed(0)} />
          <SummaryStat label="SV (MD)" value={signed(d.evAbs - d.pv)} tone={varTone(d.evAbs - d.pv)} />
          <SummaryStat label="CV (MD)" value={signed(d.evAbs - d.ac)} tone={varTone(d.evAbs - d.ac)} />
        </div>
        <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 8 }}>
          EV%↔見積カバレッジ／SPI↔スケジュールカバレッジを常に対表示。低カバレッジは斜線ハッチで de-rate（R-S4/R-S6）。
          SPI＝スケジュール済み領域内の進捗率（全体進捗ではない）。SPI/CPI は PV/AC=0 のとき「算出不能」（潰さない）。
          SV＝EV−PV／CV＝EV−AC は提示恒等式（正典指標ではない）。SV はスケジュール済み領域のみを覆うため
          スケジュールカバレッジと対で読む（SPI と同規律）。CV は仕掛コストで悲観側に振れる（CPI と同性質）。
        </div>
      </Card>

      {/* zone 2 — cumulative earned */}
      <Card style={{ background: EVM.paperWarm }}>
        <SectionTitle hint="supersede 込・cancelled（サンク）除外">累積稼得（履歴）</SectionTitle>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
          <SummaryStat label="累積 EV_abs (MD)" value={d.cumulativeEvAbs.toFixed(0)} tone="neutral" />
          <SummaryStat label="現行 EV_abs (MD)" value={d.evAbs.toFixed(0)} tone="neutral" />
          <div style={{ alignSelf: 'center', fontSize: 11, color: EVM.ink3, maxWidth: 360 }}>
            差分 {(d.cumulativeEvAbs - d.evAbs).toFixed(0)} MD は supersede された旧ノードの稼得（働いた事実は残す）。
            サンク（cancelled）は backend が除外（別系列は拡張依存）。
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* SPI/CPI trend (blocked → single point) */}
        <Card style={{ flex: '1 1 320px' }}>
          <SectionTitle hint={<Pill tone="na">履歴は valid-time c 実装後</Pill>}>SPI / CPI 推移</SectionTitle>
          <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
            <SummaryStat label={`SPI @ ${d.asOf}`} value={idx(d.spi)} />
            <SummaryStat label={`CPI @ ${d.asOf}`} value={idx(d.cpi)} />
          </div>
          <div style={{ fontSize: 10.5, color: EVM.ink3, marginTop: 8 }}>
            単一 asOf の実点のみ表示。過去点は valid-time c lookup（現 backend に無し・§0 #3）の実装後に
            実点直線連結（spline 補間禁止）へ昇格。捏造した曲線は描きません。
          </div>
        </Card>

        {/* Fever (provisional / empty) */}
        <Card style={{ flex: '1 1 320px', background: EVM.paperWarm }}>
          <SectionTitle hint={<Pill tone="na">CCPM 暫定 — MODEL v14 未確定</Pill>}>CCPM フィーバー</SectionTitle>
          <div
            style={{
              border: `1px dashed ${EVM.rule}`,
              borderRadius: 8,
              padding: '22px 14px',
              textAlign: 'center',
              color: EVM.ink4,
              fontSize: 12,
            }}
          >
            CCPM 導出（buffer/fever/critical chain）は正典未確定のため未供給。
            <br />
            ダミーは描きません。正典化後に provisional 専用ソースから供給します（§0 #4）。
          </div>
        </Card>
      </div>
    </div>
  );
}
