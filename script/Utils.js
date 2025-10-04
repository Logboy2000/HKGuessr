// --- Utility Functions ---
/**
 * Linearly interpolates between two values.
 * @param {number} start - The starting value.
 * @param {number} end - The ending value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
export function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

/**
 * Generates a random integer within a specified range (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer.
 */
export function randIRange(min, max) {
  if (min === max) {
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
}


export function isNumber(x) {
  return typeof x === 'number' && !isNaN(x);
}

// --- Seeded RNG ---
/**
 * Simple string -> 32-bit number hash (FNV-1a)
 */
function hashStringToUint32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * A small, fast PRNG with 32-bit state (deterministic).
 * Provides next() -> [0,1) and randIRange.
 */
export class SeededRandom {
  constructor(seed) {
    // Accept numeric or string seed
    if (typeof seed === 'string') {
      this.state = hashStringToUint32(seed) || 1
    } else if (typeof seed === 'number') {
      this.state = seed >>> 0 || 1
    } else {
      this.state = 1
    }
  }

  // Mulberry32-like next
  next() {
    let t = (this.state += 0x6d2b79f5) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return result
  }

  // Inclusive integer range
  randIRange(min, max) {
    if (min === max) return min
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  // Fisher-Yates shuffle in-place
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = array[i]
      array[i] = array[j]
      array[j] = tmp
    }
    return array
  }
}

/**
 * Factory to create a seeded RNG from a string/number
 */
export function makeSeededRandom(seed) {
  return new SeededRandom(seed)
}