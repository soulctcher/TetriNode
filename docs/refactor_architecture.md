# TetriNode Refactor Architecture

This document describes the behavior-preserving refactor structure used in TetriNode.

## Goals

- Keep external contracts unchanged (`TetriNode`, Comfy mappings, `js/tetris_live.js` entrypoint).
- Make code navigation easier by separating concerns into focused modules.
- Enforce parity with baseline fixtures and contract checks.

## Python Layout

```text
tetris_node.py                      # Compatibility export wrapper
tetrinode/
  constants.py
  assets/
    music_bootstrap.py
    textures.py
  state/
    schema.py
    codec.py
  game/
    rng.py
    pieces.py
    scoring.py
    engine.py
  render/
    colors.py
    style.py
    board.py
    preview.py
  node_api.py
```

## JavaScript Modular Split

`js/tetris_live.js` remains the runtime entrypoint and extension registration shell.
Data/config/runtime helpers were split into:

```text
js/live/constants.js
js/live/data/colors.js
js/live/data/theme_presets.js
js/live/data/defaults.js
js/live/data/controls.js
js/live/data/music_tracks.js
js/live/data/shapes.js
js/live/data/block_style_presets.js
js/live/data/color_presets.js
js/live/data/icons.js
js/live/data/theme_used_keys.js
js/live/core/gameplay.js
js/live/core/color_utils.js
js/live/core/lock_repeat.js
js/live/core/runtime_loop.js
js/live/core/runtime_state.js
js/live/config/store.js
js/live/input/bindings.js
js/live/input/toolbar_actions.js
js/live/input/runtime_keys.js
js/live/bridge/seed.js
js/live/bridge/background_source.js
js/live/bridge/backend_state.js
js/live/bridge/comfy_hooks.js
js/live/bridge/music_controller.js
js/live/bridge/node_selection.js
js/live/bridge/node_runtime.js
js/live/bridge/state_io.js
js/live/render/layout.js
js/live/render/board.js
js/live/render/block_style.js
js/live/render/effects.js
js/live/render/node_canvas.js
js/live/render/status_overlay.js
js/live/render/toolbar_icons.js
js/live/render/toolbar.js
js/live/ui/modal_base.js
js/live/ui/settings_modal.js
js/live/ui/colors_modal.js
js/live/ui/animation_music_modal.js
js/live/ui/gameplay_modal.js
js/live/ui/block_style_modal.js
js/live/ui/theme_modal.js
js/live/ui/color_picker_modal.js
js/live/ui/theme_style.js
```

`js/tetris_live.js` now serves primarily as compatibility entrypoint/wiring while rendering, bridge, and runtime chunks are delegated to focused modules.

## Parity and Contract Checks

Tracked parity scripts are under `qa/parity/`:

- `qa/parity/capture_python_baseline.py`
- `qa/parity/verify_python_parity.py`
- `qa/parity/verify_contracts.py`
- `qa/parity/run_all.py`

Run:

```bash
/home/soul/codex/TetriNode/.comfyui_test/venv/bin/python qa/parity/run_all.py
```

This validates Python behavior hash parity and external interface contracts.
