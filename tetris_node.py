import json
import os
import random
import re

import folder_paths
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
OUTPUT_SCALE = 3
EXTRA_VISIBLE_ROWS = 1 / 3

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


def _save_temp_background(background_image, prefix="TetriNode_bg"):
    if background_image is None:
        return []
    try:
        img = background_image[0].detach().cpu().numpy()
    except Exception:
        return []
    if img.ndim != 3 or img.shape[-1] < 3:
        return []
    img = np.clip(img[..., :3] * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img, "RGB")
    width, height = pil.size
    temp_dir = folder_paths.get_temp_directory()
    suffix = "".join(random.choice("abcdefghijklmnopqrstupvxyz") for _ in range(5))
    filename_prefix = f"{prefix}_{suffix}"
    full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        filename_prefix, temp_dir, width, height
    )
    file = f"{filename}_{counter:05}_.png"
    os.makedirs(full_output_folder, exist_ok=True)
    pil.save(os.path.join(full_output_folder, file), compress_level=1)
    return [{"filename": file, "subfolder": subfolder, "type": "temp"}]


def _wrap_result(result, background_image):
    ui_images = _save_temp_background(background_image)
    if not ui_images:
        return result
    return {"ui": {"tetrinode_background": ui_images}, "result": result}


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


def _resolve_options(options_payload):
    if not options_payload:
        return {}
    payload = options_payload
    if isinstance(options_payload, str):
        try:
            payload = json.loads(options_payload)
        except json.JSONDecodeError:
            return {}
    if not isinstance(payload, dict):
        return {}
    return payload


def _resolve_colors(options_payload):
    colors = dict(COLORS)
    payload = _resolve_options(options_payload)
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


def _resolve_bool(options, key, default):
    if not isinstance(options, dict):
        return default
    value = options.get(key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return default


def _parse_rgba_color(value):
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    if text.startswith("#"):
        rgb = _parse_hex_color(text)
        if rgb:
            return (*rgb, 31)
        return None
    match = re.match(
        r"rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    r = int(match.group(1))
    g = int(match.group(2))
    b = int(match.group(3))
    a = float(match.group(4)) if match.group(4) is not None else 0.12
    if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255 and 0 <= a <= 1):
        return None
    return (r, g, b, int(round(a * 255)))


def _ghost_piece(board, piece):
    ghost = dict(piece)
    moved = _move(ghost, 0, 1)
    while not _collides(board, moved):
        ghost = moved
        moved = _move(ghost, 0, 1)
    return ghost


def _draw_grid(img, block_size, width, height, color, extra_px):
    if not color:
        return img
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(1, BOARD_WIDTH):
        xpos = x * block_size - 1
        draw.line([xpos, -1, xpos, height + 1], fill=color, width=1)
    for y in range(0, VISIBLE_HEIGHT):
        ypos = y * block_size - 1 + extra_px
        draw.line([-1, ypos, width + 1, ypos], fill=color, width=1)
    return Image.alpha_composite(img, overlay)


def _draw_ghost(img, board, piece, block_size, color, extra_px):
    if not color:
        return img
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    ghost = _ghost_piece(board, piece)
    fill = (*color, 84)
    outline = (200, 200, 200, 171)
    for x, y in _piece_cells(ghost):
        if HIDDEN_ROWS - 1 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size + extra_px
            draw.rectangle(
                [x0, y0, x0 + block_size - 2, y0 + block_size - 2],
                fill=fill,
            )
            draw.rectangle(
                [x0 + 1, y0 + 1, x0 + block_size - 2, y0 + block_size - 2],
                outline=outline,
            )
    return Image.alpha_composite(img, overlay)


def _render(board, piece, block_size, background_image=None, colors=None, ghost_enabled=False, grid_color=None):
    width = BOARD_WIDTH * block_size
    extra_px = int(round(EXTRA_VISIBLE_ROWS * block_size))
    height = VISIBLE_HEIGHT * block_size + extra_px
    palette = colors or COLORS
    bg = _prepare_background(background_image, width, height)
    if bg is not None:
        img = bg.convert("RGBA")
    else:
        img = Image.new("RGBA", (width, height), (*palette["X"], 255))
    img = _draw_grid(img, block_size, width, height, grid_color, extra_px)
    draw = ImageDraw.Draw(img)

    if HIDDEN_ROWS > 0:
        hidden_row = HIDDEN_ROWS - 1
        for x in range(BOARD_WIDTH):
            cell = board[hidden_row][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = -block_size + extra_px
                draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=color)
    for y in range(VISIBLE_HEIGHT):
        board_y = y + HIDDEN_ROWS
        for x in range(BOARD_WIDTH):
            cell = board[board_y][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = y * block_size + extra_px
                draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=color)

    if ghost_enabled:
        img = _draw_ghost(img, board, piece, block_size, palette[piece["shape"]], extra_px)
        draw = ImageDraw.Draw(img)

    for x, y in _piece_cells(piece):
        if HIDDEN_ROWS - 1 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            color = palette[piece["shape"]]
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size + extra_px
            draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=color)

    arr = np.array(img.convert("RGB")).astype(np.float32) / 255.0
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


