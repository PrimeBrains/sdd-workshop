// Terminal rendering of a derived snapshot — the pair-read header (mirrors
// backend/src/read/snapshot-cli.ts) plus a labelled node table. Pure: takes the
// DerivedState and a label resolver, returns a string.

import type { DerivedState } from 'moira-backend';

export function fmt(n: number | null): string {
  return n === null ? 'n/a' : n.toFixed(2);
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

/**
 * The pair-read header block (EV%↔estimate coverage, SPI↔schedule coverage,
 * absolutes, queues) — shared verbatim between `moira show` and `moira report`
 * so the digest can never quote SPI/EV% detached from its coverage (R-S4/R-S6).
 */
export function pairReadLines(d: DerivedState, labelOf: (id: string) => string): string[] {
  return [
    `  EV%  ${pct(d.evPercent)} | estimate coverage ${pct(d.estimateCoverage)}   (pair-read R-S4)`,
    `  SPI  ${fmt(d.spi)} | schedule coverage ${pct(d.scheduleCoverage)}   (pair-read R-S6)`,
    `  EV_abs ${d.evAbs} | PV ${d.pv} | AC ${d.ac} | CPI ${fmt(d.cpi)} | exec coverage ${pct(
      d.executionCoverage,
    )}`,
    `  review queue ${fmtQueue(d.humanReviewQueue, labelOf)} | agent queue ${fmtQueue(
      d.agentWorkQueue,
      labelOf,
    )} | unassigned ${fmtQueue(d.unassignedBacklog, labelOf)}`,
  ];
}

export function formatSnapshot(
  d: DerivedState,
  labelOf: (id: string) => string,
  projectLabel?: string,
): string {
  const head = projectLabel === undefined ? '' : `   (${projectLabel})`;
  const lines: string[] = [
    `Moira — derived snapshot @ ${d.asOf}${head}`,
    ...pairReadLines(d, labelOf),
  ];
  if (d.nodeStates.length > 0) {
    lines.push('', 'nodes:');
    for (const n of d.nodeStates) {
      const label = labelOf(n.node);
      const name = label === n.node ? n.node : `${label} (${n.node})`;
      lines.push(`  ${n.lifecycle.padEnd(12)} ${n.estimate.padEnd(9)} ${name}`);
    }
  }
  if (d.structuralErrors.length > 0) {
    lines.push('', `structural errors (${d.structuralErrors.length}):`);
    for (const e of d.structuralErrors) lines.push(`  ! ${e}`);
  }
  return lines.join('\n');
}

function fmtQueue(ids: readonly string[], labelOf: (id: string) => string): string {
  if (ids.length === 0) return '[]';
  return `[${ids.map((id) => labelOf(id)).join(', ')}]`;
}
