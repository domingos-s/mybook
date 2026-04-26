# mybook PWA

A private, on-device social memory feed with a Facebook-like aesthetic.

## Features
- First-use onboarding prompt for your name (persisted locally)
- Editable profile name, bio, and uploadable profile picture
- Create dated memory posts with tags
- Upload photo and video attachments with posts
- Search and sort posts
- Like/unlike memories
- Data stored locally in `localStorage`
- Export/import JSON backup
- Offline support through a service worker
- In-app "Update app" button to clear cached app assets and refresh to latest files
- Installable PWA manifest with Android-friendly app icons (including maskable variants)

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
