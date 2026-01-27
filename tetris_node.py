import base64
import hashlib
import io
import json
import math
import os
import random
import re
import struct
from pathlib import Path

import folder_paths
import numpy as np
import torch
from PIL import Image, ImageChops, ImageDraw, ImageFilter

BOARD_WIDTH = 10
BOARD_HEIGHT = 40
VISIBLE_HEIGHT = 20
HIDDEN_ROWS = BOARD_HEIGHT - VISIBLE_HEIGHT
SPAWN_Y = HIDDEN_ROWS - 2
STATE_VERSION = 1
PREVIEW_GRID = 4
OUTPUT_SCALE = 3
EXTRA_VISIBLE_ROWS = 1 / 3

MUSIC_DIR = Path(__file__).parent / "music"
MUSIC_BLOB = MUSIC_DIR / "music.blob"
JS_MUSIC_DIR = Path(__file__).parent / "js" / "music"
MUSIC_FILES = [
    "gb_a.mp3",
    "gb_b.mp3",
    "gb_c.mp3",
    "nes_a.mp3",
    "nes_b.mp3",
    "nes_c.mp3",
]
MUSIC_MAGIC = b"TNMUSIC1"


def _unpack_music_blob():
    if not MUSIC_BLOB.exists():
        return
    missing = [name for name in MUSIC_FILES if not (MUSIC_DIR / name).exists()]
    try:
        with MUSIC_BLOB.open("rb") as handle:
            magic = handle.read(len(MUSIC_MAGIC))
            if magic != MUSIC_MAGIC:
                return
            header_len_bytes = handle.read(4)
            if len(header_len_bytes) != 4:
                return
            header_len = struct.unpack(">I", header_len_bytes)[0]
            header_raw = handle.read(header_len)
            header = json.loads(header_raw.decode("utf-8"))
            MUSIC_DIR.mkdir(parents=True, exist_ok=True)
            JS_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
            for entry in header:
                name = entry.get("name")
                size = int(entry.get("size", 0))
                if size <= 0:
                    continue
                data = handle.read(size)
                if name in missing:
                    with (MUSIC_DIR / name).open("wb") as out_file:
                        out_file.write(data)
                js_path = JS_MUSIC_DIR / name
                if not js_path.exists():
                    try:
                        js_path.write_bytes(data)
                    except Exception:
                        pass
        _ensure_js_music()
    except Exception:
        return
def _ensure_js_music():
    try:
        JS_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
        for name in MUSIC_FILES:
            target = JS_MUSIC_DIR / name
            source = MUSIC_DIR / name
            if target.exists() or not source.exists():
                continue
            try:
                target.symlink_to(source)
            except Exception:
                try:
                    target.write_bytes(source.read_bytes())
                except Exception:
                    pass
    except Exception:
        return


_unpack_music_blob()

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

DEFAULT_BLOCK_STYLE = {
    "border": 1,
    "border_blur": 0,
    "gradient": 0.35,
    "gradient_angle": 45,
    "fill_blur": 0,
    "alpha": 1,
    "clearcoat": 0,
    "clearcoat_size": 0.3,
    "rim_light": 0,
    "roughness": 0,
    "metallic": 0,
    "scanlines": 0,
    "shadow": 0,
    "shadow_angle": 135,
    "corner_radius": 0,
    "bevel": 0,
    "specular_size": 0,
    "specular_strength": 0,
    "inner_shadow": 0,
    "inner_shadow_strength": 0,
    "outline_opacity": 1,
    "gradient_contrast": 1,
    "saturation_shift": 0,
    "brightness_shift": 0,
    "noise": 0,
    "glow": 0,
    "glow_opacity": 0.5,
    "pixel_snap": 0,
    "texture_id": "",
    "texture_opacity": 0,
    "texture_scale": 1,
    "texture_angle": 0,
}

