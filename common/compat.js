// CodeLog — cross-browser shim. Firefox exposes `browser` (promises),
// Chrome exposes `chrome` (promises since MV3). One global, no polyfill dep.
"use strict";
const B = globalThis.browser ?? globalThis.chrome;
