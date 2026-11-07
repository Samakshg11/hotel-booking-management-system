const crypto = require('crypto');

// Crockford's Base32 alphabet (excludes I, L, O, U to avoid human confusion)
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Generates a unique booking reference formatted as: HB-<YYYYMMDD>-<5 char base32>
 * Example: HB-20261201-K7Q2M
 */
function generateBookingReference(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const datePart = `${year}${month}${day}`;

  const randomBytes = crypto.randomBytes(5);
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += BASE32_ALPHABET[randomBytes[i] % BASE32_ALPHABET.length];
  }

  return `HB-${datePart}-${randomPart}`;
}

module.exports = {
  generateBookingReference,
};
