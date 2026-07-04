// Deterministic renderers for CUSTOM (non-default) providers — ADR-0003 Stage 2.
//
// A default install ships the frozen cc-sdd canon documents verbatim (bundled
// templates — nothing is generated, doc-refine discipline intact). When a
// custom provider config is installed (`moira adapter install --provider …`),
// the cc-sdd prose would be WRONG for that repo, so these renderers produce a
// provider-reference.md and a steering trigger table from the config itself:
// everything the config declares is rendered; everything it CANNOT declare
// (the per-milestone emit choreography) is marked honestly as to-be-authored
// (the Stage 3 generator skill's job) instead of silently inheriting cc-sdd
// wording. Pure string functions — same config, same bytes.

import type { ProviderConfig } from './provider-config.js';

const MANAGED_NOTE = `> **managed file**: この文書は \`moira adapter install\` が設置する配布物。手で編集すると
> 次回 install で skip される（\`moira adapter status\` 参照）。この内容は provider 設定
> （\`.claude/moira-provider.json\`）から決定的にレンダリングされた。`;

function title(cfg: ProviderConfig): string {
  return cfg.displayName !== undefined ? `${cfg.displayName}（id: ${cfg.id}）` : cfg.id;
}

function triggerRows(cfg: ProviderConfig): string {
  const rows: string[] = [];
  for (const t of cfg.triggers) {
    const phases = [...new Set(t.advise.map((a) => a.phase))];
    rows.push(`| \`${t.pathPattern}\`（read: ${t.read}） | ${phases.map((p) => `\`/moira-track ${p}\``).join(' / ')} |`);
  }
  if (rows.length === 0) rows.push('| （triggers 未宣言 — 発火検知なし。規約と sync が防衛線） | — |');
  return rows.join('\n');
}

export function renderProviderReference(cfg: ProviderConfig): string {
  const lines: string[] = [];
  lines.push(`# moira-track provider リファレンス — ${title(cfg)}`);
  lines.push('');
  lines.push(MANAGED_NOTE);
  lines.push('');
  lines.push(
    '**provider（方法論）固有**の参照。エンジン汎用の規律（着手ゲート・AC・地雷・復旧・接地表）は' +
      ' [`reference.md`](reference.md)、運用の中核は [`SKILL.md`](SKILL.md)。',
  );
  lines.push('');
  lines.push(
    '> **節番号の規約**: §P1（ノード ID）・§P2（フェーズ振り付け）・§P3（発火トリガー）・§P4（drift 契約）は' +
      'どの provider 版にも共通。§P5（背骨弧）は cc-sdd 版のみの拡張節で、この生成版には無い。',
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## §P1 ノード ID・フィーチャー解決');
  lines.push('');
  lines.push('- **プロジェクト根** = `.moira/config.json` の `projectRoot`（以下 `<root>`）。フィーチャーの親。');
  lines.push('- **フィーチャーノード** = `<feature>`（この provider の作業単位名。親は `<root>`）。');
  if (cfg.nodeScheme !== undefined) {
    lines.push('- **フェーズ子ノード**（`<feature>/<suffix>`）:');
    lines.push('');
    lines.push('| suffix | ラベル |');
    lines.push('|---|---|');
    for (const c of cfg.nodeScheme.phaseChildren) lines.push(`| \`${c.suffix}\` | ${c.label} |`);
    lines.push('');
    if (cfg.nodeScheme.implPrefix !== undefined) {
      lines.push(`- **実装ノード** = \`<feature>/${cfg.nodeScheme.implPrefix}1\` …（個数＝分解の深さは人間判断④）。`);
    }
    if (cfg.nodeScheme.reviewNode !== undefined) {
      lines.push(`- **実装レビュー** = \`<feature>/${cfg.nodeScheme.reviewNode}\`（見積を持つ通常の作業ノード＝EV を獲得する）。`);
    }
  } else {
    lines.push('- フェーズ子ノードのスキームは**未宣言**（nodeScheme なし） — ノード分解はプロジェクトの裁量（人間判断④）。');
  }
  if (cfg.scope !== undefined && cfg.scope.claim.length > 0) {
    lines.push(`- **この作業リポジトリが主張する feature 空間**（multi-repo）: ${cfg.scope.claim.map((c) => `\`${c}\``).join(', ')}。`);
  }
  lines.push('- `<feature>` の決定: `--feature` 引数 → 成果物からの推定 → **複数候補なら勝手に選ばず `[人間確認]`**。');
  lines.push('- ラベル（`--label`）は表示専用（`.moira/labels.json`）でイベントには載らない（MODEL 外）。');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## §P2 フェーズ → moira CLI マッピング（振り付け）');
  lines.push('');
  lines.push(`この provider の phases: ${cfg.phases.map((p) => `\`${p}\``).join(' → ')}`);
  lines.push('');
  lines.push('> **⚠ 未著**: 各フェーズの具体的な emit 列（どの節目で `add`/`agree`/`start`/`done`/`cost`/`accept` を打つか）は');
  lines.push('> この設定からは導出できない — **プロジェクト固有の振り付けとしてここに書き足すこと**');
  lines.push('> （`moira-adapter-gen` スキルのインタビューが生成する — ADR-0003 Stage 3）。');
  lines.push('> それまでの普遍則: 誕生は未見積 `add --parent`、見積は 提案(add --estimate)→`[人間確認]`→`agree`、');
  lines.push('> 着手は**着手ゲート**（[reference §C](reference.md)）充足後の `start`、完了は `done`＋**実測 `cost`**、承認は `accept`。');
  lines.push('> 5 判断（見積合意・割当・容量・スコープ/期日・見積深さ）は必ず `[人間確認]`。');
  lines.push('');
  if (cfg.edges !== undefined && cfg.edges.length > 0) {
    lines.push('### 標準依存辺（suffix レベル）');
    lines.push('');
    lines.push('| from | to | policy |');
    lines.push('|---|---|---|');
    for (const e of cfg.edges) lines.push(`| \`${e.from}\` | \`${e.to}\` | \`${e.policy}\` |`);
    lines.push('');
    lines.push('（`moira relate <feature>/<from> <feature>/<to> --kind dependency --policy <policy>`。policy は常に明示。）');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## §P3 発火トリガー（機械可読設定の写し）');
  lines.push('');
  lines.push('| 成果物パターン | 発火 |');
  lines.push('|---|---|');
  lines.push(triggerRows(cfg));
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## §P4 drift 突き合わせ契約');
  lines.push('');
  switch (cfg.drift.mode) {
    case 'builtin':
      lines.push(
        `- drift はコード provider \`${cfg.drift.builtin}\` に委譲される（突き合わせの意味論は` +
          ` CLI 実装 \`providers/${cfg.drift.builtin}.ts\` が持つ — 人間可読の契約表はこの install には同梱されない）。`,
      );
      break;
    case 'presence': {
      lines.push('- drift モード: **presence（存在検知のみ）** — 成果物の存在からノードの**存在**だけを期待する。');
      lines.push('  進捗（lifecycle）・承認は成果物から導出**しない**（正直な最小形 — 見えないものは主張しない）。');
      lines.push('');
      lines.push('| 成果物（scanDir 配下・正規表現） | 期待（存在すべきノード） |');
      lines.push('|---|---|');
      for (const r of cfg.drift.rules) {
        lines.push(`| \`${r.scanDir}/\` 内の \`${r.pathPattern}\` | ${r.expectNodes.map((n) => `\`${n.node}\``).join('・')} |`);
      }
      lines.push('');
      lines.push('- 見積・合意・担当・slot・実測 AC は導出不能 → 提案はプレースホルダ（drift は捏造しない）。');
      break;
    }
    case 'unsupported':
      lines.push('- drift モード: **unsupported** — この provider は成果物→ノード状態の対応を宣言していないため、');
      lines.push('  `moira adapter drift` は**明示エラー**になる（存在しない突き合わせを捏造しない）。');
      lines.push('  防衛線は steering の発火規約と hooks の検知のみ。`sync` フェーズは使えない。');
      break;
  }
  lines.push('');
  return lines.join('\n');
}

export function renderSteering(cfg: ProviderConfig): string {
  const lines: string[] = [];
  lines.push(`# Moira トラッキング規約（${title(cfg)} → Moira アダプタ）`);
  lines.push('');
  lines.push(MANAGED_NOTE);
  lines.push('');
  lines.push(`このプロジェクトには ${title(cfg)} → Moira アダプタがインストールされている。`);
  lines.push('**方法論の各節目で、必ず `/moira-track <phase>` を呼んで Moira に記録すること。**');
  lines.push('マッピングと emit の詳細は `.claude/skills/moira-track/`（SKILL.md / provider-reference.md / reference.md）が持つ。');
  lines.push('');
  lines.push('## 発火トリガー（これを見たら必ず打つ・発火漏れ防止）');
  lines.push('');
  lines.push('打鍵は **Claude の責務**（ユーザーは叩かない）。次の「きっかけ」を見たら、対応する発火を**飛ばさない**:');
  lines.push('');
  lines.push('| きっかけ（トリガー） | 必ず発火するもの | 柵 |');
  lines.push('|---|---|---|');
  lines.push('| 方法論の節目に到達（下の対応表の各行） | 対応する `/moira-track <phase>` | 🔔 moira-fire hook が provider 設定の triggers で検知して助言 |');
  lines.push('| セッション開始時に **Moira drift 検知**が注入された | `/moira-track sync`（成果物との突き合わせ・追いつき） | 🔔 moira-fire hook（SessionStart） |');
  lines.push('| `moira add` を打つ | **必ず `--parent <正しい親>`**（明示が最も誤解が無い） | 🔒 moira-guard hook が deny |');
  lines.push('| ノードを **start する前** | **着手ゲート**: 見積 agreed＋担当＋着手予定日(slot) を確認。未充足なら 見積合意 → `moira assign --slot` を先に | 🔔 moira-guard hook |');
  lines.push('| `moira assign` を打つ | assign は lifecycle を **ready へ戻す**。**完了済み(accepted 等)に assign しない**・baseline は着手前 | 🔔 moira-guard hook |');
  lines.push('| ノードを **done した直後** | **AC 記録**: `moira cost <node> <実工数md>`（実測・捏造しない・累積加算） | 🔔 moira-guard hook |');
  lines.push('| moira に **イベントを追記した後** | 稼働中の `moira ui` に**自動反映**される（見えなければブラウザをリロード・再起動不要） | 🔔 moira-guard hook |');
  lines.push('| **5 人間判断**に触れる（見積合意・割当・容量・スコープ/期日・見積深さ） | emit 前に**人間へ確認**（`moira agree` は human 記録＝無断 AI 実行は人間の確約を偽装。`--actor agent:*` は fold が拒否） | — |');
  lines.push('');
  lines.push('> 🔒 = `.claude/hooks/moira-guard.mjs` が **deny で強制**（`--parent` 無し add の1件のみ）／');
  lines.push('> 🔔 = additionalContext で**助言**（無視可能ゆえ正しさの最終責任はスキル側。hooks はセーフティネット）。');
  lines.push('');
  lines.push('## 節目 → 発火の対応表（provider 設定から生成）');
  lines.push('');
  lines.push('| 成果物の節目（トリガーパターン） | 呼ぶもの |');
  lines.push('|---|---|');
  lines.push(triggerRows(cfg));
  lines.push('| 発火の取りこぼしが疑わしい／drift 警告を見た | `/moira-track sync` |');
  lines.push('');
  lines.push('- **5 つの人間判断**は `moira-track` が**確認を取ってから** emit する。');
  lines.push('- いつでも `moira show`（ターミナル）／`moira ui`（ブラウザ）／`moira adapter drift`（成果物との突き合わせ・read-only）で現状を確認できる。');
  lines.push('');
  return lines.join('\n');
}
