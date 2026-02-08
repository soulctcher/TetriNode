import { COLORS } from "../data/colors.js";
import { DEFAULT_CONFIG } from "../data/defaults.js";

export function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeConfig(defaults, stored) {
  if (!stored || typeof stored !== "object") return cloneDeep(defaults);
  const result = Array.isArray(defaults) ? [] : {};
  for (const [key, value] of Object.entries(defaults)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = mergeConfig(value, stored[key]);
    } else if (Array.isArray(value)) {
      const storedValue = stored[key];
      result[key] = Array.isArray(storedValue) ? storedValue.slice(0, 5) : value.slice();
    } else if (stored[key] !== undefined) {
      result[key] = stored[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function parseHexColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a))})`;
}

export function parseRgbaString(value) {
  if (typeof value !== "string") return null;
  const rgbaMatch = value.match(
    /^rgba?\s*\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*([0-9]*\.?[0-9]+))?\s*\)$/i,
  );
  if (!rgbaMatch) return null;
  const r = Number.parseInt(rgbaMatch[1], 10);
  const g = Number.parseInt(rgbaMatch[2], 10);
  const b = Number.parseInt(rgbaMatch[3], 10);
  const a = rgbaMatch[4] != null ? Number.parseFloat(rgbaMatch[4]) : 1;
  if ([r, g, b].some((v) => !Number.isFinite(v) || v < 0 || v > 255)) return null;
  const clampedA = Math.min(1, Math.max(0, Number.isFinite(a) ? a : 1));
  return `rgba(${r},${g},${b},${clampedA})`;
}

export function normalizeColor(value, allowAlpha = true) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) {
    const parsed = parseHexColor(trimmed);
    return parsed;
  }
  const rgba = parseRgbaString(trimmed);
  if (rgba) {
    if (!allowAlpha) return rgba.replace(/,([0-9.]+)\)$/, ",1)");
    return rgba;
  }
  return null;
}

export function getConfig(node) {
  if (!node) return cloneDeep(DEFAULT_CONFIG);
  if (!node.properties) node.properties = {};
  const stored = node.properties.tetrinode_config;
  const merged = mergeConfig(DEFAULT_CONFIG, stored);
  node.properties.tetrinode_config = merged;
  return merged;
}

export function updateConfig(node, updater, onConfigChanged = null) {
  const current = getConfig(node);
  const next = updater(cloneDeep(current));
  node.properties.tetrinode_config = next;
  if (node.__tetrisLive?.state) {
    node.__tetrisLive.state.boardDirty = true;
    node.__tetrisLive.boardCacheKey = null;
  }
  if (typeof onConfigChanged === "function") {
    onConfigChanged(node, next);
  }
  return next;
}

export function getOptionsForState(node) {
  const config = getConfig(node);
  return {
    ghost_piece: !!config.ghost_piece,
    next_piece: !!config.next_piece,
    hold_queue: !!config.hold_queue,
    show_controls: !!config.show_controls,
    lock_down_mode: config.lock_down_mode,
    start_level: config.start_level,
    level_progression: config.level_progression,
    queue_size: config.queue_size,
    grid_enabled: !!config.grid_enabled,
    grid_color: config.grid_color,
    anim_hard_drop_trail: config.anim_hard_drop_trail !== false,
    anim_lock_flash: config.anim_lock_flash !== false,
    anim_line_clear: config.anim_line_clear !== false,
    anim_score_toasts: config.anim_score_toasts !== false,
    block_style: cloneDeep(config.block_style || DEFAULT_CONFIG.block_style),
    ...config.colors,
  };
}

export function getColorPalette(node) {
  const palette = { ...COLORS };
  const config = getConfig(node);
  const mapping = {
    color_i: "I",
    color_j: "J",
    color_l: "L",
    color_o: "O",
    color_s: "S",
    color_t: "T",
    color_z: "Z",
    background_color: "X",
  };
  for (const [key, shape] of Object.entries(mapping)) {
    const raw = config.colors?.[key];
    const parsed = normalizeColor(raw, false);
    if (parsed) palette[shape] = parsed;
  }
  return palette;
}

export function isGhostEnabled(node) {
  return !!getConfig(node).ghost_piece;
}

export function getQueueSize(node) {
  const parsed = Number.parseInt(`${getConfig(node).queue_size}`, 10);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(0, Math.min(6, parsed));
}

export function getHoldEnabled(node) {
  return !!getConfig(node).hold_queue;
}

export function getNextPieceEnabled(node) {
  return !!getConfig(node).next_piece;
}

export function getShowControls(node) {
  return !!getConfig(node).show_controls;
}

export function getGridEnabled(node) {
  return !!getConfig(node).grid_enabled;
}

export function getGridColor(node) {
  const raw = getConfig(node).grid_color;
  const parsed = normalizeColor(raw, true);
  return parsed || "rgba(255,255,255,0.2)";
}
