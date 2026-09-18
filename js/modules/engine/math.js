/**
 * YerbaMateSim - Deterministic PRNG and Cryptographic Math Utilities (ESM)
 */

/**
 * 32-bit PRNG Mulberry32 implementation.
 * Produces deterministic pseudo-random floats in [0, 1) given a 32-bit integer seed.
 * @param {number} a Initial seed integer
 * @returns {() => number} Generator function
 */
export function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Computes a fast synchronous 32-bit FNV-1a hash over the simulation history.
 * @param {Array} hist History array
 * @returns {string} 8-character hex hash
 */
export function computeHistoryHashSync(hist) {
  const serialized = JSON.stringify(hist || []);
  let h = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    h ^= serialized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Pure synchronous SHA-256 implementation without external cryptographic dependencies.
 * Used for forensic audit trailing and tamper detection (RF-18, RF-19).
 * @param {string} ascii Input string
 * @returns {string} 64-character lowercase hexadecimal hash
 */
export function computeSHA256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const words = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }

  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (let b = 0; b < words.length; b += 16) {
    const w = [];
    for (let i = 0; i < 16; i++) {
      w[i] = words[b + i] | 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, c, d, e, f, g, h, l] = hash;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(f, 6) ^ rightRotate(f, 11) ^ rightRotate(f, 25);
      const ch = (f & g) ^ (~f & h);
      const temp1 = (l + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & c) ^ (a & d) ^ (c & d);
      const temp2 = (S0 + maj) | 0;

      l = h;
      h = g;
      g = f;
      f = (e + temp1) | 0;
      e = d;
      d = c;
      c = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + c) | 0;
    hash[2] = (hash[2] + d) | 0;
    hash[3] = (hash[3] + e) | 0;
    hash[4] = (hash[4] + f) | 0;
    hash[5] = (hash[5] + g) | 0;
    hash[6] = (hash[6] + h) | 0;
    hash[7] = (hash[7] + l) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

/**
 * Standard currency formatter for Argentine Pesos ($ ARS).
 * @param {number} val Monetary amount
 * @returns {string} Formatted string, e.g. "$1.234.567"
 */
export function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return "$0.00";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(val);
}
