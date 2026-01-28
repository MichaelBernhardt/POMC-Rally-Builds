# POMC Rally Planner

A desktop application for planning and organizing regularity rally routes for the Porsche Owners Motor Club (POMC). Built to replace a spreadsheet-based workflow with a structured, node-based route builder that handles multi-day events, graduated speed calculations, and scoring-system exports.

## Background

POMC organizes regularity rallies -- timed navigation events where drivers follow detailed written instructions and must maintain specific average speeds to arrive at control points on time. Unlike racing, the goal isn't to go fast; it's to be precise. Cars depart at fixed intervals (e.g., 60 seconds apart) and are scored on how closely they match the prescribed times.

Planning these events has historically involved large, complex spreadsheets tracking hundreds of route instructions, speed assignments across multiple driver skill groups, and cumulative time calculations. This app was built to bring that workflow into a purpose-built tool.

## From Spreadsheets to App

The project started as a collection of Excel files and CSV exports used to plan the DJ Rally and other POMC events. The original spreadsheets handled route data, speed lookups, and exports to scoring programs, but were difficult to maintain across editions and years.

The app preserves full compatibility with the legacy formats -- it can import CSV data from the old spreadsheets, and exports in the same formats the scoring programs expect. Under the hood, the data model evolved through three versions:

- **V1** -- A single rally per file with a flat list of days and rows (matching the spreadsheet layout)
- **V2** -- A workspace containing multiple rallies, enabling side-by-side planning
- **V3** -- A node-based directed model with editions and a reusable template library

The app auto-detects and migrates older file formats on open.

## How Rally Planning Works

### The Route

A rally route is broken into **days**, and each day is a sequence of **segments** (nodes). Each segment contains a series of **route rows** -- individual instructions that drivers follow. A row might represent a turn, a distance marker, a speed change, a control point, or a timed stop.

Each row has a **type code** that defines its purpose:

| Code | Name | Description |
|------|------|-------------|
| `o` | Open | Free driving, no time penalty |
| `f` | Flat | Regularity section on flat terrain |
| `d` | Downhill | Regularity section going downhill |
| `u` | Uphill | Regularity section going uphill |
| `l` | Speed Limit | Transition point where a speed limit applies |
| `m` | Marked Control | GPS verification checkpoint |
| `t` | Time Add | Deliberate stop (fuel, rest) with added time per group |

### Speed Groups

Cars are divided into four performance groups -- **A, B, C, D** -- from fastest to slowest. For regularity sections, each group is assigned graduated speeds so that despite different capabilities, all groups arrive at control points at roughly the same time. This is the core handicap system.

**Speed lookup tables** define the mapping: given a terrain type and a Group A speed, the table provides the corresponding B, C, and D speeds. For example, on flat terrain at A-speed 40 km/h, the table might assign B=45, C=50, D=54.

### Time Calculations

The engine computes arrival times for every row, accounting for:

- Start time and car departure interval
- Cumulative distance and per-group speeds
- Time-add stops
- First car (Group A, earliest departure) and last car (Group D, latest departure + interval offset)

## Workflow

1. **Create a rally** and add an edition (e.g., "2025")
2. **Add days** to the edition (e.g., "Friday", "Saturday")
3. **Build a node library** -- define reusable route segment templates with connection rules (which segments can follow which)
4. **Assemble routes** using the Route Builder -- place node templates into each day's sequence
5. **Edit the grid** -- fine-tune individual rows: distances, speeds, instructions, annotations
6. **Configure speed tables** -- set graduated speed mappings per terrain type
7. **Recalculate times** -- update first/last car arrival times across all rows
8. **Export** -- generate CSV files for scoring programs or participant reference books

### Export Formats

| Format | File | Purpose |
|--------|------|---------|
| Clean | `RS_Data.csv` | Sequential numbering, annotations stripped. Input for scoring programs. |
| Blackbook | `RS_Data_BB.csv` | Type codes preserved, annotations included. Participant reference guide. |
| SpeedABCD | `SpeedABCD.csv` | 13-column format with cumulative times per group. Time verification. |

## Features

- **Multi-rally workspaces** -- plan multiple events in one file
- **Edition management** -- track yearly variants of the same rally
- **Node-based route building** -- reusable segment templates with connection validation
- **AG-Grid spreadsheet editor** -- fast inline editing of route data
- **Speed lookup tables** -- configurable per-rally graduated speed mappings
- **Undo/redo** -- row-level snapshots with history
- **Rally locking** -- prevent accidental edits to finalized routes
- **Auto-save** -- writes to disk every 5 seconds when changes are detected
- **CSV import/export** -- bidirectional compatibility with legacy spreadsheet formats
- **Auto-migration** -- transparently upgrades V1/V2 files to V3 on open

## Tech Stack

- **Tauri 2** -- Cross-platform desktop app (Rust backend, web frontend)
- **React 19** + TypeScript
- **Zustand 5** -- State management
- **AG-Grid Community 35** -- Data grid
- **PapaParse** -- CSV parsing
- **Vite 7** -- Build tooling

## Development

```bash
cd pomc-rally-planner

# Install dependencies
npm install

# Run in development (web only)
npm run dev

# Run as desktop app
npm run tauri dev

# Build for production
npm run build
```

## Project Structure

```
pomc-rally-planner/
  src/
    components/
      Grid/           # AG-Grid route editor
      Layout/         # AppShell, Toolbar, StatusBar
      Sidebar/        # ProjectTree, DayPanel
      RouteBuilder/   # Node placement and table views
      NodeLibrary/    # Template management
      Dialogs/        # Import, Export, Speed Tables, New Edition
    engine/
      timeCalculator.ts    # Arrival time computation
      speedCalculator.ts   # Speed lookup + defaults
      csvTransformer.ts    # Import/export formatting
      validator.ts         # Route integrity checks
      migration.ts         # V1 -> V2 -> V3 auto-migration
    state/
      projectStore.ts      # Zustand store + selectors
      storeHelpers.ts      # Immutable update utilities
    types/
      domain.ts            # All data model interfaces
  src-tauri/               # Rust backend (file I/O, dialogs)
```

## File Format

Workspaces are saved as `.rally.json` files containing the full hierarchy: rallies, editions, days, nodes, rows, node library templates, and speed lookup tables. The format is plain JSON and human-readable.