def _get_upcoming_shapes(state, count):
    if count <= 0:
        return []
    upcoming = [state.get("next_piece_shape")] + list(state.get("bag", []))
    bag_count = state.get("bag_count", 0)
    seed = state.get("seed", 0)
    while len(upcoming) < count:
        bag = _new_bag(seed, bag_count)
        bag_count += 1
        upcoming.extend(bag)
    return upcoming[:count]


def _render_queue(shapes, block_size, colors=None):
    palette = colors or COLORS
    if not shapes:
        size = PREVIEW_GRID * block_size
        img = Image.new("RGB", (size, size), palette["X"])
        arr = np.array(img).astype(np.float32) / 255.0
        return torch.from_numpy(arr)[None, ...]
    gap = block_size
    width = PREVIEW_GRID * block_size
    height = len(shapes) * PREVIEW_GRID * block_size + max(0, len(shapes) - 1) * gap
    img = Image.new("RGB", (width, height), palette["X"])
    draw = ImageDraw.Draw(img)
    for idx, shape in enumerate(shapes):
        if shape not in SHAPES:
            continue
        offset_y = idx * (PREVIEW_GRID * block_size + gap)
        cells = SHAPES[shape][0]
        min_x = min(x for x, _ in cells)
        min_y = min(y for _, y in cells)
        max_x = max(x for x, _ in cells)
        max_y = max(y for _, y in cells)
        shape_w = max_x - min_x + 1
        shape_h = max_y - min_y + 1
        offset_x = (PREVIEW_GRID - shape_w) // 2 - min_x
        offset_cell_y = (PREVIEW_GRID - shape_h) // 2 - min_y
        for x, y in cells:
            gx = x + offset_x
            gy = y + offset_cell_y
            if 0 <= gx < PREVIEW_GRID and 0 <= gy < PREVIEW_GRID:
                x0 = gx * block_size
                y0 = offset_y + gy * block_size
                draw.rectangle(
                    [x0, y0, x0 + block_size - 2, y0 + block_size - 2],
                    fill=palette[shape],
                )
    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


def _default_state(seed):
    state = {
        "version": STATE_VERSION,
        "board": _empty_board(),
        "bag": [],
        "bag_count": 0,
        "seed": seed,
        "start_level": 1,
        "level_progression": "fixed",
        "level": 1,
        "piece": None,
        "next_piece_shape": None,
        "hold_piece_shape": None,
        "hold_used": False,
        "score": 0,
        "lines_cleared_total": 0,
        "tetrises": 0,
        "tspins": 0,
        "combo_streak": 0,
        "combo_total": 0,
        "goal_lines_total": 0.0,
        "b2b_active": False,
        "game_over": False,
        "last_action": None,
        "last_rotate_kick": None,
        "tspin": "none",
        "options": {},
    }
    state["piece"] = _spawn_piece(_pop_shape(state))
    state["next_piece_shape"] = _pop_shape(state)
    if _collides(state["board"], state["piece"]):
        state["game_over"] = True
    return state


