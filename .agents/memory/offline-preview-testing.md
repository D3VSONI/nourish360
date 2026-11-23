---
name: Offline preview testing
description: A successful offline submit does not prove a Replit preview can reload offline.
---

Check an actual browser reload without connectivity when changing offline persistence or the Vite preview. Vite can serve its runtime via an `@fs` pnpm path; the preview then depends on resources the static production build does not need.

**Why:** An already open tab passed the offline save and showed the queued visit, but a fresh navigation stayed blank because an uncached Vite runtime import was blocked.

**How to apply:** Start from a fresh browser, open a synthetic record while online, wait for the service worker to control the page, disconnect the browser, save, reload, and reconnect. Keep the cache exception limited to the necessary development runtime modules; never cache the session or assessment APIs in the service worker.
