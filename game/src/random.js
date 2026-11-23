// A small seeded random number generator (mulberry32): the same seed gives the same city,
// which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from a list, each weighted by the number beside it.
 *  weights need not be normalised; returns null for an empty list. */
export function pickWeighted(items, weightOf, random) {
  let total = 0;
  for (let i = 0; i < items.length; i += 1) total += weightOf(items[i]);
  if (total <= 0) return null;
  let roll = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weightOf(items[i]);
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
