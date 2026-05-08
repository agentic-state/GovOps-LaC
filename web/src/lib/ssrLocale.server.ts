// Compatibility shim: the canonical module is `./ssrLocale`.
// Kept to satisfy any stale dev-server module-graph references during HMR.
export { getSsrLocale } from "./ssrLocale";