def _calc_level(start_level, lines_cleared_total, progression="fixed"):
    start = max(1, min(15, int(start_level)))
    if progression == "variable":
        remaining = int(lines_cleared_total)
        level = start
        while level < 15:
            goal = 5 * level
            if remaining < goal:
                break
            remaining -= goal
            level += 1
        return max(1, min(15, level))
    return max(1, min(15, start + int(lines_cleared_total // 10)))


def _lines_to_next_level(level, lines_total, progression="fixed", start_level=1):
    if level >= 15:
        return 0.0
    if progression == "variable":
        remaining = float(lines_total)
        lvl = max(1, min(15, int(start_level)))
        while lvl < 15 and remaining >= 5 * lvl:
            remaining -= 5 * lvl
            lvl += 1
        if lvl >= 15:
            return 0.0
        return max(0.0, float(5 * lvl - remaining))
    start = max(1, min(15, int(start_level)))
    lines_into_level = float(lines_total) - float((level - start) * 10)
    return max(0.0, float(10 - lines_into_level))


def _score_action(level, lines_cleared, tspin_type, b2b_active):
    base = 0
    qualifies_b2b = False
    if tspin_type == "tspin":
        if lines_cleared == 0:
            base = 400 * level
        elif lines_cleared == 1:
            base = 800 * level
            qualifies_b2b = True
        elif lines_cleared == 2:
            base = 1200 * level
            qualifies_b2b = True
        elif lines_cleared == 3:
            base = 1600 * level
            qualifies_b2b = True
    elif tspin_type == "mini":
        if lines_cleared == 0:
            base = 100 * level
        else:
            base = 200 * level
            qualifies_b2b = True
    else:
        if lines_cleared == 1:
            base = 100 * level
        elif lines_cleared == 2:
            base = 300 * level
        elif lines_cleared == 3:
            base = 500 * level
        elif lines_cleared == 4:
            base = 800 * level
            qualifies_b2b = True

    bonus = 0
    next_b2b = b2b_active
    if qualifies_b2b:
        if b2b_active:
            bonus = int(base * 0.5)
        next_b2b = True
    elif lines_cleared in {1, 2, 3}:
        next_b2b = False

    return base + bonus, next_b2b


def _awarded_goal_lines(lines_cleared, tspin_type, b2b_active):
    base = 0.0
    qualifies_b2b = False
    if tspin_type == "tspin":
        if lines_cleared == 0:
            base = 4.0
        elif lines_cleared == 1:
            base = 8.0
            qualifies_b2b = True
        elif lines_cleared == 2:
            base = 12.0
            qualifies_b2b = True
        elif lines_cleared == 3:
            base = 16.0
            qualifies_b2b = True
    elif tspin_type == "mini":
        if lines_cleared == 0:
            base = 1.0
        else:
            base = 2.0
            qualifies_b2b = True
    else:
        if lines_cleared == 1:
            base = 1.0
        elif lines_cleared == 2:
            base = 3.0
        elif lines_cleared == 3:
            base = 5.0
        elif lines_cleared == 4:
            base = 8.0
            qualifies_b2b = True
    if qualifies_b2b and b2b_active and base > 0:
        base += base * 0.5
    return base


def _update_stats(state, lines_cleared):
    if lines_cleared > 0:
        state["combo_streak"] = state.get("combo_streak", 0) + 1
        if state["combo_streak"] == 2:
            state["combo_total"] = state.get("combo_total", 0) + 1
        if lines_cleared == 4:
            state["tetrises"] = state.get("tetrises", 0) + 1
        if state.get("tspin") != "none":
            state["tspins"] = state.get("tspins", 0) + 1
    else:
        state["combo_streak"] = 0


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
    if "tetrises" not in state:
        state["tetrises"] = 0
    if "tspins" not in state:
        state["tspins"] = 0
    if "combo_streak" not in state:
        state["combo_streak"] = 0
    if "combo_total" not in state:
        state["combo_total"] = 0
    if "goal_lines_total" not in state:
        state["goal_lines_total"] = float(state.get("lines_cleared_total", 0))
    if "b2b_active" not in state:
        state["b2b_active"] = False
    if "game_over" not in state:
        state["game_over"] = False
    if "start_level" not in state:
        state["start_level"] = 1
    if "level_progression" not in state:
        state["level_progression"] = "fixed"
    if "level" not in state:
        state["level"] = state.get("start_level", 1)
    if "last_action" not in state:
        state["last_action"] = None
    if "last_rotate_kick" not in state:
        state["last_rotate_kick"] = None
    if "tspin" not in state:
        state["tspin"] = "none"
    if "options" not in state:
        state["options"] = {}
    if "hold_piece_shape" not in state:
        state["hold_piece_shape"] = None
    if state.get("hold_piece_shape") not in SHAPES:
        state["hold_piece_shape"] = None
    if "hold_used" not in state:
        state["hold_used"] = False
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


def _kick_table(shape, rot_from, rot_to):
    if shape == "O":
        return [(0, 0)]
    if shape == "I":
        table = {
            (0, 1): [(0, 0), (-2, 0), (1, 0), (-2, -1), (1, 2)],
            (1, 0): [(0, 0), (2, 0), (-1, 0), (2, 1), (-1, -2)],
            (1, 2): [(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)],
            (2, 1): [(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)],
            (2, 3): [(0, 0), (2, 0), (-1, 0), (2, 1), (-1, -2)],
            (3, 2): [(0, 0), (-2, 0), (1, 0), (-2, -1), (1, 2)],
            (3, 0): [(0, 0), (1, 0), (-2, 0), (1, -2), (-2, 1)],
            (0, 3): [(0, 0), (-1, 0), (2, 0), (-1, 2), (2, -1)],
        }
        return table.get((rot_from, rot_to), [(0, 0)])
    table = {
        (0, 1): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (1, 0): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
        (1, 2): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
        (2, 1): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (2, 3): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        (3, 2): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (3, 0): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (0, 3): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
    }
    return table.get((rot_from, rot_to), [(0, 0)])


def _rotate_with_kick(board, piece, delta):
    rot_from = piece["rot"] % 4
    rot_to = (rot_from + delta) % 4
    kicks = _kick_table(piece["shape"], rot_from, rot_to)
    for idx, (dx, dy) in enumerate(kicks):
        candidate = {"shape": piece["shape"], "rot": rot_to, "x": piece["x"] + dx, "y": piece["y"] + dy}
        if not _collides(board, candidate):
            return candidate, idx
    return piece, None


def _corner_occupied(board, x, y):
    if x < 0 or x >= BOARD_WIDTH or y < 0 or y >= BOARD_HEIGHT:
        return True
    return board[y][x] != 0


def _tspin_type(board, piece, last_action, last_rotate_kick):
    if piece["shape"] != "T" or last_action != "rotate":
        return "none"
    cx = piece["x"] + 1
    cy = piece["y"] + 1
    corners = {
        "A": (cx - 1, cy - 1),
        "B": (cx + 1, cy - 1),
        "C": (cx - 1, cy + 1),
        "D": (cx + 1, cy + 1),
    }
    rot = piece["rot"] % 4
    if rot == 0:
        front = ("A", "B")
        back = ("C", "D")
    elif rot == 1:
        front = ("B", "D")
        back = ("A", "C")
    elif rot == 2:
        front = ("C", "D")
        back = ("A", "B")
    else:
        front = ("A", "C")
        back = ("B", "D")
    front_hits = sum(_corner_occupied(board, *corners[k]) for k in front)
    back_hits = sum(_corner_occupied(board, *corners[k]) for k in back)
    if last_rotate_kick == 4:
        return "tspin"
    total_hits = front_hits + back_hits
    if total_hits < 3:
        return "none"
    if front_hits == 2 and back_hits == 2:
        return "tspin"
    if front_hits == 2 and back_hits >= 1:
        return "tspin"
    if back_hits == 2 and front_hits >= 1:
        return "mini"
    return "none"


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

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE", "STRING")
    RETURN_NAMES = ("matrix", "next_piece", "queue", "state")
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
            image = _render(
                state_obj["board"],
                state_obj["piece"],
                output_block,
                background_image,
                palette,
                ghost_enabled=ghost_enabled,
                grid_color=grid_color,
            )
            preview = _render_next_piece(state_obj["next_piece_shape"], output_block, palette)
            queue = _render_queue(
                _get_upcoming_shapes(state_obj, queue_size + 1)[1 : queue_size + 1],
                output_block,
                palette,
            )
            return _wrap_result(
                (
                    image,
                    preview,
                    queue,
                    json.dumps(state_obj),
                ),
                background_image,
            )

        if state_obj.get("game_over"):
            output_block = block_size * OUTPUT_SCALE
            image = _render(
                state_obj["board"],
                state_obj["piece"],
                output_block,
                background_image,
                palette,
                ghost_enabled=ghost_enabled,
                grid_color=grid_color,
            )
            preview = _render_next_piece(state_obj["next_piece_shape"], output_block, palette)
            queue = _render_queue(
                _get_upcoming_shapes(state_obj, queue_size + 1)[1 : queue_size + 1],
                output_block,
                palette,
            )
            return _wrap_result(
                (
                    image,
                    preview,
                    queue,
                    json.dumps(state_obj),
                ),
                background_image,
            )

        board = state_obj["board"]
        piece = state_obj["piece"]
        next_shape = state_obj["next_piece_shape"]
        if action == "left":
            moved = _move(piece, -1, 0)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
        elif action == "right":
            moved = _move(piece, 1, 0)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
        elif action in {"down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
                if action == "soft_drop":
                    state_obj["score"] += 1
        elif action == "rotate_cw":
            piece, kick = _rotate_with_kick(board, piece, 1)
            if piece["rot"] != state_obj["piece"]["rot"] or kick is not None:
                state_obj["last_action"] = "rotate"
                state_obj["last_rotate_kick"] = kick
        elif action == "rotate_ccw":
            piece, kick = _rotate_with_kick(board, piece, -1)
            if piece["rot"] != state_obj["piece"]["rot"] or kick is not None:
                state_obj["last_action"] = "rotate"
                state_obj["last_rotate_kick"] = kick
        elif action == "hard_drop":
            drop_distance = 0
            moved = _move(piece, 0, 1)
            while not _collides(board, moved):
                piece = moved
                drop_distance += 1
                moved = _move(piece, 0, 1)
            if drop_distance:
                state_obj["score"] += 2 * drop_distance
        elif action == "hold":
            if not state_obj.get("hold_used", False):
                hold_shape = state_obj.get("hold_piece_shape")
                state_obj["hold_used"] = True
                state_obj["last_action"] = "hold"
                state_obj["last_rotate_kick"] = None
                state_obj["tspin"] = "none"
                if hold_shape in SHAPES:
                    state_obj["hold_piece_shape"] = piece["shape"]
                    piece = _spawn_piece(hold_shape)
                else:
                    state_obj["hold_piece_shape"] = piece["shape"]
                    piece = _spawn_piece(next_shape)
                    next_shape = _pop_shape(state_obj)
                if _collides(board, piece):
                    state_obj["game_over"] = True

        if action not in {"hard_drop", "down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
            else:
                _lock_piece(board, piece)
                state_obj["tspin"] = _tspin_type(
                    board, piece, state_obj["last_action"], state_obj["last_rotate_kick"]
                )
                board, cleared = _clear_lines(board)
                _update_stats(state_obj, cleared)
                level_before = state_obj.get("level", 1)
                prev_b2b = state_obj.get("b2b_active", False)
                gained, next_b2b = _score_action(
                    level_before, cleared, state_obj["tspin"], prev_b2b
                )
                state_obj["score"] += gained
                state_obj["b2b_active"] = next_b2b
                state_obj["lines_cleared_total"] += cleared
                progression = state_obj.get("level_progression", "fixed")
                if progression == "variable":
                    state_obj["goal_lines_total"] += _awarded_goal_lines(
                        cleared,
                        state_obj["tspin"],
                        prev_b2b,
                    )
                else:
                    state_obj["goal_lines_total"] = float(state_obj["lines_cleared_total"])
                state_obj["level"] = _calc_level(
                    state_obj.get("start_level", 1),
                    state_obj["goal_lines_total"],
                    progression,
                )
                piece = _spawn_piece(next_shape)
                next_shape = _pop_shape(state_obj)
                state_obj["hold_used"] = False
                if _collides(board, piece):
                    state_obj["game_over"] = True
        elif action in {"hard_drop", "down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if _collides(board, moved):
                _lock_piece(board, piece)
                state_obj["tspin"] = _tspin_type(
                    board, piece, state_obj["last_action"], state_obj["last_rotate_kick"]
                )
                board, cleared = _clear_lines(board)
                _update_stats(state_obj, cleared)
                level_before = state_obj.get("level", 1)
                prev_b2b = state_obj.get("b2b_active", False)
                gained, next_b2b = _score_action(
                    level_before, cleared, state_obj["tspin"], prev_b2b
                )
                state_obj["score"] += gained
                state_obj["b2b_active"] = next_b2b
                state_obj["lines_cleared_total"] += cleared
                progression = state_obj.get("level_progression", "fixed")
                if progression == "variable":
                    state_obj["goal_lines_total"] += _awarded_goal_lines(
                        cleared,
                        state_obj["tspin"],
                        prev_b2b,
                    )
                else:
                    state_obj["goal_lines_total"] = float(state_obj["lines_cleared_total"])
                state_obj["level"] = _calc_level(
                    state_obj.get("start_level", 1),
                    state_obj["goal_lines_total"],
                    progression,
                )
                piece = _spawn_piece(next_shape)
                next_shape = _pop_shape(state_obj)
                state_obj["hold_used"] = False
                if _collides(board, piece):
                    state_obj["game_over"] = True

        state_obj["board"] = board
        state_obj["piece"] = piece
        state_obj["next_piece_shape"] = next_shape

        output_block = block_size * OUTPUT_SCALE
        image = _render(
            board,
            piece,
            output_block,
            background_image,
            palette,
            ghost_enabled=ghost_enabled,
            grid_color=grid_color,
        )
        preview = _render_next_piece(next_shape, output_block, palette)
        queue = _render_queue(
            _get_upcoming_shapes(state_obj, queue_size + 1)[1 : queue_size + 1],
            output_block,
            palette,
        )
        return _wrap_result(
            (
                image,
                preview,
                queue,
                json.dumps(state_obj),
            ),
            background_image,
        )
