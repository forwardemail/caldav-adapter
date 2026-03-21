/**
 * Shared XML entity encoding utility
 * Centralizes the XML encoding logic to avoid duplication across handlers.
 */

/**
 * Encode special characters for XML content to prevent parsing errors
 * @param {string} str - String to encode
 * @returns {string} - XML-safe encoded string
 */
function encodeXMLEntities(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .replaceAll('&', '&amp;') // Must be first to avoid double-encoding
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

module.exports = { encodeXMLEntities };
