// Drift report renderers — stable JSON for machines (hooks / CI), Japanese
// text for humans (matches the guard/skill language; stdout=data convention).

import type { DriftReport, NodeDrift, SuggestedCommand } from './types.js';
import { byActionability } from './core.js';

export function renderJson(report: DriftReport): string {
  return JSON.stringify(report, null, 2);
}

const STATUS_MARK: Record<NodeDrift['status'], string> = {
  'missing-node': '✗',
  behind: '✗',
  'needs-human': '⚑',
  ahead: '↥',
  cancelled: '⊘',
  'unknown-node': '?',
  ok: '✓',
};

export function renderText(report: DriftReport): string {
  const lines: string[] = [];
  lines.push(
    `Moira drift — projectRoot: ${report.projectRoot} / provider: ${report.provider} / adapter v${report.adapterVersion}`,
  );
  for (const f of report.features) {
    lines.push('');
    lines.push(`━━ ${f.feature}  (${f.sourcePath}, phase: ${f.sourcePhase})`);
    if (f.parseError !== undefined) {
      lines.push(`  ⚠ ${f.parseError}`);
      continue;
    }
    const visible = [...f.nodes].sort(byActionability);
    const okCount = visible.filter((n) => n.status === 'ok').length;
    for (const n of visible) {
      if (n.status === 'ok') continue;
      lines.push(...renderNode(n));
    }
    if (okCount > 0) lines.push(`  ✓ ok ${okCount} 件`);
    if (visible.length === okCount) lines.push('  （drift なし）');
    for (const step of f.nextSteps) lines.push(`  ▷ 次の一手: ${step}`);
  }
  if (report.unknownNodes.length > 0) {
    lines.push('');
    lines.push('━━ 期待空間外のノード');
    for (const n of report.unknownNodes) lines.push(...renderNode(n));
  }
  if (report.skipped.features.length > 0 || report.skipped.nodes.length > 0) {
    lines.push('');
    lines.push(
      `（ignore 済み: features [${report.skipped.features.join(', ')}] / nodes [${report.skipped.nodes.join(', ')}]）`,
    );
  }
  const s = report.summary;
  lines.push('');
  lines.push(`Summary: hard ${s.hard} / needs-human ${s.needsHuman} / advisory ${s.advisory} / ok ${s.ok}`);
  if (s.hard + s.needsHuman > 0) {
    lines.push(
      'ヒント: 追いつき記録は /moira-track sync（人間ゲート付きで振り付け・drift 自体は emit しない）。誤検知は .moira/adapter.json の ignoreFeatures/ignoreNodes。',
    );
  }
  return lines.join('\n');
}

function renderNode(n: NodeDrift): string[] {
  const lines: string[] = [];
  const actual =
    n.actual === null
      ? 'なし'
      : `${n.actual.lifecycle}/${n.actual.estimate}` +
        `${n.actual.assignee === null ? '・未割当' : ''}${n.actual.frozenSlot === null ? '・slot なし' : ''}`;
  const expected =
    n.expected.minLifecycle === null
      ? n.expected.exists
        ? '存在'
        : '—'
      : `≥${n.expected.minLifecycle}`;
  lines.push(
    `  ${STATUS_MARK[n.status]} ${n.status} [${n.severity}] ${n.node} — 期待 ${expected} / 実際 ${actual}`,
  );
  lines.push(`      根拠: ${n.evidence}`);
  for (const c of n.suggested) lines.push(`      → ${renderCommand(c)}`);
  return lines;
}

function renderCommand(c: SuggestedCommand): string {
  const gate =
    c.humanGate === null
      ? ''
      : c.humanGate === 'measure'
        ? ' # 実測値のみ'
        : ` # [人間確認] ${c.humanGate}`;
  return `${c.argv.join(' ')}${gate}${c.note === '' ? '' : `   … ${c.note}`}`;
}
