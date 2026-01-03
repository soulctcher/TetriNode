# TetriNode

<p>
  <img src="docs/images/banner.png" width="50%">
</p>

A ComfyUI custom node pack that embeds a playable Tetris game inside a node UI, with image outputs for the live board and next-piece preview.

## Features

- Live, playable Tetris inside the node UI
- Board image output and next-piece image output
- Score + lines-cleared tracking (not fully functional yet; current functionality is score = lines cleared)
- Pause/Play and Reset controls
- Seeded piece generation with a standard seed widget available
- Optional keybinding configuration via `TetriNode Options` node

## Nodes

### TetriNode

Main gameplay node.

![TetriNode node UI](docs/images/tetrinode.png)

**Inputs**
- `tetrinode_options` (TETRINODE_OPTIONS): Custom keybindings for moving left/right, rotating the piece, soft/hard drop, play/pause, and reset
- `seed` (INT): Seed used for piece sequence
- `background_image` (IMAGE, optional): Background image for the game board (scaled to cover, then center-cropped)

**Outputs**
- `image` (IMAGE): current board
- `state` (STRING): serialized game state
- `lines_cleared` (INT)
- `score` (INT)
- `next_piece` (IMAGE): preview image

### TetriNode Options

Optional node that provides keybindings.

![TetriNode Options node UI](docs/images/options.png)

**Inputs**

- `move_left`, `move_right`, `rotate_cw`, `rotate_ccw`, `soft_drop`, `hard_drop`, `reset`, `pause`: Key bindings
- `color_i`, `color_j`, `color_l`, `color_o`, `color_s`, `color_t`, `color_z`: Hex colors for each tetromino (e.g. `#55D6FF`)
- `background_color`: Hex color for the board background (ignored when a background image is connected)
- `ghost_piece`: Toggle for the ghost piece (default: on)
- `lock_down_mode`: Lock down behavior (`extended`, `infinite`, `classic`, default: `extended`)

**Outputs**

- `tetrinode_options` (TETRINODE_OPTIONS): Custom keybindings for moving left/right, rotating the piece, soft/hard drop, play/pause, and reset

## Controls (Default)

Displayed inside the node UI and reflected in the game input handler.

- Move Left: `A`
- Move Right: `D`
- Rotate CW: `W`
- Rotate CCW: `Q`
- Soft Drop: `S`
- Hard Drop: `Space`
- Reset: `R`
- Pause: `P`

## Installation

### Installation (preferred)

Install via ComfyUI Manager. Search for "TetriNode" and click install.
The node pack is also available on the Comfy Registry site by [clicking here](https://registry.comfy.org/publishers/soulctcher/nodes/TetriNode).


### Installation (alternative)

1. Copy this repository into `ComfyUI/custom_nodes/TetriNode/`.
2. Restart ComfyUI.
3. Add `TetriNode` and (optionally) `TetriNode Options` from the node list.

## License

MIT
