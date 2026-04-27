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
- Export/import JSON backup with defensive import normalization and an import decision step (merge vs replace)
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

## Backup import modes
- Importing a backup now opens a review modal with a diff summary before any local state is changed.
- Summary counts include:
  - posts to add
  - posts to update (same id, different content)
  - people to add
  - profile conflicts (`name`, `bio`, `avatar`)
- **Merge into current data** (recommended):
  - keeps your current profile and preferences
  - merges posts with de-duplication (match by `id` first, then content hash fallback)
  - merges people with de-duplication (match by `id` first, then content hash fallback)
- **Replace all local data**:
  - requires a second explicit confirmation before overwrite
  - replaces your current on-device dataset with the imported backup

## Recovery expectations
- Imports and merges are persisted to `localStorage` immediately after confirmation.
- There is no built-in undo/restore history. To recover from an unwanted import, re-import a prior backup file.
- For safest recovery, export a backup before importing from another device or archive.
