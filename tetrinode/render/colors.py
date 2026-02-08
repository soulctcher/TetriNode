import json
import re

from ..constants import COLORS

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

