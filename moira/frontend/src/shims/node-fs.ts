// Browser shim for `node:fs`, aliased ONLY for imports coming from the backend
// source (capacity-store.ts / event-store.ts). The app never calls loadJson /
// saveJson, so these stubs are never executed — they only satisfy the bundler.

export function readFileSync(): never {
  throw new Error('node:fs.readFileSync is unavailable in the Moira browser frontend');
}
export function writeFileSync(): never {
  throw new Error('node:fs.writeFileSync is unavailable in the Moira browser frontend');
}
export default { readFileSync, writeFileSync };
