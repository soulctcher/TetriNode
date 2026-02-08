export const CONTROL_ACTIONS = [
  { id: "move_left", label: "Move Left" },
  { id: "move_right", label: "Move Right" },
  { id: "rotate_cw", label: "Rotate CW" },
  { id: "rotate_ccw", label: "Rotate CCW" },
  { id: "soft_drop", label: "Soft Drop" },
  { id: "hard_drop", label: "Hard Drop" },
  { id: "hold", label: "Hold" },
  { id: "reset", label: "Reset" },
  { id: "pause", label: "Pause" },
  { id: "settings", label: "Settings" },
];
export const ALLOWED_KEYS = new Set([
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p",
  "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "arrowleft", "arrowright", "arrowup", "arrowdown",
  " ", "enter", "tab", "escape", "backspace", "delete", "insert",
  "home", "end", "pageup", "pagedown",
  "control", "shift",
  "numpad0", "numpad1", "numpad2", "numpad3", "numpad4",
  "numpad5", "numpad6", "numpad7", "numpad8", "numpad9",
  "numpadadd", "numpadsubtract", "numpadmultiply", "numpaddivide", "numpaddecimal", "numpadenter",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
  "-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "`",
]);
export const CONTROL_ACTION_LABELS = Object.fromEntries(
  CONTROL_ACTIONS.map((action) => [action.id, action.label]),
);