PIXELATED_TEXTURE_SAMPLE_RATIO = 0.25
TEXTURE_SAMPLE_PX = 200
RANDOM_TEXTURE_IDS = {"pixelated", "wooden", "concrete", "brushed_metal", "toxic_slime"}
TEXTURE_ROTATIONS = (0, 90, 180, 270)
TEXTURE_DATA_MAP = {
    "pixelated": "PIXELATED_TEXTURE_DATA",
    "wooden": "WOODEN_TEXTURE_DATA",
    "concrete": "CONCRETE_TEXTURE_DATA",
    "brushed_metal": "BRUSHED_METAL_TEXTURE_DATA",
    "toxic_slime": "TOXIC_SLIME_TEXTURE_DATA",
}
_TEXTURE_CACHE = {}
_TEXTURE_DATA_CACHE = {}


def _texture_js_path():
    return os.path.join(os.path.dirname(__file__), "js", "textures.js")


def _load_texture_data():
    if _TEXTURE_DATA_CACHE:
        return _TEXTURE_DATA_CACHE
    path = _texture_js_path()
    if not os.path.exists(path):
        return _TEXTURE_DATA_CACHE
    with open(path, "r", encoding="utf-8") as handle:
        text = handle.read()
    for texture_id, const_name in TEXTURE_DATA_MAP.items():
        match = re.search(
            rf'export const {re.escape(const_name)} = "data:image/jpeg;base64,([^"]+)";',
            text,
        )
        if match:
            _TEXTURE_DATA_CACHE[texture_id] = match.group(1)
    return _TEXTURE_DATA_CACHE


def _load_texture_image(texture_id):
    if not texture_id:
        return None
    if texture_id in _TEXTURE_CACHE:
        return _TEXTURE_CACHE[texture_id]
    data_map = _load_texture_data()
    payload = data_map.get(texture_id)
    if not payload:
        _TEXTURE_CACHE[texture_id] = None
        return None
    raw = base64.b64decode(payload)
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    _TEXTURE_CACHE[texture_id] = img
    return img


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


def _render_from_capture(data_url):
    if not data_url:
        return None
    raw = data_url
    if isinstance(data_url, dict) and "data" in data_url:
        raw = data_url.get("data")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        if raw.startswith("data:"):
            _, encoded = raw.split(",", 1)
        else:
            encoded = raw
        payload = base64.b64decode(encoded)
        pil = Image.open(io.BytesIO(payload)).convert("RGB")
    except Exception:
        return None
    arr = np.array(pil).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


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


def _clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def _rgb_to_hsl(r, g, b):
    r /= 255.0
    g /= 255.0
    b /= 255.0
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    lightness = (max_c + min_c) / 2.0
    if max_c == min_c:
        return 0.0, 0.0, lightness
    delta = max_c - min_c
    s = delta / (2.0 - max_c - min_c) if lightness > 0.5 else delta / (max_c + min_c)
    if max_c == r:
        h = (g - b) / delta + (6.0 if g < b else 0.0)
    elif max_c == g:
        h = (b - r) / delta + 2.0
    else:
        h = (r - g) / delta + 4.0
    h /= 6.0
    return h * 360.0, s * 100.0, lightness * 100.0


def _hsl_to_rgb(h, s, lightness):
    h = (h % 360.0) / 360.0
    s /= 100.0
    lightness /= 100.0

    def hue_to_rgb(p, q, t):
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1 / 6:
            return p + (q - p) * 6 * t
        if t < 1 / 2:
            return q
        if t < 2 / 3:
            return p + (q - p) * (2 / 3 - t) * 6
        return p

    if s == 0:
        r = g = b = lightness
    else:
        q = lightness * (1 + s) if lightness < 0.5 else lightness + s - lightness * s
        p = 2 * lightness - q
        r = hue_to_rgb(p, q, h + 1 / 3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1 / 3)
    return int(round(r * 255)), int(round(g * 255)), int(round(b * 255))


