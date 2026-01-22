// Global shim for browser environments
// Some Node.js libraries expect 'global' to exist
module.exports = typeof global !== 'undefined'
  ? global
  : typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
      ? window
      : {}
