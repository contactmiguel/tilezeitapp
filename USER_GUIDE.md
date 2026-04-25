# Tile & Stone Takeoff App — User Guide

## Getting Started

### Opening the App

1. **Start the application:**
   - Open Command Prompt or PowerShell
   - Navigate to the app folder:
     ```bash
     cd "c:\Users\conta\OneDrive\Miguel Stuff\My Claude Code\Bisaware sft app"
     ```
   - Run:
     ```bash
     npm run dev
     ```

2. **Open in your browser:**
   - Wait for the terminal to show `✓ Ready`
   - Go to: **http://localhost:3000**
   - The workspace will load with an empty canvas

3. **To stop the app:**
   - Press `Ctrl + C` in the terminal

---

## The Workspace Layout

The app has three main areas:

### Top Bar (Dark white header)
- **Project Name** (left): Click to edit the name of your project
- **Mode Buttons** (center): Select, Scale, Draw
- **Controls** (right): Undo, Redo, Zoom level, and Export button

### Canvas Area (Large center section)
- Where your architectural plans are displayed
- When empty, shows an upload prompt
- Once a plan is uploaded, you can view it here

### Right Panel (360px sidebar)
- Changes based on which mode you're in
- Shows tools and information relevant to your current task
- Always includes an Estimate section at the bottom

---

## Step-by-Step: Upload a Plan

### 1. Click the Upload Button
- On the empty canvas, you'll see "Upload a plan"
- Click the **Upload File** button

### 2. Select Your File
- A file picker will open
- Choose a file from your computer:
  - **PNG** (e.g., `floor_plan.png`)
  - **JPG or JPEG** (e.g., `blueprint.jpg`)
  - **PDF** (e.g., `architectural_plan.pdf`)
- Click **Open**

### 3. Your Plan Appears
- The image or PDF will display in the canvas area
- The file name appears in a toolbar above the plan
- A **Replace** button lets you upload a different file

### 4. To Replace the Plan
- Click the **Replace** button
- Select a new file
- The previous plan is removed and the new one displays

---

## Understanding the Modes

The app has three work modes, each for a different step in the takeoff process:

### Select Mode (Default)
- **What it shows:** Project Summary panel
  - Total Area (in square feet)
  - Total Area with Waste Factor
  - Total Cost estimate
- **What you do:** View the overall project details
- **Next phase:** In future updates, you'll use this to review all marked zones

### Scale Mode
- **What it shows:** Set Scale panel with inputs for:
  - Real Length (number input)
  - Unit (feet or inches dropdown)
  - Set Scale button
- **What you do:** Calibrate the scale of the uploaded plan
- **How to use (future):** 
  1. In next phase, draw a line over a known dimension on the plan
  2. Enter the real-world length (e.g., "12" for 12 feet)
  3. Click "Set Scale" to calibrate the plan
  4. All future measurements will be accurate to real-world dimensions
- **Current phase note:** The drawing tool is not yet enabled in this version

### Draw Mode
- **What it shows:** Draw Zone panel with:
  - Zone type dropdown (Floor, Wall, Shower, Backsplash)
  - Instructions
  - Cancel Drawing button
- **What you do:** Mark areas on the plan that need tile or stone
- **How to use (future):**
  1. Select a zone type (e.g., "Floor")
  2. Click on the plan to add corner points
  3. Press Enter to finish the polygon
  4. The area is calculated and added to the estimate
- **Current phase note:** The polygon drawing tool is not yet enabled in this version

---

## How to Switch Modes

1. Look at the **Top Bar** in the center
2. You'll see three buttons: **Select**, **Scale**, **Draw**
3. Click any button to switch modes
4. The button turns white/active when selected
5. The Right Panel updates to show mode-specific controls

**Example workflow:**
```
Select Mode → View project summary
   ↓
Switch to Scale Mode → Calibrate the plan (coming soon)
   ↓
Switch to Draw Mode → Mark zones (coming soon)
   ↓
Switch to Select Mode → Review totals
```

---

## Project Name

- Click the **Project Name** field in the top-left
- Edit the name (default is "Untitled Project")
- Click elsewhere or press Enter to save
- Your project name will display throughout the app

---