def _adjust_color_hsl(color, saturation_shift, brightness_shift):
    r, g, b = color
    h, s, lightness = _rgb_to_hsl(r, g, b)
    s = _clamp(s + saturation_shift * 100.0, 0.0, 100.0)
    lightness = _clamp(lightness + brightness_shift * 100.0, 0.0, 100.0)
    return _hsl_to_rgb(h, s, lightness)


def _adjust_color_by_factor(color, factor):
    r, g, b = color
    def mix(channel):
        if factor >= 0:
            return int(round(_clamp(channel + (255 - channel) * factor, 0, 255)))
        return int(round(_clamp(channel * (1 + factor), 0, 255)))
    return (mix(r), mix(g), mix(b))


def _mix_colors(color_a, color_b, t):
    r1, g1, b1 = color_a
    r2, g2, b2 = color_b
    return (
        int(round(r1 + (r2 - r1) * t)),
        int(round(g1 + (g2 - g1) * t)),
        int(round(b1 + (b2 - b1) * t)),
    )


def _resolve_block_style(options_payload):
    payload = _resolve_options(options_payload)
    style = dict(DEFAULT_BLOCK_STYLE)
    incoming = payload.get("block_style")
    if isinstance(incoming, dict):
        style.update(incoming)
    return {
        "border": _clamp(float(style.get("border", 0)), 0, 4),
        "border_blur": _clamp(float(style.get("border_blur", 0)), 0, 6),
        "gradient": _clamp(float(style.get("gradient", 0)), 0, 2),
        "gradient_angle": float(style.get("gradient_angle", 0)),
        "fill_blur": _clamp(float(style.get("fill_blur", style.get("blur", 0))), 0, 6),
        "alpha": _clamp(float(style.get("alpha", 1)), 0, 1),
        "clearcoat": _clamp(float(style.get("clearcoat", 0)), 0, 1),
        "clearcoat_size": _clamp(float(style.get("clearcoat_size", 0)), 0, 1),
        "rim_light": _clamp(float(style.get("rim_light", 0)), 0, 1),
        "roughness": _clamp(float(style.get("roughness", 0)), 0, 1),
        "metallic": _clamp(float(style.get("metallic", 0)), 0, 2),
        "scanlines": _clamp(float(style.get("scanlines", 0)), 0, 1),
        "shadow": _clamp(float(style.get("shadow", 0)), 0, 3),
        "shadow_angle": float(style.get("shadow_angle", 0)),
        "corner_radius": _clamp(float(style.get("corner_radius", 0)), 0, 10),
        "bevel": _clamp(float(style.get("bevel", 0)), 0, 1),
        "specular_size": _clamp(float(style.get("specular_size", 0)), 0, 1),
        "specular_strength": _clamp(float(style.get("specular_strength", 0)), 0, 1),
        "inner_shadow": _clamp(float(style.get("inner_shadow", 0)), 0, 8),
        "inner_shadow_strength": _clamp(float(style.get("inner_shadow_strength", 0)), 0, 1),
        "outline_opacity": _clamp(float(style.get("outline_opacity", 0)), 0, 1),
        "gradient_contrast": _clamp(float(style.get("gradient_contrast", 0)), 0, 1),
        "saturation_shift": _clamp(float(style.get("saturation_shift", 0)), -1, 1),
        "brightness_shift": _clamp(float(style.get("brightness_shift", 0)), -0.3, 0.3),
        "noise": _clamp(float(style.get("noise", 0)), 0, 1),
        "glow": _clamp(float(style.get("glow", 0)), 0, 10),
        "glow_opacity": _clamp(float(style.get("glow_opacity", 0)), 0, 1),
        "pixel_snap": _clamp(float(style.get("pixel_snap", 0)), 0, 1),
        "texture_id": str(style.get("texture_id", "") or ""),
        "texture_opacity": _clamp(float(style.get("texture_opacity", 0)), 0, 1),
        "texture_scale": _clamp(float(style.get("texture_scale", 1)), 0.1, 4),
        "texture_angle": float(style.get("texture_angle", 0)),
    }


