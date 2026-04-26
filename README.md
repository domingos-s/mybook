# mybook PWA

A private, on-device social memory feed with a Facebook-like aesthetic.

## Features
- First-use onboarding prompt for your name (persisted locally)
- Editable profile name, bio, and uploadable profile picture
- Create dated memory posts with tags, media, and action bar parity (Like / Comment / Share placeholder)
- Contextual post menu with edit/delete/copy-link placeholder actions
- Editable and deletable comments with inline editors
- Top-right account/settings dropdown for settings + backup controls
- Theme settings (`system`, `light`, `dark`) applied immediately
- Small toast notifications for key actions (saved/deleted/imported/migrated)
- Search and sort posts
- Export/import JSON backup with defensive import normalization
- Data stored locally in `localStorage`
- Offline support through a service worker
- In-app "Update app" button to clear cached app assets and refresh to latest files
- Installable PWA manifest with Android-friendly app icons (including maskable variants)

## Storage versioning and migration
- Current storage schema key: `mybook_v3`.
- Previous schema key: `mybook_v2` (legacy array-based posts).
- On startup, the app attempts to load `mybook_v3`; if not found, it migrates from `mybook_v2`.
- v3 data is normalized into:
  - `postsById` (object map)
  - `postOrder` (ordered post id list)
- Imports are shape-checked and normalized before persistence. Invalid/missing fields fallback to safe defaults.

## Run locally
Because service workers require a local server, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Privacy
Posts are stored only in the browser's localStorage on the device where the app is used. Export backups manually if you want to move data to another device.
