from .assets.music_bootstrap import _ensure_js_music, _unpack_music_blob
from .assets.textures import _load_texture_data, _load_texture_image, _texture_js_path
from .constants import (
    BOARD_HEIGHT,
    BOARD_WIDTH,
    COLORS,
    DEFAULT_BLOCK_STYLE,
    EXTRA_VISIBLE_ROWS,
    HIDDEN_ROWS,
    OUTPUT_SCALE,
    PREVIEW_GRID,
    RANDOM_TEXTURE_IDS,
    SHAPES,
    SPAWN_Y,
    STATE_VERSION,
    TEXTURE_DATA_MAP,
    TEXTURE_ROTATIONS,
    TEXTURE_SAMPLE_PX,
    VISIBLE_HEIGHT,
)
from .game.engine import _apply_action_step
from .game.pieces import (
    _clear_lines,
    _collides,
    _corner_occupied,
    _ghost_piece,
    _kick_table,
    _lock_piece,
    _move,
    _piece_cells,
    _rotate,
    _rotate_with_kick,
    _tspin_type,
    _tspin_type_from_corners,
)
from .game.rng import _empty_board, _new_bag, _pop_shape, _spawn_piece
from .game.scoring import (
    _awarded_goal_lines,
    _calc_level,
    _lines_to_next_level,
    _score_action,
    _update_stats,
)
from .render.board import (
    _prepare_background,
    _render,
    _render_from_capture,
    _save_temp_background,
    _wrap_result,
)
from .render.colors import (
    _adjust_color_by_factor,
    _adjust_color_hsl,
    _clamp,
    _hsl_to_rgb,
    _mix_colors,
    _parse_hex_color,
    _parse_rgba_color,
    _resolve_bool,
    _resolve_colors,
    _resolve_options,
    _rgb_to_hsl,
)
from .render.preview import _get_upcoming_shapes, _render_next_piece, _render_queue
from .render.style import _resolve_block_style, _scale_block_style, _texture_transform
from .state.codec import _default_state, _deserialize_state, _valid_board, _valid_piece

_unpack_music_blob()

class TetriNode:
    OUTPUT_NODE = True
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "action": (
                    [
                        "none",
                        "sync",
                        "left",
                        "right",
                        "down",
                        "rotate_cw",
                        "rotate_ccw",
                        "soft_drop",
                        "hard_drop",
                        "hold",
                        "new",
                    ],
                    {"default": "none"},
                ),
                "state": ("STRING", {"default": ""}),
                "seed": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": 0xFFFFFFFFFFFFFFFF,
                        "control_after_generate": True,
                        "tooltip": "The random seed used for piece generation.",
                    },
                ),
                "block_size": ("INT", {"default": 20, "min": 8, "max": 48}),
            },
            "optional": {
                "background_image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("matrix",)
    FUNCTION = "step"
    CATEGORY = "games"

    def step(
        self,
        action,
        state,
        seed,
        block_size,
        background_image=None,
    ):
        state_override = state
        if action == "new":
            state_obj = _default_state(seed)
        else:
            enforce_seed = action != "sync"
            state_obj = _deserialize_state(state_override, seed, enforce_seed=enforce_seed)
        options = _resolve_options(state_obj.get("options", {}))
        palette = _resolve_colors(options)
        style = _resolve_block_style(options)
        capture = options.get("matrix_capture")
        if action == "sync":
            captured = _render_from_capture(capture)
            if captured is not None:
                return _wrap_result(
                    (
                        captured,
                    ),
                    background_image,
                )
        ghost_enabled = _resolve_bool(options, "ghost_piece", True)
        grid_enabled = _resolve_bool(options, "grid_enabled", True)
        grid_default = "rgba(255,255,255,0.08)"
        grid_color = _parse_rgba_color(options.get("grid_color", grid_default)) if grid_enabled else None
        queue_size = options.get("queue_size", 6)
        try:
            queue_size = max(0, min(6, int(queue_size)))
        except (TypeError, ValueError):
            queue_size = 6

        if action == "sync":
            state_obj["seed"] = seed
            output_block = block_size * OUTPUT_SCALE
            render_style = _scale_block_style(style, OUTPUT_SCALE)
            image = _render(
                state_obj["board"],
                state_obj["piece"],
                output_block,
                background_image,
                palette,
                ghost_enabled=ghost_enabled,
                grid_color=grid_color,
                style=render_style,
                seed=state_obj.get("seed", seed),
            )
            return _wrap_result(
                (
                    image,
                ),
                background_image,
            )

        if state_obj.get("game_over"):
            output_block = block_size * OUTPUT_SCALE
            render_style = _scale_block_style(style, OUTPUT_SCALE)
            image = _render(
                state_obj["board"],
                state_obj["piece"],
                output_block,
                background_image,
                palette,
                ghost_enabled=ghost_enabled,
                grid_color=grid_color,
                style=render_style,
                seed=state_obj.get("seed", seed),
            )
            return _wrap_result(
                (
                    image,
                ),
                background_image,
            )

        _apply_action_step(state_obj, action)
        board = state_obj["board"]
        piece = state_obj["piece"]
        next_shape = state_obj["next_piece_shape"]

        output_block = block_size * OUTPUT_SCALE
        render_style = _scale_block_style(style, OUTPUT_SCALE)
        image = _render(
            board,
            piece,
            output_block,
            background_image,
            palette,
            ghost_enabled=ghost_enabled,
            grid_color=grid_color,
            style=render_style,
            seed=state_obj.get("seed", seed),
        )
        return _wrap_result(
            (
                image,
            ),
            background_image,
        )