def _scale_block_style(style, scale):
    scaled = dict(style)
    for key in ("border", "border_blur", "fill_blur", "shadow", "corner_radius", "inner_shadow", "glow"):
        scaled[key] = float(style.get(key, 0)) * scale
    return scaled


def _texture_transform(seed, key):
    digest = hashlib.md5(f"{seed}:{key}".encode("utf-8")).digest()
    rng = random.Random(digest)
    u = rng.random()
    v = rng.random()
    rotation = rng.choice(TEXTURE_ROTATIONS)
    flip_x = rng.random() < 0.5
    flip_y = rng.random() < 0.5
    return {
        "u": u,
        "v": v,
        "rotation": rotation,
        "flip_x": flip_x,
        "flip_y": flip_y,
    }


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


def _draw_block(base, x, y, size, color, style, texture_key=None, seed=0):
    block = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shrink = 1 if style["pixel_snap"] >= 0.5 else 0
    inner_size = size - 1 - shrink
    draw_x = shrink / 2
    draw_y = shrink / 2
    rect_right = draw_x + inner_size - 1
    rect_bottom = draw_y + inner_size - 1
    corner_radius = max(0.0, style["corner_radius"])
    fill_alpha = int(round(_clamp(style["alpha"], 0, 1) * 255))
    metallic_strength = min(1.0, style["metallic"])
    metallic_boost = max(0.0, style["metallic"] - 1.0)
    base_color = _adjust_color_hsl(color, style["saturation_shift"], style["brightness_shift"])
    if style["metallic"] > 0:
        base_color = _adjust_color_by_factor(
            base_color,
            -0.2 * metallic_strength - 0.2 * metallic_boost,
        )
    specular_color = _mix_colors(base_color, (255, 255, 255), 1 - metallic_strength)

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if corner_radius > 0:
        mask_draw.rounded_rectangle(
            [draw_x, draw_y, rect_right, rect_bottom],
            radius=min(corner_radius, inner_size / 2),
            fill=255,
        )
    else:
        mask_draw.rectangle([draw_x, draw_y, rect_right, rect_bottom], fill=255)

    fill_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask_inner = mask.crop(
        (int(draw_x), int(draw_y), int(draw_x) + inner_size, int(draw_y) + inner_size)
    )
    effective_gradient = style["gradient"] * (1 - style["roughness"] * 0.35)
    if effective_gradient > 0:
        angle = math.radians(style["gradient_angle"] % 360)
        dx = math.cos(angle)
        dy = math.sin(angle)
        half = inner_size / 2
        contrast = effective_gradient * max(0.2, style["gradient_contrast"])
        c1 = _adjust_color_by_factor(base_color, contrast * 0.4)
        c2 = _adjust_color_by_factor(base_color, -contrast * 0.4)
        xs, ys = np.meshgrid(np.arange(inner_size), np.arange(inner_size))
        tx = (xs - half) * dx + (ys - half) * dy
        t = np.clip(tx / max(1.0, half) * 0.5 + 0.5, 0, 1)
        grad = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        grad[..., 0] = (c1[0] + (c2[0] - c1[0]) * t).astype(np.uint8)
        grad[..., 1] = (c1[1] + (c2[1] - c1[1]) * t).astype(np.uint8)
        grad[..., 2] = (c1[2] + (c2[2] - c1[2]) * t).astype(np.uint8)
        grad[..., 3] = fill_alpha
        gradient_img = Image.fromarray(grad, "RGBA")
        fill_layer.paste(gradient_img, (int(draw_x), int(draw_y)), mask_inner)
    else:
        solid = Image.new("RGBA", (size, size), (*base_color, fill_alpha))
        solid.putalpha(mask)
        fill_layer = solid

    if style["shadow"] > 0:
        rad = math.radians(style["shadow_angle"] % 360)
        offset = style["shadow"] * 4
        shadow_alpha = int(round(min(0.6, 0.2 + style["shadow"] * 0.6) * 255))
        shadow = Image.new("RGBA", (size, size), (0, 0, 0, shadow_alpha))
        shadow.putalpha(mask)
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=style["shadow"] * 8))
        shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        shadow_layer.paste(shadow, (int(round(math.cos(rad) * offset)), int(round(math.sin(rad) * offset))), shadow)
        block = Image.alpha_composite(block, shadow_layer)

    if style["fill_blur"] > 0:
        fill_layer = fill_layer.filter(ImageFilter.GaussianBlur(radius=style["fill_blur"]))
    block = Image.alpha_composite(block, fill_layer)

    if style["bevel"] > 0:
        bevel = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        xs, ys = np.meshgrid(np.arange(inner_size), np.arange(inner_size))
        t = np.clip((xs + ys) / max(1.0, inner_size * 2), 0, 1)
        bevel_arr = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        bevel_arr[..., 0] = 255
        bevel_arr[..., 1] = 255
        bevel_arr[..., 2] = 255
        bevel_arr[..., 3] = (style["bevel"] * 0.35 * (1 - t) * 255).astype(np.uint8)
        bevel_img = Image.fromarray(bevel_arr, "RGBA")
        bevel.paste(bevel_img, (int(draw_x), int(draw_y)), mask_inner)
        dark_arr = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        dark_arr[..., 3] = (style["bevel"] * 0.3 * t * 255).astype(np.uint8)
        dark_img = Image.fromarray(dark_arr, "RGBA")
        bevel.paste(dark_img, (int(draw_x), int(draw_y)), mask_inner)
        block = Image.alpha_composite(block, bevel)

    effective_spec_strength = style["specular_strength"] * (1 - style["roughness"])
    effective_spec_size = min(1.0, style["specular_size"] + style["roughness"] * 0.35)
    if effective_spec_strength > 0 and effective_spec_size > 0:
        radius = max(4, inner_size * effective_spec_size)
        cx = draw_x + radius * 0.6
        cy = draw_y + radius * 0.6
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        alpha = np.clip(1 - dist / max(1.0, radius), 0, 1) * (effective_spec_strength * 0.6)
        spec_arr = np.zeros((size, size, 4), dtype=np.uint8)
        spec_arr[..., 0] = specular_color[0]
        spec_arr[..., 1] = specular_color[1]
        spec_arr[..., 2] = specular_color[2]
        spec_arr[..., 3] = (alpha * 255).astype(np.uint8)
        spec_img = Image.fromarray(spec_arr, "RGBA")
        spec_img.putalpha(ImageChops.multiply(spec_img.split()[-1], mask))
        block = Image.alpha_composite(block, spec_img)

    if style["clearcoat"] > 0 and style["clearcoat_size"] > 0:
        radius = max(3, inner_size * style["clearcoat_size"] * 0.6)
        cx = draw_x + radius * 0.55
        cy = draw_y + radius * 0.5
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        alpha = np.clip(1 - dist / max(1.0, radius), 0, 1) * (style["clearcoat"] * 0.7)
        coat_arr = np.zeros((size, size, 4), dtype=np.uint8)
        coat_arr[..., 0] = 255
        coat_arr[..., 1] = 255
        coat_arr[..., 2] = 255
        coat_arr[..., 3] = (alpha * 255).astype(np.uint8)
        coat_img = Image.fromarray(coat_arr, "RGBA")
        coat_img.putalpha(ImageChops.multiply(coat_img.split()[-1], mask))
        block = Image.alpha_composite(block, coat_img)

    if style["rim_light"] > 0:
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        cx = draw_x + inner_size / 2
        cy = draw_y + inner_size / 2
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        inner = inner_size * 0.2
        outer = inner_size * 0.65
        alpha = np.clip((dist - inner) / max(1.0, outer - inner), 0, 1)
        rim_arr = np.zeros((size, size, 4), dtype=np.uint8)
        rim_arr[..., 0] = 255
        rim_arr[..., 1] = 255
        rim_arr[..., 2] = 255
        rim_arr[..., 3] = (alpha * style["rim_light"] * 0.45 * 255).astype(np.uint8)
        rim_img = Image.fromarray(rim_arr, "RGBA")
        rim_img.putalpha(ImageChops.multiply(rim_img.split()[-1], mask))
        base_rgb = block.convert("RGB")
        rim_rgb = rim_img.convert("RGB")
        screened = ImageChops.screen(base_rgb, rim_rgb)
        block = Image.merge("RGBA", (*screened.split(), block.split()[-1]))

    if style["inner_shadow"] > 0 and style["inner_shadow_strength"] > 0:
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(inner)
        inset = style["inner_shadow"] / 2
        width = max(1, int(round(style["inner_shadow"])))
        alpha = int(round(style["inner_shadow_strength"] * 0.6 * 255))
        inner_span = max(0, inner_size - style["inner_shadow"])
        left = draw_x + inset
        top = draw_y + inset
        right = left + inner_span - 1
        bottom = top + inner_span - 1
        draw.rectangle(
            [left, top, right, bottom],
            outline=(0, 0, 0, alpha),
            width=width,
        )
        inner.putalpha(ImageChops.multiply(inner.split()[-1], mask))
        block = Image.alpha_composite(block, inner)

    if style["scanlines"] > 0:
        lines = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(lines)
        step = max(2, int(inner_size / 6))
        alpha = int(round(min(0.4, style["scanlines"] * 0.6) * 255))
        for yy in range(int(draw_y) + step, int(draw_y + inner_size), step):
            draw.line([draw_x, yy, draw_x + inner_size, yy], fill=(0, 0, 0, alpha), width=1)
        lines.putalpha(ImageChops.multiply(lines.split()[-1], mask))
        block = Image.alpha_composite(block, lines)

    texture_id = style["texture_id"]
    if texture_id and style["texture_opacity"] > 0:
        texture_img = _load_texture_image(texture_id)
        if texture_img:
            src_w = texture_img.width
            src_h = texture_img.height
            if texture_id in RANDOM_TEXTURE_IDS and texture_key:
                transform = _texture_transform(seed, texture_key)
                if texture_id == "pixelated":
                    ratio = PIXELATED_TEXTURE_SAMPLE_RATIO
                    src_w = max(1, int(round(texture_img.width * ratio)))
                    src_h = max(1, int(round(texture_img.height * ratio)))
                else:
                    src_w = max(1, min(TEXTURE_SAMPLE_PX, texture_img.width))
                    src_h = max(1, min(TEXTURE_SAMPLE_PX, texture_img.height))
                max_x = max(0, texture_img.width - src_w)
                max_y = max(0, texture_img.height - src_h)
                src_x = int(math.floor(max_x * transform["u"]))
                src_y = int(math.floor(max_y * transform["v"]))
                crop = texture_img.crop((src_x, src_y, src_x + src_w, src_y + src_h))
                if transform["rotation"]:
                    crop = crop.rotate(transform["rotation"], expand=True)
                if transform["flip_x"]:
                    crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
                if transform["flip_y"]:
                    crop = crop.transpose(Image.FLIP_TOP_BOTTOM)
            else:
                crop = texture_img
            scale_base = max(inner_size / crop.width, inner_size / crop.height)
            draw_w = max(1, int(round(crop.width * scale_base * style["texture_scale"])))
            draw_h = max(1, int(round(crop.height * scale_base * style["texture_scale"])))
            texture_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            resized = crop.resize((draw_w, draw_h), Image.BICUBIC)
            angle = style["texture_angle"]
            if angle:
                resized = resized.rotate(angle, expand=True)
            tx = int(round((size - resized.width) / 2))
            ty = int(round((size - resized.height) / 2))
            texture_layer.paste(resized, (tx, ty), resized)
            if corner_radius > 0:
                texture_layer.putalpha(ImageChops.multiply(texture_layer.split()[-1], mask))
            base_rgb = block.convert("RGB")
            tex_rgb = texture_layer.convert("RGB")
            tex_alpha = texture_layer.split()[-1]
            multiplied = ImageChops.multiply(base_rgb, tex_rgb)
            blended = Image.blend(base_rgb, multiplied, _clamp(style["texture_opacity"], 0, 1))
            composited = Image.composite(blended, base_rgb, tex_alpha)
            block = Image.merge("RGBA", (*composited.split(), block.split()[-1]))

    if style["glow"] > 0 and style["glow_opacity"] > 0:
        glow_color = _adjust_color_by_factor(base_color, 0.25)
        glow_alpha = int(round(_clamp(style["glow_opacity"], 0, 1) * 255))
        glow_layer = Image.new("RGBA", (size, size), (*glow_color, glow_alpha))
        glow_layer.putalpha(mask)
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=style["glow"] * 6))
        glow_rgb = Image.new("RGB", (size, size), (0, 0, 0))
        glow_rgb.paste(glow_color, mask=glow_layer.split()[-1])
        base_rgb = block.convert("RGB")
        added = ImageChops.add(base_rgb, glow_rgb, scale=1.0, offset=0)
        block = Image.merge("RGBA", (*added.split(), block.split()[-1]))

    if style["border"] > 0 and style["outline_opacity"] > 0:
        border_color = _adjust_color_by_factor(base_color, -0.4)
        outline_alpha = int(round(_clamp(style["outline_opacity"], 0, 1) * 255))
        border = max(1.0, float(style["border"]))
        outer_mask = Image.new("L", (size, size), 0)
        outer_draw = ImageDraw.Draw(outer_mask)
        outer_radius = min(corner_radius, inner_size / 2)
        if outer_radius > 0:
            outer_draw.rounded_rectangle(
                [draw_x, draw_y, rect_right, rect_bottom],
                radius=outer_radius,
                fill=255,
            )
        else:
            outer_draw.rectangle(
                [draw_x, draw_y, rect_right, rect_bottom],
                fill=255,
            )
        inner_mask = Image.new("L", (size, size), 0)
        inner_draw = ImageDraw.Draw(inner_mask)
        inset = border / 2.0
        inner_left = draw_x + border
        inner_top = draw_y + border
        inner_right = rect_right - border
        inner_bottom = rect_bottom - border
        inner_radius = max(0.0, min(corner_radius - inset, inner_size / 2))
        if inner_right > inner_left and inner_bottom > inner_top:
            if inner_radius > 0:
                inner_draw.rounded_rectangle(
                    [inner_left, inner_top, inner_right, inner_bottom],
                    radius=inner_radius,
                    fill=255,
                )
            else:
                inner_draw.rectangle(
                    [inner_left, inner_top, inner_right, inner_bottom],
                    fill=255,
                )
        ring = ImageChops.subtract(outer_mask, inner_mask)
        border_layer = Image.new("RGBA", (size, size), (*border_color, outline_alpha))
        border_layer.putalpha(ring)
        if style["border_blur"] > 0:
            border_layer = border_layer.filter(ImageFilter.GaussianBlur(radius=style["border_blur"]))
        block = Image.alpha_composite(block, border_layer)

    if style["noise"] > 0:
        noise_key = f"{seed}:{texture_key or ''}:noise"
        rng = random.Random(hashlib.md5(noise_key.encode("utf-8")).digest())
        count = max(4, int(math.ceil(40 * style["noise"])))
        noise_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(noise_layer)
        alpha_white = int(round(min(1, 0.3 + style["noise"] * 0.7) * 255))
        alpha_black = int(round(min(1, style["noise"] * 0.5) * 255))
        for _ in range(count):
            nx = draw_x + rng.random() * inner_size
            ny = draw_y + rng.random() * inner_size
            draw.rectangle([nx, ny, nx + 1, ny + 1], fill=(255, 255, 255, alpha_white))
        for _ in range(max(1, count // 2)):
            nx = draw_x + rng.random() * inner_size
            ny = draw_y + rng.random() * inner_size
            draw.rectangle([nx, ny, nx + 1, ny + 1], fill=(0, 0, 0, alpha_black))
        noise_layer.putalpha(ImageChops.multiply(noise_layer.split()[-1], mask))
        block = Image.alpha_composite(block, noise_layer)

    base.paste(block, (int(round(x)), int(round(y))), block)


def _render(
    board,
    piece,
    block_size,
    background_image=None,
    colors=None,
    ghost_enabled=False,
    grid_color=None,
    style=None,
    seed=0,
):
    width = BOARD_WIDTH * block_size
    extra_px = int(round(EXTRA_VISIBLE_ROWS * block_size))
    height = VISIBLE_HEIGHT * block_size + extra_px
    palette = colors or COLORS
    style = style or DEFAULT_BLOCK_STYLE
    bg = _prepare_background(background_image, width, height)
    if bg is not None:
        img = bg.convert("RGBA")
    else:
        img = Image.new("RGBA", (width, height), (*palette["X"], 255))
    img = _draw_grid(img, block_size, width, height, grid_color, extra_px)

    if HIDDEN_ROWS > 0:
        hidden_row = HIDDEN_ROWS - 1
        for x in range(BOARD_WIDTH):
            cell = board[hidden_row][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = -block_size + extra_px
                key = f"board:{x}:{hidden_row}:{cell}"
                _draw_block(img, x0, y0, block_size, color, style, key, seed)
    for y in range(VISIBLE_HEIGHT):
        board_y = y + HIDDEN_ROWS
        for x in range(BOARD_WIDTH):
            cell = board[board_y][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = y * block_size + extra_px
                key = f"board:{x}:{board_y}:{cell}"
                _draw_block(img, x0, y0, block_size, color, style, key, seed)

    if ghost_enabled:
        img = _draw_ghost(img, board, piece, block_size, palette[piece["shape"]], extra_px)

    for idx, (x, y) in enumerate(_piece_cells(piece)):
        if HIDDEN_ROWS - 1 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            color = palette[piece["shape"]]
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size + extra_px
            key = f"piece:{idx}"
            _draw_block(img, x0, y0, block_size, color, style, key, seed)

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
            (0, 1): [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)],
            (1, 0): [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)],
            (1, 2): [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)],
            (2, 1): [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)],
            (2, 3): [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)],
            (3, 2): [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)],
            (3, 0): [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)],
            (0, 3): [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)],
        }
        return table.get((rot_from, rot_to), [(0, 0)])
    table = {
        (0, 1): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (1, 0): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        (1, 2): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        (2, 1): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (2, 3): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
        (3, 2): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (3, 0): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (0, 3): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
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


def _tspin_type_from_corners(board, piece):
    if piece["shape"] != "T":
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


def _tspin_type(board, piece, last_action, last_rotate_kick):
    if piece["shape"] != "T" or last_action != "rotate":
        return "none"
    corners = _tspin_type_from_corners(board, piece)
    if corners == "none":
        return "none"
    if last_rotate_kick == 4:
        return "tspin"
    return corners


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

        board = state_obj["board"]
        piece = state_obj["piece"]
        next_shape = state_obj["next_piece_shape"]
        if action == "left":
            moved = _move(piece, -1, 0)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
                state_obj["last_rotate_kick"] = None
        elif action == "right":
            moved = _move(piece, 1, 0)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
                state_obj["last_rotate_kick"] = None
        elif action in {"down", "soft_drop"}:
            moved = _move(piece, 0, 1)
            if not _collides(board, moved):
                piece = moved
                state_obj["last_action"] = "move"
                state_obj["last_rotate_kick"] = None
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
