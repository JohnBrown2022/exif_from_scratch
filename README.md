# EXIF Watermark (Pure Local Web App)

This repo is scaffolded for **Vite + React + TypeScript**.

## Run

1) Install deps: `npm install`
2) Dev server: `npm run dev`
3) Build: `npm run build`

## Install as App (PWA)

PWA / offline needs **HTTPS** (iOS Safari won't enable Service Worker on plain HTTP).

- Local HTTPS (LAN): use your own certs and run `npm run preview:https`
- No-server hosting: enable GitHub Pages and install from `https://<user>.github.io/<repo>/`

## GitHub Pages (no server)

This repo includes `.github/workflows/pages.yml` (auto deploy on push to `master`/`main`).

1) Create a GitHub repo and push this project
2) In GitHub repo: `Settings → Pages → Build and deployment → GitHub Actions`
3) After the workflow finishes, open `https://<user>.github.io/<repo>/` in **iOS Safari** → Share → “Add to Home Screen”

## Docs

Markdown notes and planning files are consolidated under `docs/notes/`:

- Architecture / roadmap: `docs/notes/project.md`, `docs/notes/v1.md`, `docs/notes/v2.md`
- Merge recap: `docs/notes/merge_recap_2026-02-26.md`
- Third-party / assistant notes: `docs/notes/THIRD_PARTY_NOTICES.md`, `docs/notes/GEMINI.md`
- Working notes: `docs/notes/init.md`, `docs/notes/layout.md`, `docs/notes/findings.md`, `docs/notes/progress.md`, `docs/notes/task_plan.md`
