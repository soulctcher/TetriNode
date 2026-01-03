import json
import random

import numpy as np
import torch
from PIL import Image, ImageDraw


BOARD_WIDTH = 10
BOARD_HEIGHT = 40
VISIBLE_HEIGHT = 20
HIDDEN_ROWS = BOARD_HEIGHT - VISIBLE_HEIGHT
SPAWN_Y = HIDDEN_ROWS - 2
STATE_VERSION = 1
PREVIEW_GRID = 4

SHAPES = {
    "I": [
        [(0, 1), (1, 1), (2, 1), (3, 1)],
        [(2, 0), (2, 1), (2, 2), (2, 3)],
        [(0, 2), (1, 2), (2, 2), (3, 2)],
        [(1, 0), (1, 1), (1, 2), (1, 3)],
    ],
    "J": [
        [(0, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (2, 0), (1, 1), (1, 2)],
        [(0, 1), (1, 1), (2, 1), (2, 2)],
        [(1, 0), (1, 1), (0, 2), (1, 2)],
    ],
    "L": [
        [(2, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (1, 1), (1, 2), (2, 2)],
        [(0, 1), (1, 1), (2, 1), (0, 2)],
        [(0, 0), (1, 0), (1, 1), (1, 2)],
    ],
    "O": [
        [(1, 0), (2, 0), (1, 1), (2, 1)],
        [(1, 0), (2, 0), (1, 1), (2, 1)],
        [(1, 0), (2, 0), (1, 1), (2, 1)],
        [(1, 0), (2, 0), (1, 1), (2, 1)],
    ],
    "S": [
        [(1, 0), (2, 0), (0, 1), (1, 1)],
        [(1, 0), (1, 1), (2, 1), (2, 2)],
        [(1, 1), (2, 1), (0, 2), (1, 2)],
        [(0, 0), (0, 1), (1, 1), (1, 2)],
    ],
    "T": [
        [(1, 0), (0, 1), (1, 1), (2, 1)],
        [(1, 0), (1, 1), (2, 1), (1, 2)],
        [(0, 1), (1, 1), (2, 1), (1, 2)],
        [(1, 0), (0, 1), (1, 1), (1, 2)],
    ],
    "Z": [
        [(0, 0), (1, 0), (1, 1), (2, 1)],
        [(2, 0), (1, 1), (2, 1), (1, 2)],
        [(0, 1), (1, 1), (1, 2), (2, 2)],
        [(1, 0), (0, 1), (1, 1), (0, 2)],
    ],
}

COLORS = {
    "I": (85, 214, 255),
    "J": (86, 105, 255),
    "L": (255, 167, 71),
    "O": (255, 231, 87),
    "S": (122, 235, 132),
    "T": (187, 128, 255),
    "Z": (255, 118, 118),
    "X": (50, 52, 62),
}


def _empty_board():
    return [[0 for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]


def _new_bag(seed, bag_count):
    rng = random.Random(seed + bag_count)
    bag = list(SHAPES.keys())
    rng.shuffle(bag)
    return bag


def _pop_shape(state):
    if not state["bag"]:
        state["bag"] = _new_bag(state["seed"], state["bag_count"])
        state["bag_count"] += 1
    return state["bag"].pop(0)


def _spawn_piece(shape):
    return {"shape": shape, "rot": 0, "x": 3, "y": SPAWN_Y}


def _piece_cells(piece):
    shape = SHAPES[piece["shape"]][piece["rot"] % 4]
    return [(piece["x"] + dx, piece["y"] + dy) for dx, dy in shape]


def _collides(board, piece):
    for x, y in _piece_cells(piece):
        if x < 0 or x >= BOARD_WIDTH or y < 0 or y >= BOARD_HEIGHT:
            return True
        if board[y][x]:
            return True
    return False


def _lock_piece(board, piece):
    for x, y in _piece_cells(piece):
        if 0 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            board[y][x] = piece["shape"]


def _clear_lines(board):
    remaining = [row for row in board if any(cell == 0 for cell in row)]
    cleared = BOARD_HEIGHT - len(remaining)
    for _ in range(cleared):
        remaining.insert(0, [0 for _ in range(BOARD_WIDTH)])
    return remaining, cleared


def _prepare_background(background_image, width, height):
    if background_image is None:
        return None
    try:
        img = background_image[0].detach().cpu().numpy()
    except Exception:
        return None
    if img.ndim != 3 or img.shape[-1] < 3:
        return None
    img = np.clip(img[..., :3] * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img, "RGB")
    src_w, src_h = pil.size
    if src_w <= 0 or src_h <= 0:
        return None
    scale = max(width / src_w, height / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    pil = pil.resize((new_w, new_h), Image.BICUBIC)
    left = max(0, (new_w - width) // 2)
    top = max(0, (new_h - height) // 2)
    return pil.crop((left, top, left + width, top + height))


def _parse_hex_color(value):
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    if candidate.startswith("#"):
        candidate = candidate[1:]
    if len(candidate) != 6:
        return None
    try:
        r = int(candidate[0:2], 16)
        g = int(candidate[2:4], 16)
        b = int(candidate[4:6], 16)
    except ValueError:
        return None
    return (r, g, b)


def _resolve_colors(options_payload):
    colors = dict(COLORS)
    if not options_payload:
        return colors
    payload = options_payload
    if isinstance(options_payload, str):
        try:
            payload = json.loads(options_payload)
        except json.JSONDecodeError:
            return colors
    if not isinstance(payload, dict):
        return colors
    mapping = {
        "color_i": "I",
        "color_j": "J",
        "color_l": "L",
        "color_o": "O",
        "color_s": "S",
        "color_t": "T",
        "color_z": "Z",
        "background_color": "X",
    }
    for key, shape in mapping.items():
        parsed = _parse_hex_color(payload.get(key))
        if parsed:
            colors[shape] = parsed
    return colors


def _render(board, piece, block_size, background_image=None, colors=None):
    width = BOARD_WIDTH * block_size
    height = VISIBLE_HEIGHT * block_size
    palette = colors or COLORS
    bg = _prepare_background(background_image, width, height)
    if bg is not None:
        img = bg
    else:
        img = Image.new("RGB", (width, height), palette["X"])
    draw = ImageDraw.Draw(img)

    for y in range(VISIBLE_HEIGHT):
        board_y = y + HIDDEN_ROWS
        for x in range(BOARD_WIDTH):
            cell = board[board_y][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = y * block_size
                draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=color)

    for x, y in _piece_cells(piece):
        if HIDDEN_ROWS <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            color = palette[piece["shape"]]
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size
            draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=color)

    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


def _render_next_piece(shape, block_size, colors=None):
    palette = colors or COLORS
    grid = PREVIEW_GRID
    size = grid * block_size
    img = Image.new("RGB", (size, size), palette["X"])
    draw = ImageDraw.Draw(img)

    cells = SHAPES[shape][0]
    min_x = min(x for x, _ in cells)
    min_y = min(y for _, y in cells)
    max_x = max(x for x, _ in cells)
    max_y = max(y for _, y in cells)
    shape_w = max_x - min_x + 1
    shape_h = max_y - min_y + 1
    offset_x = (grid - shape_w) // 2 - min_x
    offset_y = (grid - shape_h) // 2 - min_y

    for x, y in cells:
        gx = x + offset_x
        gy = y + offset_y
        if 0 <= gx < grid and 0 <= gy < grid:
            x0 = gx * block_size
            y0 = gy * block_size
            draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=palette[shape])

    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


def _default_state(seed):
    state = {
        "version": STATE_VERSION,
        "board": _empty_board(),
        "bag": [],
        "bag_count": 0,
        "seed": seed,
        "piece": None,
        "next_piece_shape": None,
        "score": 0,
        "lines_cleared_total": 0,
        "game_over": False,
    }
    state["piece"] = _spawn_piece(_pop_shape(state))
    state["next_piece_shape"] = _pop_shape(state)
    if _collides(state["board"], state["piece"]):
        state["game_over"] = True
    return state


def _deserialize_state(state_json, seed, enforce_seed=True):
    if not state_json:
        return _default_state(seed)
    try:
        state = json.loads(state_json)
    except json.JSONDecodeError:
        return _default_state(seed)
    if not isinstance(state, dict):
        return _default_state(seed)
    if state.get("version") != STATE_VERSION:
        return _default_state(seed)
    board = state.get("board")
    piece = state.get("piece")
    if not _valid_board(board) or not _valid_piece(piece):
        return _default_state(seed)
    if enforce_seed and state.get("seed") != seed:
        return _default_state(seed)
    if "bag" not in state or "bag_count" not in state:
        state["bag"] = []
        state["bag_count"] = 0
    next_shape = state.get("next_piece_shape")
    if next_shape not in SHAPES:
        state["next_piece_shape"] = _pop_shape(state)
    if "score" not in state:
        state["score"] = 0
    if "lines_cleared_total" not in state:
        state["lines_cleared_total"] = 0
    if "game_over" not in state:
        state["game_over"] = False
    return state


def _valid_board(board):
    if not isinstance(board, list) or len(board) != BOARD_HEIGHT:
        return False
    for row in board:
        if not isinstance(row, list) or len(row) != BOARD_WIDTH:
            return False
        for cell in row:
            if cell != 0 and cell not in SHAPES:
                return False
    return True


def _valid_piece(piece):
    if not isinstance(piece, dict):
        return False
    shape = piece.get("shape")
    if shape not in SHAPES:
        return False
    for key in ("rot", "x", "y"):
        if not isinstance(piece.get(key), int):
            return False
    return True


def _move(piece, dx, dy):
    return {"shape": piece["shape"], "rot": piece["rot"], "x": piece["x"] + dx, "y": piece["y"] + dy}


def _rotate(piece, delta):
    return {"shape": piece["shape"], "rot": (piece["rot"] + delta) % 4, "x": piece["x"], "y": piece["y"]}


class TetriNode:
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
                "tetrinode_options": ("TETRINODE_OPTIONS",),
                "background_image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE", "STRING", "INT", "INT", "IMAGE")
    RETURN_NAMES = ("image", "state", "lines_cleared", "score", "next_piece")
    FUNCTION = "step"
    CATEGORY = "games"

    def step(self, action, state, seed, block_size, tetrinode_options="", background_image=None):
        palette = _resolve_colors(tetrinode_options)
        if action == "new":
            state_obj = _default_state(seed)
        else:
            enforce_seed = action != "sync"
            state_obj = _deserialize_state(state, seed, enforce_seed=enforce_seed)

        if action == "sync":
            state_obj["seed"] = seed
            image = _render(state_obj["board"], state_obj["piece"], block_size, background_image, palette)
            preview = _render_next_piece(state_obj["next_piece_shape"], block_size, palette)
            return (
                image,
                json.dumps(state_obj),
                state_obj["lines_cleared_total"],
                state_obj["score"],
                preview,
            )

        if state_obj.get("game_over"):
            image = _render(state_obj["board"], state_obj["piece"], block_size, background_image, palette)
            preview = _render_next_piece(state_obj["next_piece_shape"], block_size, palette)
            return (
                image,
                json.dumps(state_obj),
                state_obj["lines_cleared_total"],
                state_obj["score"],
                preview,
            )

        board = state_obj["board"]
        piece = state_obj["piece"]
        next_shape = state_obj["next_piece_shape"]
        lines_cleared = 0

        if action == "left":
            moved = _move(piece, -1, 0)
            if not _collides(board, moved):
                piece = moved
        elif action == "right":
            moved = _move(piece, 1, 0)
            if not _collides(board, moved):
                piece = moved
        elif action in {"down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if not _collides(board, moved):
                piece = moved
        elif action == "rotate_cw":
            rotated = _rotate(piece, 1)
            if not _collides(board, rotated):
                piece = rotated
        elif action == "rotate_ccw":
            rotated = _rotate(piece, -1)
            if not _collides(board, rotated):
                piece = rotated
        elif action == "hard_drop":
            moved = _move(piece, 0, 1)
            while not _collides(board, moved):
                piece = moved
                moved = _move(piece, 0, 1)

        if action not in {"hard_drop", "down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if not _collides(board, moved):
                piece = moved
            else:
                _lock_piece(board, piece)
                board, cleared = _clear_lines(board)
                lines_cleared = cleared
                state_obj["lines_cleared_total"] += cleared
                piece = _spawn_piece(next_shape)
                next_shape = _pop_shape(state_obj)
                if _collides(board, piece):
                    state_obj["game_over"] = True
        elif action in {"hard_drop", "down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if _collides(board, moved):
                _lock_piece(board, piece)
                board, cleared = _clear_lines(board)
                lines_cleared = cleared
                state_obj["lines_cleared_total"] += cleared
                piece = _spawn_piece(next_shape)
                next_shape = _pop_shape(state_obj)
                if _collides(board, piece):
                    state_obj["game_over"] = True

        state_obj["board"] = board
        state_obj["piece"] = piece
        state_obj["next_piece_shape"] = next_shape

        image = _render(board, piece, block_size, background_image, palette)
        preview = _render_next_piece(next_shape, block_size, palette)
        return (image, json.dumps(state_obj), state_obj["lines_cleared_total"], state_obj["score"], preview)


class TetriNodeOptions:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "move_left": ("STRING", {"default": "A"}),
                "move_right": ("STRING", {"default": "D"}),
                "rotate_cw": ("STRING", {"default": "W"}),
                "rotate_ccw": ("STRING", {"default": "Q"}),
                "soft_drop": ("STRING", {"default": "S"}),
                "hard_drop": ("STRING", {"default": "Space"}),
                "reset": ("STRING", {"default": "R"}),
                "pause": ("STRING", {"default": "P"}),
                "color_i": ("STRING", {"default": "#55D6FF"}),
                "color_j": ("STRING", {"default": "#5669FF"}),
                "color_l": ("STRING", {"default": "#FFA74F"}),
                "color_o": ("STRING", {"default": "#FFE757"}),
                "color_s": ("STRING", {"default": "#7AEB84"}),
                "color_t": ("STRING", {"default": "#BB80FF"}),
                "color_z": ("STRING", {"default": "#FF7676"}),
                "background_color": ("STRING", {"default": "#32343E"}),
                "ghost_piece": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("TETRINODE_OPTIONS",)
    RETURN_NAMES = ("tetrinode_options",)
    FUNCTION = "build"
    CATEGORY = "games"

    def build(
        self,
        move_left,
        move_right,
        rotate_cw,
        rotate_ccw,
        soft_drop,
        hard_drop,
        reset,
        pause,
        color_i,
        color_j,
        color_l,
        color_o,
        color_s,
        color_t,
        color_z,
        background_color,
        ghost_piece,
    ):
        payload = {
            "move_left": move_left,
            "move_right": move_right,
            "rotate_cw": rotate_cw,
            "rotate_ccw": rotate_ccw,
            "soft_drop": soft_drop,
            "hard_drop": hard_drop,
            "reset": reset,
            "pause": pause,
            "color_i": color_i,
            "color_j": color_j,
            "color_l": color_l,
            "color_o": color_o,
            "color_s": color_s,
            "color_t": color_t,
            "color_z": color_z,
            "background_color": background_color,
            "ghost_piece": ghost_piece,
        }
        return (json.dumps(payload),)
