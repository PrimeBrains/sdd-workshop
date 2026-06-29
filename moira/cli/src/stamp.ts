// Event identity stamping. fold orders by (ts, id) — ts gives chronological order
// across CLI invocations (Date.now), id breaks ties within one invocation.

export interface Stamp {
  id: string;
  ts: number;
}

export type Stamper = () => Stamp;

/** Runtime stamper: ts = wall-clock ms, id = ts + per-process seq + short random. */
export function realStamper(): Stamper {
  let seq = 0;
  return () => {
    seq += 1;
    const ts = Date.now();
    const id = `${ts.toString(36)}-${String(seq).padStart(3, '0')}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    return { id, ts };
  };
}

/** Deterministic stamper for tests: ts = 1,2,3…, id = e001,e002,… */
export function seqStamper(start = 0): Stamper {
  let seq = start;
  return () => {
    seq += 1;
    return { id: `e${String(seq).padStart(3, '0')}`, ts: seq };
  };
}