## Buttons and Controls

### Top Bar Controls

| Button | What it does | Currently |
|--------|-------------|-----------|
| Undo | Undo your last action | Disabled (coming soon) |
| Redo | Redo your last action | Disabled (coming soon) |
| Zoom | Shows current zoom level | Displays 100% |
| Export | Export the takeoff as PDF | Disabled (coming soon) |

### Mode Buttons

| Mode | Active Color | Purpose |
|------|-------------|---------|
| Select | White/Teal | View project summary |
| Scale | White/Teal | Calibrate scale (coming soon) |
| Draw | White/Teal | Mark zones (coming soon) |

### Canvas Buttons

| Button | Where | What it does |
|--------|-------|------------|
| Upload File | Empty canvas | Open file picker to upload a plan |
| Replace | Plan viewer | Upload a different plan |

---

## Right Panel Overview

### Sections in Select Mode
- **Project Summary** — Shows totals for the entire project
  - Total Area (sqft)
  - With Waste (sqft with waste factor)
  - Total Cost (estimated)
- **Estimate** — Quick summary at the bottom
  - Total sqft
  - With waste
  - Total cost
  - Export PDF button (coming soon)

### Sections in Scale Mode
- **Set Scale** — Calibrate your plan
  - Real length input
  - Unit selector (ft or in)
  - Set Scale button
- **Estimate** — Summary (below)

### Sections in Draw Mode
- **Draw Zone** — Mark areas on the plan
  - Zone type selector
  - Instructions for drawing
  - Cancel Drawing button
- **Estimate** — Summary (below)

---

## Supported File Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| PNG | `.png` | Best for digital plans, lossless |
| JPEG | `.jpg`, `.jpeg` | Good for photos, smaller file size |
| PDF | `.pdf` | Professional architectural drawings |

**File size tip:** Keep files under 10MB for best performance.

---

## Troubleshooting

### App won't open
**Problem:** Browser shows "Cannot reach localhost:3000"
- **Solution:** Make sure `npm run dev` is running in your terminal
- Check for the message `✓ Ready in X seconds`

### File upload doesn't work
**Problem:** "Please upload a PDF, PNG, or JPG file" error
- **Solution:** Check your file format
  - Supported: PNG, JPG/JPEG, PDF only
  - Unsupported: BMP, TIFF, WEBP, etc.

### App freezes after uploading a large PDF
**Problem:** Large PDF doesn't display or app is slow
- **Solution:** Try a smaller PDF or an image version of the plan
- File size recommendation: Under 10MB

### Buttons don't respond
**Problem:** Undo, Redo, Export buttons don't work
- **This is normal** — These features are coming in the next phase
- They're visible but disabled in this version

### Can't switch modes
**Problem:** Mode buttons won't click
- **Solution:** Make sure the app is fully loaded (check terminal for `✓ Ready`)
- Try refreshing the page (Ctrl + R)

---

## What's Coming Next

This is **Version 1** of the app shell. The following features are coming soon:

- ✅ Upload plans _(available now)_
- ✅ Switch between modes _(available now)_
- ⏳ Zoom and pan the canvas _(next)_
- ⏳ Draw lines to set scale _(next)_
- ⏳ Draw polygons to mark zones _(next)_
- ⏳ Auto-calculate areas _(next)_
- ⏳ Product picker and material selection _(next)_
- ⏳ Waste factor adjustment _(next)_
- ⏳ Cost estimation _(next)_
- ⏳ Export PDF estimates _(next)_

---

## Tips & Best Practices

1. **Organize your files** — Keep architectural plans in a folder for easy access
2. **Use clear file names** — "Kitchen_Floor.pdf" is better than "plan.pdf"
3. **Scale first** — Always set the scale before drawing zones
4. **Save your project** — In future versions, you'll save projects; keep backups of your plans
5. **Use high-resolution scans** — Better image quality = easier to read and mark zones

---

## Questions or Issues?

If you run into problems:

1. Check the troubleshooting section above
2. Try refreshing the page (Ctrl + R)
3. Restart the app (`Ctrl + C` then `npm run dev`)
4. Check the browser's developer console (F12) for error messages

---

**Happy takeoff-ing! 🏗️**
