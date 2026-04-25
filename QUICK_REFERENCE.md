# Quick Reference Card

## Launch
```bash
cd "c:\Users\conta\OneDrive\Miguel Stuff\My Claude Code\Bisaware sft app"
npm run dev
```
→ **http://localhost:3001** (or next available port)

## Setup (First Time)
1. Run npm run dev
2. Add ANTHROPIC_API_KEY to .env.local (optional, but enables AI)
3. Open app in browser

## User Workflow

### Step 1: Upload Plan
```
Click Upload File
→ Select PNG or JPG from computer
→ AI analyzes automatically
→ Suggestions appear (if API key set)
```

### Step 2: Set Scale (Optional)
```
Switch to SCALE mode (top bar)
→ Click point A on plan (over known dimension)
→ Click point B (other end of dimension)
→ Enter real length (e.g., "12 ft")
→ Click "Set Scale"
```

### Step 3: Draw Zones
```
Switch to DRAW mode (top bar)
→ Select surface type (Floor, Wall, etc.)
→ Enter zone label (e.g., "Kitchen Floor")
→ Click on plan to add points
→ Double-click to finish polygon
→ Zone appears with sqft calculated
→ Repeat for each surface
```

### Step 4: Review Estimate
```
Switch to SELECT mode (top bar)
→ Right panel shows:
   - Total sqft (all zones)
   - By surface type breakdown
   - With 10% waste estimate
```

## Keyboard Shortcuts
| Key | Action |
|-----|--------|
| Enter | Finish polygon (Draw mode) |
| Escape | Cancel drawing |
| Scroll wheel | Zoom in/out (Select mode) |
| Drag | Pan canvas (Select mode) |

## Mode Guide

| Mode | What You Do |
|------|------------|
| **Select** | View results, zoom, pan |
| **Scale** | Set measurement scale (2 clicks + length) |
| **Draw** | Create zones (click to add points) |

## Output Format
```
Zone Name          Area
─────────────────────
Kitchen Floor      145 sqft
Kitchen Backsplash  32 sqft
Bath Floor          48 sqft
Bath Walls          96 sqft
Hallway Floor      200 sqft
─────────────────────
TOTAL             521 sqft

With 10% waste:   573 sqft
```

## Controls

| Action | Method |
|--------|--------|
| Upload plan | Click "Upload File" |
| Replace plan | Click "Replace" (when plan loaded) |
| Undo last zone | Click "Undo" button (top bar) |
| Change project name | Click name field, edit, press Enter |
| Zoom in | Scroll up |
| Zoom out | Scroll down |
| Pan view | Click & drag canvas |

## Files That Matter

- `.env.local` — Your API key goes here
- `src/context/WorkspaceContext.tsx` — State machine
- `src/components/canvas/PlanCanvas.tsx` — Konva canvas
- `src/app/api/analyze-plan/route.ts` — AI endpoint

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 3000 in use | App uses next available (3001+) — check terminal |
| AI not working | Add ANTHROPIC_API_KEY to .env.local |
| Zone area = 0 | Must set scale first (Scale mode) |
| Zones disappear | Check browser allows localStorage |
| Polygon won't finish | Need at least 3 points; try double-click |
| Slow on large images | Compress/optimize image first |

## Data Persistence

**Survives Refresh:**
- ✅ Zones
- ✅ Scale setting
- ✅ Project name
- ✅ AI analysis results

**Does NOT Survive Refresh:**
- ❌ Uploaded plan image (must re-upload)
- ❌ In-progress drawing

## Limits

- Storage: ~5MB per browser (localStorage)
- Image size: Works best under 5MB
- Polygon points: No hard limit, but 100+ points slow
- Zones per plan: No hard limit

## API Key Setup

1. Go to https://console.anthropic.com
2. Create account or sign in
3. Generate API key
4. Add to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
   ```
5. Restart dev server
6. Test by uploading a plan → should see "Analyzing plan..." spinner

## Next Steps

Once you're comfortable with the workflow:
1. Try multi-surface plans
2. Test scale accuracy by comparing calculated areas to known measurements
3. Export data when that feature ships (Phase 2)
4. Share projects when collaboration feature ships (Phase 3)
