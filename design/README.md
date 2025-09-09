Design Dropzone
================

Purpose
- This folder is a safe place to drop HTML/CSS design exports (e.g., Web, Figma-to-HTML) so I can recreate the screens natively in the app.
- Files here are NOT bundled into the mobile app (they sit outside `app/` and `src/`).

Structure
- `design/html/` – put your HTML files here (e.g., `index.html`, `today.html`, `onboarding/…`).
- `design/assets/` – images, CSS, fonts, etc. referenced by your HTML.

How to add
1) Export your design as static HTML + assets.
2) Copy the exported HTML into `design/html/` and any referenced assets into `design/assets/`.
3) If there’s an entry page, name it `index.html` (optional but convenient).

Preview locally (optional)
- macOS/Linux (Python):
  - `cd design/html && python3 -m http.server 5500`
  - Open http://localhost:5500
- Node (http-server):
  - `npm i -g http-server` (once)
  - `cd design/html && http-server -p 5500`

What I need from you
- Which screen(s) should be implemented first (and path to file)
- Notes on interactions (hover/active states, transitions)
- Breakpoint/spacing tokens if relevant

Notes
- If your export references absolute paths, please update to relative paths (e.g., `assets/…`) so it works locally.
- You can keep multiple versions in subfolders, e.g., `design/html/v1/…`, `v2/…`.

