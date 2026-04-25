# Setup Guide - Tile & Stone Takeoff App

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up the Anthropic API key:**
   - Get an API key at [console.anthropic.com](https://console.anthropic.com)
   - Create or edit `.env.local` in the project root:
     ```
     ANTHROPIC_API_KEY=sk-ant-...your-key-here...
     ```
   - The app will work without this key (manual mode only), but AI suggestions won't be available

3. **Start the dev server:**
   ```bash
   npm run dev
   ```
   - The app will open at **http://localhost:3000** (or next available port)

## Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
  app/
    api/analyze-plan/route.ts    ← AI endpoint (Claude vision)
    layout.tsx
    page.tsx
  components/
    canvas/
      PlanCanvas.tsx            ← Main canvas with Konva
      ZoneShape.tsx             ← Polygon rendering
      DrawingLayer.tsx           ← In-progress polygon
      CalibrationLine.tsx        ← Scale calibration
    workspace/
      ProjectWorkspace.tsx       ← State consumer
      TopBar.tsx                 ← Mode toggles
      WorkspaceBody.tsx          ← Layout
      RightPanel.tsx             ← Mode-specific panels
  context/
    WorkspaceContext.tsx         ← useReducer + localStorage
  lib/
    area.ts                     ← Polygon math
    storage.ts                  ← localStorage helpers
  types/
    workspace.ts               ← Full type model
  styles/
    workspace.css              ← All styling
```

## How It Works

### 1. Upload a Plan
- Click **Upload File** on empty canvas
- Supports PNG and JPG (PDF coming soon)
- AI automatically analyzes the image to identify surfaces

### 2. Set Scale (Optional)
- Switch to **Scale** mode
- Click two points on the plan over a known dimension
- Enter the real-world length (feet or inches)
- Click **Set Scale**

### 3. Draw Zones
- Switch to **Draw** mode
- Select surface type (Floor, Wall, Shower, Backsplash, Countertop)
- Enter a label (e.g., "Kitchen Floor")
- Click on the plan to add polygon points
- Double-click or press Enter to finish
- Zone area is calculated automatically

### 4. Review Estimate
- Switch back to **Select** mode
- Right panel shows total areas by surface type
- Uses 10% waste factor by default

## Features

### Implemented
✅ Upload PNG/JPG plans  
✅ AI-powered surface detection  
✅ Manual polygon drawing  
✅ Scale calibration  
✅ Real-time area calculation  
✅ Surface type classification  
✅ localStorage persistence  
✅ Zoom and pan  
✅ Undo last zone  

### Coming Soon
⏳ PDF support  
⏳ Product picker  
⏳ Material cost estimates  
⏳ PDF export  
⏳ Team collaboration  
⏳ Project history  

## Troubleshooting

### Port 3000 already in use
- The app will automatically use the next available port (3001, 3002, etc.)
- Check the terminal output for the actual URL

### AI analysis not working
- Make sure `ANTHROPIC_API_KEY` is set in `.env.local`
- Check the browser console for error messages
- Manual polygon drawing will still work without AI

### Zones disappearing on refresh
- Make sure browser allows localStorage
- Check browser dev tools → Application → Local Storage
- Key is `bisaware-workspace`

### Polygon not finishing
- Need at least 3 points to form a valid polygon
- Press Enter or double-click to finish
- Press Escape to cancel

## Development Notes

- State is managed via `useReducer` with automatic localStorage persistence
- No zones are persisted: you must re-upload the plan image on new sessions
- All zones, scale, and project name survive page refresh
- Konva.js handles canvas rendering with react-konva bindings
- Claude Opus 4.7 analyzes uploaded images for surface detection

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No (optional) | API key for Claude vision analysis |

## Support

For issues or questions, check:
- Browser console (F12) for error messages
- Terminal output for server errors
- Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)
