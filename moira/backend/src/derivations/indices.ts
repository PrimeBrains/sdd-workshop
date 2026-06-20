// (8) SPI and (9) CPI — both raw, in the shared MD budget dimension (§3 MODEL:201).
//
//   SPI = EV_abs / PV   (null when PV = 0)
//   CPI = EV_abs / AC   (null when AC = 0)
//
// SPI is RAW: it only covers the scheduled region, so it must be read paired
// with schedule coverage (R-S6 MODEL:295-296). The engine returns the raw value
// plus the coverage; de-rating is the presenter's job. null-on-zero matches the
// EVM convention used elsewhere in the repo (evm-studio evm-engine).

export function computeSpi(evAbs: number, pv: number): number | null {
  return pv > 0 ? evAbs / pv : null;
}

export function computeCpi(evAbs: number, ac: number): number | null {
  return ac > 0 ? evAbs / ac : null;
}
