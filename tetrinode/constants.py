from pathlib import Path

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
