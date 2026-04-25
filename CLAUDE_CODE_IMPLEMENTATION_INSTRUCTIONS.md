# Tile / Stone Takeoff App - Claude Code Implementation Instructions

## Objective
Build the first UI shell for a tile and stone takeoff app.

The app should let a user:

1. Upload an architectural plan.
2. View the plan in a workspace.
3. Switch between Select, Scale, and Draw modes.
4. See contextual controls in the right panel.
5. Prepare for the next phase: scale calibration, polygon drawing, area calculation, product selection, and estimate export.

This is V1 UI infrastructure only. Do not build AI, 3D visualization, product recommendations, or full estimation logic yet.

---

## Product direction
The product helps tile showrooms, stone distributors, contractors, and remodelers turn architectural drawings into takeoffs, material selections, and budgets.

The first wedge is:

> Upload plan -> set scale -> mark tile/stone zones -> calculate sqft -> attach products -> export estimate.

The current implementation should focus on the shell and upload flow.

---

## Tech assumptions
Use:

- Next.js App Router
- React
- TypeScript
- Plain CSS for this first shell

Do not add unnecessary dependencies yet.

Later phases may add:

- Konva.js or Fabric.js for canvas editing
- Zustand for workspace state
- PDF rendering library
- Product database
- Backend storage

---

## Target file structure

```txt
src/
  app/
    page.tsx
  components/
    workspace/
      ProjectWorkspace.tsx
      TopBar.tsx
      WorkspaceBody.tsx
      RightPanel.tsx
    canvas/
      PlanCanvas.tsx
  styles/
    workspace.css
  types/
    workspace.ts
```

---

## Required behavior

### 1. App shell
Render a full-screen workspace with:

- 64px top bar
- flexible canvas area
- 360px right panel

### 2. Top bar
Include:

- Editable project name
- Mode toggle: Select, Scale, Draw
- Undo button
- Redo button
- Zoom label
- Export button

Mode buttons should update active state.

### 3. Right panel
Show different panel content depending on mode:

- Select: project summary
- Scale: set scale form
- Draw: zone drawing form

Always show an Estimate panel beneath the contextual panel.

### 4. Upload flow
Canvas starts with an empty upload state.

User can upload:

- PNG
- JPG/JPEG
- PDF

After upload:

- Show filename
- Show Replace button
- Show the plan preview

For image files, use an img element.
For PDFs, use an object element.

### 5. Styling
Use the provided CSS exactly as the base styling.

Core visual direction:

- Clean SaaS dashboard
- Light background
- White cards
- Deep teal primary action
- 8px spacing system
- 360px right panel

---

## Acceptance criteria

The implementation is complete when:

1. The app loads without TypeScript errors.
2. The workspace fills the viewport.
3. Mode switching changes the active button and right panel content.
4. Upload button opens file picker.
5. PNG/JPG/PDF files are accepted.
6. Unsupported files trigger an alert.
7. Uploaded image or PDF appears in the canvas area.
8. Replace button lets the user upload another file.
9. Styling matches the provided layout and visual system.

---

## Do not build yet

Do not implement these in this pass:

- Polygon drawing
- Scale math
- Area calculation
- Product picker
- PDF estimate export
- Backend upload/storage
- Authentication
- Database
- AI detection
- 3D rendering

Leave clean seams for these next.

---

## Next implementation phase after this shell

After this shell works, add:

1. Zoom and pan for image plans.
2. Scale calibration line tool.
3. Polygon drawing tool.
4. Area calculation.
5. Zone detail panel.
6. Product picker.
7. Estimate totals.
8. PDF export.

