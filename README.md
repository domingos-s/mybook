# mybook PWA

A private, on-device social memory feed with a Facebook-like aesthetic.

## Features
- Create dated memory posts
- Add tags
- Search and sort posts
- Edit profile name and bio
- Data stored locally in `localStorage`
- Export/import JSON backup
- Offline support through a service worker
- Installable PWA manifest

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
