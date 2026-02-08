import { ALLOWED_KEYS } from "../data/controls.js";
import { getConfig } from "../config/store.js";

export function normalizeBindingValue(value) {
  if (!value) return null;
  const rawValue = `${value}`;
  if (rawValue === " ") return " ";
  const raw = rawValue.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "space" || raw === "spacebar") return " ";
  if (raw === "backslash") return "\\";
  if (raw === "slash" || raw === "forwardslash") return "/";
  if (raw === "control" || raw === "ctrl") return "control";
  if (raw === "shift") return "shift";
  if (raw === "none" || raw === "null") return null;
  return raw;
}

export function findBindingConflict(bindings, actionId, binding) {
  const normalized = normalizeBindingValue(binding);
  if (!normalized) return null;
  for (const [key, values] of Object.entries(bindings || {})) {
    if (key === actionId) continue;
    const list = Array.isArray(values) ? values : [values];
    if (list.some((value) => normalizeBindingValue(value) === normalized)) {
      return key;
    }
  }
  return null;
}

export function getControlBindings(node) {
  const config = getConfig(node);
  const normalizeList = (values) =>
    (Array.isArray(values) ? values : [values])
      .map((value) => normalizeBindingValue(value))
      .filter((value) => value);
  return {
    moveLeft: normalizeList(config.bindings.move_left),
    moveRight: normalizeList(config.bindings.move_right),
    rotateCw: normalizeList(config.bindings.rotate_cw),
    rotateCcw: normalizeList(config.bindings.rotate_ccw),
    softDrop: normalizeList(config.bindings.soft_drop),
    hardDrop: normalizeList(config.bindings.hard_drop),
    hold: normalizeList(config.bindings.hold),
    reset: normalizeList(config.bindings.reset),
    pause: normalizeList(config.bindings.pause),
    settings: normalizeList(config.bindings.settings),
  };
}

export function formatKeyLabel(value) {
  if (!value) return "";
  if (value === "null" || value === "none") return "";
  if (value === " ") return "Space";
  if (value === "\\") return "\\";
  if (value === "/") return "/";
  if (value === "control") return "Ctrl";
  if (value === "shift") return "Shift";
  if (value === "escape") return "Esc";
  if (value === "enter") return "Enter";
  if (value === "tab") return "Tab";
  if (value === "backspace") return "Bksp";
  if (value === "delete") return "Del";
  if (value === "insert") return "Ins";
  if (value === "home") return "Home";
  if (value === "end") return "End";
  if (value === "pageup") return "PgUp";
  if (value === "pagedown") return "PgDn";
  if (value === "arrowleft") return "Left Arrow";
  if (value === "arrowright") return "Right Arrow";
  if (value === "arrowup") return "Up Arrow";
  if (value === "arrowdown") return "Down Arrow";
  if (value.startsWith("numpad")) {
    const suffix = value.replace("numpad", "");
    if (/^\d+$/.test(suffix)) return `${suffix} (Numpad)`;
    const label = suffix ? `${suffix[0].toUpperCase()}${suffix.slice(1)}` : "";
    return label ? `${label} (Numpad)` : "Numpad";
  }
  return value.toUpperCase();
}

export function formatTimeMs(ms) {
  const total = Math.max(0, Math.floor(ms || 0));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  const mm = `${minutes}`.padStart(2, "0");
  const ss = `${seconds}`.padStart(2, "0");
  const cc = `${centis}`.padStart(2, "0");
  return `${mm}:${ss}.${cc}`;
}

function normalizeEventKey(event) {
  const key = event.key ? event.key.toLowerCase() : "";
  const code = event.code ? event.code.toLowerCase() : "";
  return { key, code };
}

export function bindingFromEvent(event) {
  if (event.altKey || event.metaKey) return null;
  if (["alt", "meta", "capslock", "numlock", "scrolllock"].includes(event.key?.toLowerCase())) {
    return null;
  }
  const { key, code } = normalizeEventKey(event);
  if (code && code.startsWith("numpad")) {
    return ALLOWED_KEYS.has(code) ? code : null;
  }
  if (key === " ") return " ";
  if (ALLOWED_KEYS.has(key)) return key;
  return null;
}

export function keyMatches(event, binding) {
  if (!binding) return false;
  const bindings = Array.isArray(binding) ? binding : [binding];
  const { key, code } = normalizeEventKey(event);
  return bindings.some((value) => {
    if (!value) return false;
    if (value === " ") return key === " " || code === "space";
    if (value.startsWith("numpad")) {
      return code === value;
    }
    return key === value;
  });
}
