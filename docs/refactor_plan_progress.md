# TetriNode Refactor Plan Progress

This tracks execution status against the approved behavior-preserving refactor plan.

## Phase Status

- `[x]` Phase 0: Baseline and guardrails
  - Tracked parity harness is in `qa/parity/`.
  - Baseline artifact exists at `qa/baseline/python_baseline.json`.
- `[x]` Phase 1: Contract tests first
  - Contract checks are implemented in `qa/parity/verify_contracts.py`.
  - Aggregate runner is `qa/parity/run_all.py`.
- `[x]` Phase 2: Python modular extraction
  - Python internals split under `tetrinode/` and entry compatibility kept in `tetris_node.py`.
- `[x]` Phase 3: JavaScript modular extraction
  - Entry compatibility remains in `js/tetris_live.js`.
  - Extracted modules include:
    - `js/live/core/gameplay.js`
    - `js/live/core/color_utils.js`
    - `js/live/core/lock_repeat.js`
    - `js/live/core/runtime_loop.js`
    - `js/live/core/runtime_state.js`
    - `js/live/render/layout.js`
    - `js/live/render/board.js`
    - `js/live/render/block_style.js`
    - `js/live/render/status_overlay.js`
    - `js/live/render/toolbar_icons.js`
    - `js/live/render/toolbar.js`
    - `js/live/input/toolbar_actions.js`
    - `js/live/input/runtime_keys.js`
    - `js/live/bridge/background_source.js`
    - `js/live/bridge/backend_state.js`
    - `js/live/bridge/comfy_hooks.js`
    - `js/live/bridge/music_controller.js`
    - `js/live/bridge/node_selection.js`
    - `js/live/bridge/node_runtime.js`
    - `js/live/bridge/state_io.js`
    - `js/live/render/effects.js`
    - `js/live/render/node_canvas.js`
    - `js/live/ui/theme_style.js`
    - `js/live/ui/modal_base.js`
    - `js/live/ui/settings_modal.js`
    - `js/live/ui/colors_modal.js`
    - `js/live/ui/animation_music_modal.js`
    - `js/live/ui/gameplay_modal.js`
    - `js/live/ui/block_style_modal.js`
    - `js/live/ui/theme_modal.js`
    - `js/live/ui/color_picker_modal.js`
- `[x]` Phase 4: Config/data decoupling
  - Preset/data bundles extracted into `js/live/data/*`.
  - `js/live/data/icons.js` and `js/live/data/theme_used_keys.js` hold shared static metadata previously embedded in `js/tetris_live.js`.
  - `js/live/data/block_style_presets.js` now owns block style preset overrides, slider metadata, texture options, and preview shape data previously embedded in `js/live/ui/block_style_modal.js`.
- `[x]` Phase 5: Cleanup/docs/deploy paths
  - Architecture map maintained in `docs/refactor_architecture.md`.
  - README maintainer structure notes are present in `README.md` ("Developer Structure").
  - `deploy_prod.sh` verified in an isolated temp `HOME` and confirmed to copy modular runtime paths (`tetrinode/`, `js/live/`, and `music/`).
- `[x]` Phase 6: Final verification/freeze
  - JS syntax sweep passes for all `.js` files under `js/`.
  - Parity gate re-run passes: `contracts OK`, `python parity OK`, `all parity checks OK`.
  - Legacy smoke scripts were executed and documented below as non-gating residuals.

## Current Verification Snapshot

- `node --check` passes for extracted JS modules and `js/tetris_live.js`.
- Parity gate passes:
  - `/home/soul/codex/TetriNode/.comfyui_test/venv/bin/python qa/parity/run_all.py`
  - Output: `contracts OK`, `python parity OK`, `all parity checks OK`
- Deploy path verification passes in isolated environment:
  - `HOME=<temp> bash deploy_prod.sh`
  - Confirmed copied files include `tetrinode/node_api.py`, `js/live/data/defaults.js`, and `music/music.blob`.
- Legacy Python smoke runner now aligned with current contract:
  - `/home/soul/codex/TetriNode/.comfyui_test/venv/bin/python tests/run_tetris_tests.py`
  - Output includes parity gate pass and script checks: `test_step_output_contract`, `test_seed_enforcement_modes`, `test_action_pipeline_smoke`, `test_tracked_parity_suite`.
- Legacy UI smoke runner now aligned with current node layout:
  - `/home/soul/codex/TetriNode/.comfyui_test/venv/bin/python tests/run_tetris_ui_tests.py`
  - Passes with `ui_tests_ok`.
  - rgthree seed reset/Run assertions now pass by applying seed changes through active keybinding-driven reset flow.

## Next Work Queue

1. No remaining refactor-plan actions.
