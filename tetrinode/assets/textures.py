import base64
import io
import re
from pathlib import Path

from PIL import Image

from ..constants import TEXTURE_DATA_MAP

_TEXTURE_CACHE = {}
_TEXTURE_DATA_CACHE = {}


def _texture_js_path():
    return Path(__file__).resolve().parents[2] / "js" / "textures.js"


def _load_texture_data():
    if _TEXTURE_DATA_CACHE:
        return _TEXTURE_DATA_CACHE
    path = _texture_js_path()
    if not path.exists():
        return _TEXTURE_DATA_CACHE
    text = path.read_text(encoding="utf-8")
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
