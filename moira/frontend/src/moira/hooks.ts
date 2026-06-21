// Context hooks. Kept separate from the provider so the provider file exports
// only a component (clean react-refresh boundary).

import { useContext } from 'react';
import { MoiraContext, type MoiraState } from './context';
import type { DerivedState } from './engine';

export function useMoira(): MoiraState {
  const ctx = useContext(MoiraContext);
  if (ctx === null) throw new Error('useMoira must be used within a MoiraProvider');
  return ctx;
}

/** Convenience: the single DerivedState (the only metric source for surfaces). */
export function useDerived(): DerivedState {
  return useMoira().derived;
}
