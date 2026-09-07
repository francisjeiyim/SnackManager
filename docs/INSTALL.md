# Installing SnackManager (PWA)

SnackManager is a Progressive Web App: open it once in a browser, then install it
to get an app icon, a full-screen window and offline start-up.

Build and serve the app first:

```bash
pnpm --filter @snackmanager/app build
pnpm --filter @snackmanager/app preview   # http://localhost:5273
```

In production, host `packages/app/dist/` on any static server (HTTPS required for
install + OPFS persistence).

## Windows — Chrome or Edge

1. Open the app URL.
2. Click the **install icon** in the address bar (a monitor with a ↓), or menu →
   **Apps → Install this site as an app** / **Install SnackManager**.
3. It opens in its own window and is pinned to the Start menu / taskbar.

## Android — Chrome

1. Open the app URL.
2. Menu (⋮) → **Add to Home screen** → **Install**.
3. Launch it from the home screen; it runs full-screen.

## iOS / iPadOS — Safari

1. Open the app URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Share button → **Add to Home Screen** → **Add**.
3. Launch from the home screen.

## Choosing a mode

On first run, open **Settings**:

- **Client / server** — set the **Server URL** to your SnackManager API. Multiple
  devices share one live view over WebSocket. Reload after changing it.
- **Standalone (offline)** — no server. Data lives in this device's browser
  (OPFS where available, else `localStorage`). Use **Export** in Settings to back
  up the `.sqlite3` file; **Import** restores it (OPFS only).

Reload the app after switching modes.

## Notes

- **Offline start-up**: the app shell and the SQLite WebAssembly are pre-cached by
  the service worker, so standalone mode works with no connectivity after the
  first load.
- **Updates**: the service worker auto-updates on the next launch after a new
  build is deployed.
- **iOS storage**: Safari may evict site data under storage pressure. For heavy
  standalone use, export regularly or run in client/server mode.
