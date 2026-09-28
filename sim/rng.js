// Deterministic RNG so every run is reproducible from a seed.
// mulberry32 — tiny, good enough for a d100.

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,                                        // [0, 1)
    d100: () => Math.floor(next() * 100) + 1,    // 1..100
    pick: arr => arr[Math.floor(next() * arr.length)],
  };
}
