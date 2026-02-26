# Gemini Context & Conventions

## Project Goal
Pure local web app for adding EXIF watermarks to images.
- **Stack:** Vite + React + TypeScript
- **Core Logic:** Canvas API for rendering, `exifr` for EXIF reading.
- **Privacy:** No server upload, local processing only.
- **Status:** Basic loop implemented (Import -> Preview -> Template -> Export).

## Architecture
- **`src/app`**: Main application logic and layout (`App.tsx`).
- **`src/panels`**: Major UI sections (ImageList, Preview, Inspector).
- **`src/core`**: Core business logic, independent of UI framework where possible.
  - `exif`: Reading and normalizing EXIF data.
  - `render`: Canvas rendering engine and template definitions.
  - `export`: Image export logic (blob creation, download).
  - `batch`: Batch processing queue.
- **`src/ui`**: Reusable generic UI components (Button, Slider, etc.).
- **`src/hooks`**: React glue code (`useImages`, `useSelectedExif`).

## Conventions
- **Styling:** CSS Modules (`*.module.css`) + `global.css` for variables.
- **State:** React local state + Context (if needed, currently mostly lifted state in `App.tsx`).
- **Formatting:** Prettier + ESLint.
- **Naming:** PascalCase for components, camelCase for functions/vars.
- **Types:** Strict TypeScript usage. `type` alias preferred over `interface` for data structures.

## workflows
- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## Critical Constraints
- **No Backend:** Everything must run in the browser.
- **Performance:** Handle large images carefully (Canvas memory usage).
- **EXIF:** Exported images deliberately **do not** retain original EXIF (privacy feature).
