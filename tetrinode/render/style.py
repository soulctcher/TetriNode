import hashlib
import random

from ..constants import DEFAULT_BLOCK_STYLE, TEXTURE_ROTATIONS
from .colors import _clamp, _resolve_options

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
