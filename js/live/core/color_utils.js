import { parseRgbaString } from "../config/store.js";

export function clamp255(value) {
  const v = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(255, Math.max(0, v));
}

export function clamp01(value) {
  const v = Number.isFinite(value) ? value : 1;
  return Math.min(1, Math.max(0, v));
}

export function parseHexToRgba(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a: Number.isFinite(a) ? a : 1 };
}

export function parseColorComponents(value) {
  const rgba = parseRgbaString(value || "");
  if (rgba) {
    const parts = rgba
      .replace(/rgba?\(|\)/g, "")
      .split(",")
      .map((v) => Number.parseFloat(v.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
  }
  const hexParsed = parseHexToRgba(value);
  if (hexParsed) return hexParsed;
  return { r: 255, g: 255, b: 255, a: 1 };
}

export function rgbaString({ r, g, b, a }, allowAlpha) {
  const alpha = allowAlpha ? clamp01(a) : 1;
  return `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${alpha})`;
}

export function rgbToHex8(r, g, b, a = 1) {
  const alpha = Math.round(clamp01(a) * 255);
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(clamp255(r))}${toHex(clamp255(g))}${toHex(clamp255(b))}${toHex(alpha)}`;
}

export function rgbToHex6(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(clamp255(r))}${toHex(clamp255(g))}${toHex(clamp255(b))}`;
}

export function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  const hn = (Number.isFinite(h) ? h : 0) / 360;
  const sn = (Number.isFinite(s) ? s : 0) / 100;
  const ln = (Number.isFinite(l) ? l : 0) / 100;
  if (sn === 0) {
    const gray = Math.round(ln * 255);
    return { r: gray, g: gray, b: gray };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue2rgb = (pVal, qVal, t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return pVal + (qVal - pVal) * 6 * tt;
    if (tt < 1 / 2) return qVal;
    if (tt < 2 / 3) return pVal + (qVal - pVal) * (2 / 3 - tt) * 6;
    return pVal;
  };
  const r = hue2rgb(p, q, hn + 1 / 3);
  const g = hue2rgb(p, q, hn);
  const b = hue2rgb(p, q, hn - 1 / 3);
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

export function hsvToRgb(h, s, v) {
  const hh = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360;
  const ss = Number.isFinite(s) ? s : 0;
  const vv = Number.isFinite(v) ? v : 0;
  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hh < 60) {
    r1 = c;
    g1 = x;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
  } else if (hh < 180) {
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hslToRgbaString(h, s, l, a) {
  const rgb = hslToRgb(h, s, l);
  return rgbaString({ r: rgb.r, g: rgb.g, b: rgb.b, a }, true);
}

export function buildThemePaletteFromSwatch(hex, themeName) {
  const parsed = parseColorComponents(hex);
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const hue = hsl.h;
  const sat = hsl.s;
  const baseLight = hsl.l;
  const isGlass = themeName === "glass";
  const isMinimal = themeName === "minimal";
  const isNeon = themeName === "neon";
  const panelBgAlpha = isGlass ? 0.82 : isMinimal ? 0.9 : 0.92;
  const panelBgLight = Math.max(10, Math.min(18, baseLight * 0.25));
  const panelBgSat = Math.max(8, Math.min(40, sat * 0.4));
  const panelBorderLight = Math.max(45, Math.min(80, baseLight + 5));
  const panelBorderSat = Math.max(25, Math.min(85, sat * 0.8 + 10));
  const panelShadowLight = Math.max(4, Math.min(12, baseLight * 0.2));
  return {
    panel_bg: hslToRgbaString(hue, panelBgSat, panelBgLight, panelBgAlpha),
    panel_border: hslToRgbaString(hue, panelBorderSat, panelBorderLight, isNeon ? 0.45 : 0.25),
    panel_shadow: hslToRgbaString(hue, Math.max(5, panelBgSat * 0.3), panelShadowLight, 0.35),
    button: hex,
    text: "#FFFFFF",
    button_bg: hslToRgbaString(hue, Math.min(80, sat), Math.max(20, Math.min(55, baseLight)), 0.12),
    button_hover: hslToRgbaString(
      hue,
      Math.min(85, sat),
      Math.max(30, Math.min(65, baseLight + 8)),
      0.24,
    ),
    accent: hex,
  };
}

export function colorToHex(value, allowAlpha) {
  const parsed = parseColorComponents(value || "");
  if (!parsed) return "";
  return allowAlpha
    ? rgbToHex8(parsed.r, parsed.g, parsed.b, parsed.a)
    : rgbToHex6(parsed.r, parsed.g, parsed.b);
}

export function getContrastTextColor(value) {
  const parsed = parseColorComponents(value || "");
  if (!parsed) return "#fff";
  const r = parsed.r / 255;
  const g = parsed.g / 255;
  const b = parsed.b / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#000" : "#fff";
}

export function toOpaqueColor(value) {
  const parsed = parseColorComponents(value || "");
  if (!parsed) return "#000";
  return rgbaString({ ...parsed, a: 1 }, true);
}

export function applySwatchBackground(element, value, showCheckerboard) {
  const parsed = parseColorComponents(value || "");
  const alpha = parsed?.a ?? 1;
  const checkerboardBg =
    "linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%)," +
    "linear-gradient(-45deg, rgba(255,255,255,0.25) 25%, transparent 25%)," +
    "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.25) 75%)," +
    "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.25) 75%)";
  element.style.backgroundSize = "10px 10px";
  element.style.backgroundPosition = "0 0, 0 5px, 5px -5px, -5px 0px";
  element.style.backgroundImage = showCheckerboard && alpha < 1 ? checkerboardBg : "none";
  element.style.backgroundColor = rgbaString(parsed, true);
}

export function adjustColorByFactor(color, factor) {
  const parsed = parseColorComponents(color || "");
  const clamp = (value) => Math.min(255, Math.max(0, Math.round(value)));
  const mix = (channel) => {
    if (factor >= 0) {
      return clamp(channel + (255 - channel) * factor);
    }
    return clamp(channel * (1 + factor));
  };
  return rgbaString(
    {
      r: mix(parsed.r),
      g: mix(parsed.g),
      b: mix(parsed.b),
      a: parsed.a ?? 1,
    },
    true,
  );
}

export function colorWithAlpha(color, alpha) {
  const parsed = parseColorComponents(color || "");
  if (!parsed) return color;
  return rgbaString({ r: parsed.r, g: parsed.g, b: parsed.b, a: alpha }, true);
}

export function adjustColorHsl(color, saturationShift, brightnessShift) {
  const parsed = parseColorComponents(color || "");
  const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
  const nextS = Math.min(100, Math.max(0, hsl.s + saturationShift * 100));
  const nextL = Math.min(100, Math.max(0, hsl.l + brightnessShift * 100));
  const rgb = hslToRgb(hsl.h, nextS, nextL);
  return rgbaString({ r: rgb.r, g: rgb.g, b: rgb.b, a: parsed.a ?? 1 }, true);
}

export function mixColors(colorA, colorB, t) {
  const a = parseColorComponents(colorA || "");
  const b = parseColorComponents(colorB || "");
  const lerp = (v1, v2) => v1 + (v2 - v1) * t;
  return rgbaString(
    {
      r: Math.round(lerp(a.r, b.r)),
      g: Math.round(lerp(a.g, b.g)),
      b: Math.round(lerp(a.b, b.b)),
      a: (a.a ?? 1) + ((b.a ?? 1) - (a.a ?? 1)) * t,
    },
    true,
  );
}
