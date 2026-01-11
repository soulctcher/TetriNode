# TetriNode

<p>
  <img src="docs/images/banner.png" width="50%">
</p>

A ComfyUI custom node pack that embeds a playable Tetris game inside a node UI, with image outputs for the live board, next-piece preview, and queue.

## Features

- Live, playable Tetris inside the node UI
- Board, next-piece, and queue image outputs
- Hold queue, next piece, and configurable queue display
- Optional background image (scaled to cover, center-cropped)
- Optional ghost piece and playfield grid (optional)
- Official Tetris Guideline-based scoring (lines, T-Spins, drops, and back-to-back bonuses)
- Level progression with official fall speeds
- Pause/Play and Reset controls
- Seeded piece generation with a standard seed widget available
- In-node toolbar with a single Settings modal (tabs: Settings, Controls, Block Style, Colors, UI Themes)
- Block Style presets with extensive style sliders and exportable settings
- Optional block textures for specific presets (Brushed Metal, Wooden Block, Concrete)

## Nodes

### TetriNode

Main gameplay node.

![TetriNode node UI](docs/images/tetrinode.png)

**Inputs**
- `seed` (INT): Seed used for piece sequence
- `background_image` (IMAGE, optional): Background image for the game board (scaled to cover, then center-cropped)

**Outputs**
- `matrix` (IMAGE): current board
- `next_piece` (IMAGE): preview image
- `queue` (IMAGE): queue preview image
- `state` (STRING): serialized game state

**UI controls**
- **Top toolbar**: Load State, Reset, Pause/Play, and a Settings modal.
- **Load State**: Opens a modal to paste a serialized state. The game pauses after loading.

### Settings modal

All configuration now lives inside TetriNode (no external options node). The Settings modal is tabbed.

- **Settings**: Toggles (controls/ghost/next/hold/grid), lock-down mode, level progression, start level, and queue size.
- **Controls**: Click Add to capture a key (up to 5 per action). Remove any binding with the `X`, or reset per action. Capture supports the same allowed keys as before and shows human-friendly labels.
- **Block Style**: Presets plus detailed style sliders (border, bevel, gradients, glow, shadows, etc.) with per-slider reset and export.
- **Colors**: Per-piece colors plus background and grid colors. Tetromino colors use 6‑digit hex; grid supports alpha.
- **UI Themes**: Glass/Flat/Neon/Minimal presets with editable colors and a “Reset Theme Colors” button.

## Controls (Default)

Displayed inside the node UI and reflected in the game input handler.

- Move Left: `ArrowLeft` / `Numpad4`
- Move Right: `ArrowRight` / `Numpad6`
- Rotate CW: `ArrowUp` / `Numpad5` / `X` / `Numpad1` / `Numpad9`
- Rotate CCW: `Ctrl` / `Numpad3` / `Z` / `Numpad7`
- Soft Drop: `ArrowDown` / `Numpad2`
- Hard Drop: `Space` / `Numpad8`
- Hold: `Shift` / `Numpad0` / `C`
- Reset: `R`
- Pause: `Esc` / `F1`

## Scoring

Scoring follows the Official 2009 Tetris Design Guideline.

**Line clears (× Level)**
- Single: 100
- Double: 300
- Triple: 500
- Tetris: 800

**T-Spins (× Level)**
- T-Spin: 400
- T-Spin Single: 800
- T-Spin Double: 1200
- T-Spin Triple: 1600

**Mini T-Spins (× Level)**
- Mini T-Spin: 100
- Mini T-Spin Single: 200

**Drops**
- Soft Drop: +1 per row
- Hard Drop: +2 per row

**Back-to-Back**
- 0.5× bonus for consecutive Tetrises, T-Spin line clears, and Mini T-Spin line clears
- Non-line T-Spins/Mini T-Spins do not start a B2B chain and do not break an existing chain
- Singles/Doubles/Triples break a B2B chain

**Variable goal line awards**
- When `level_progression` is `variable`, the Lines Cleared counter uses awarded line clears per action.
- Awarded lines: Single/Mini T-Spin = 1, Mini T-Spin Single = 2, Double = 3, Triple = 5, T-Spin = 4, Tetris/T-Spin Single = 8, T-Spin Double = 12, T-Spin Triple = 16
- Back-to-Back adds +0.5× awarded line clears

## Leveling

Levels are capped at 15 and drive normal fall speed.

**Fixed goal system (default)**
- Level increases every 10 lines cleared

**Variable goal system**
- Level 1: 5 lines
- Level 2: 10 lines
- Level 3: 15 lines
- …adding 5 more lines per level up to 15

**Fall speed formula**
- `(0.8 - ((level - 1) * 0.007))^(level - 1)` seconds per line
- Soft Drop is 20× faster than the current fall speed

**Fall speed (approx., seconds per line)**
- Level 1: 1.000
- Level 2: 0.793
- Level 3: 0.618
- Level 4: 0.473
- Level 5: 0.355
- Level 6: 0.262
- Level 7: 0.190
- Level 8: 0.135
- Level 9: 0.094
- Level 10: 0.064
- Level 11: 0.043
- Level 12: 0.028
- Level 13: 0.018
- Level 14: 0.011
- Level 15: 0.007

## Installation

### Installation (preferred)

Install via ComfyUI Manager. Search for "TetriNode" and click install.
The node pack is also available on the Comfy Registry site by [clicking here](https://registry.comfy.org/publishers/soulctcher/nodes/TetriNode).

### Installation (alternative)

1. Copy this repository into `ComfyUI/custom_nodes/TetriNode/`.
2. Restart ComfyUI.
3. Add `TetriNode` from the node list.

## License

MIT
