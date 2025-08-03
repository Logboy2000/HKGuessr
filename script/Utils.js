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