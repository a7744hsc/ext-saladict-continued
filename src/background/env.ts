// Service worker environment marker
// These values are used to identify the context type

export const __SALADICT_INTERNAL_PAGE__ = true
export const __SALADICT_BACKGROUND_PAGE__ = true

// For compatibility with existing code that checks window globals
// In service worker context, we export these as module globals
;(globalThis as any).__SALADICT_INTERNAL_PAGE__ = true
;(globalThis as any).__SALADICT_BACKGROUND_PAGE__ = true
