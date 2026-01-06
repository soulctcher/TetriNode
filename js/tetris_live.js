import { app } from "../../scripts/app.js";

const EXT_NAME = "tetrinode.live";
const NODE_CLASS = "TetriNode";

const GRID_W = 10;
const GRID_H_TOTAL = 40;
const GRID_H_VISIBLE = 20;
const HIDDEN_ROWS = GRID_H_TOTAL - GRID_H_VISIBLE;
const EXTRA_VISIBLE_ROWS = 1 / 3;
const SPAWN_Y = HIDDEN_ROWS - 2;
const PREVIEW_GRID = 4;
const PREVIEW_SCALE = 0.86;
const BLOCK = 16;
const PADDING = 12;
const HEADER_H = 28;
const TOOLBAR_H = 44;
const CONTROL_GAP = 0;
const CONTROL_MIN = 110;
const DAS_MS = 300;
const ARR_MS = 56;
const IMAGE_CACHE = new Map();

const COLORS = {
  I: "rgb(85,214,255)",
  J: "rgb(86,105,255)",
  L: "rgb(255,167,71)",
  O: "rgb(255,231,87)",
  S: "rgb(122,235,132)",
  T: "rgb(187,128,255)",
  Z: "rgb(255,118,118)",
  X: "rgb(50,52,62)",
  Text: "rgb(235,235,235)",
  Overlay: "rgba(0,0,0,0.55)",
};

const THEME_PRESETS = {
  glass: {
    panel_bg: "rgba(20,24,32,0.55)",
    panel_border: "rgba(255,255,255,0.18)",
    panel_shadow: "rgba(0,0,0,0.35)",
    accent: "rgba(120,200,255,0.9)",
    text: "#F2F5F8",
    button_bg: "rgba(255,255,255,0.08)",
    button_hover: "rgba(255,255,255,0.18)",
  },
  flat: {
    panel_bg: "rgba(30,30,34,0.92)",
    panel_border: "rgba(255,255,255,0.12)",
    panel_shadow: "rgba(0,0,0,0.25)",
    accent: "#5BD7FF",
    text: "#F2F2F2",
    button_bg: "rgba(255,255,255,0.06)",
    button_hover: "rgba(255,255,255,0.16)",
  },
  neon: {
    panel_bg: "rgba(12,12,18,0.82)",
    panel_border: "rgba(120,255,200,0.35)",
    panel_shadow: "rgba(0,0,0,0.35)",
    accent: "#7CFFB0",
    text: "#E9FFF4",
    button_bg: "rgba(124,255,176,0.08)",
    button_hover: "rgba(124,255,176,0.2)",
  },
  minimal: {
    panel_bg: "rgba(24,26,28,0.9)",
    panel_border: "rgba(255,255,255,0.08)",
    panel_shadow: "rgba(0,0,0,0.2)",
    accent: "#A6B0FF",
    text: "#F4F4F4",
    button_bg: "rgba(255,255,255,0.05)",
    button_hover: "rgba(255,255,255,0.12)",
  },
};

const DEFAULT_CONFIG = {
  theme: "glass",
  theme_colors: JSON.parse(JSON.stringify(THEME_PRESETS)),
  bindings: {
    move_left: ["arrowleft", "numpad4"],
    move_right: ["arrowright", "numpad6"],
    rotate_cw: ["arrowup", "numpad5", "x", "numpad1", "numpad9"],
    rotate_ccw: ["control", "numpad3", "z", "numpad7"],
    soft_drop: ["arrowdown", "numpad2"],
    hard_drop: [" ", "numpad8"],
    hold: ["shift", "numpad0", "c"],
    reset: ["r"],
    pause: ["escape", "f1"],
  },
  colors: {
    color_i: "#55D6FF",
    color_j: "#5669FF",
    color_l: "#FFA74F",
    color_o: "#FFE757",
    color_s: "#7AEB84",
    color_t: "#BB80FF",
    color_z: "#FF7676",
    background_color: "#32343E",
  },
  ghost_piece: true,
  next_piece: true,
  hold_queue: true,
  show_controls: true,
  lock_down_mode: "extended",
  start_level: 1,
  level_progression: "fixed",
  queue_size: 6,
  grid_enabled: true,
  grid_color: "rgba(255,255,255,0.2)",
};

const ALLOWED_KEYS = new Set([
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

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
};

function createRng(seed, stateOverride = null) {
  let state = stateOverride != null ? stateOverride : seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return {
    next: () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / 2147483646;
    },
    getState: () => state,
    setState: (value) => {
      state = value;
    },
  };
}

function shuffledBag(rng) {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

function newPiece(shape) {
  return { shape, rot: 0, x: 3, y: SPAWN_Y };
}

function pieceBottomY(piece) {
  return Math.max(...pieceCells(piece).map(([, y]) => y));
}

function emptyBoard() {
  const board = [];
  for (let y = 0; y < GRID_H_TOTAL; y += 1) {
    const row = new Array(GRID_W).fill(0);
    board.push(row);
  }
  return board;
}

function pieceCells(piece) {
  const shape = SHAPES[piece.shape][piece.rot % 4];
  return shape.map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
}

function collides(board, piece) {
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H_TOTAL) return true;
    if (board[y][x]) return true;
  }
  return false;
}

function lockPiece(board, piece) {
  for (const [x, y] of pieceCells(piece)) {
    if (y >= 0 && y < GRID_H_TOTAL && x >= 0 && x < GRID_W) {
      board[y][x] = piece.shape;
    }
  }
}

function clearLines(board) {
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = GRID_H_TOTAL - remaining.length;
  while (remaining.length < GRID_H_TOTAL) {
    remaining.unshift(new Array(GRID_W).fill(0));
  }
  return { board: remaining, cleared };
}

function createState(seed, startLevel = 1, levelProgression = "fixed") {
  const rng = createRng(seed);
  const bag = shuffledBag(rng);
  const piece = newPiece(bag.shift());
  const nextShape = bag.shift();
  const start = clampLevel(startLevel);
  const level = start;
  const progression = levelProgression === "variable" ? "variable" : "fixed";
  const baseDropMs = Math.max(1, Math.round(fallSpeedSeconds(level) * 1000));
  return {
    seed,
    rng,
    bag,
    bagCount: 0,
    piece,
    nextShape,
    holdShape: null,
    holdUsed: false,
    board: emptyBoard(),
    score: 0,
    timeMs: 0,
    lines: 0,
    tetrises: 0,
    tspins: 0,
    comboStreak: 0,
    comboTotal: 0,
    startLevel: start,
    level,
    levelProgression: progression,
    goalLinesTotal: 0,
    goalRemaining: progression === "fixed" ? 10 : 5 * start,
    b2bActive: false,
    running: false,
    started: false,
    gameOver: false,
    baseDropMs,
    dropMs: baseDropMs,
    elapsed: 0,
    lockDelayMs: 500,
    lockElapsed: 0,
    locking: false,
    softDrop: false,
    lastAction: null,
    lastRotateKick: null,
    tspin: "none",
    lockMoves: 0,
    lowestY: pieceBottomY(piece),
    moveDir: null,
    moveHeldLeft: false,
    moveHeldRight: false,
    moveDasElapsed: 0,
    moveArrElapsed: 0,
    timer: null,
  };
}

function hydrateState(serialized, fallbackSeed, startLevel = 1) {
  if (!serialized || typeof serialized !== "string") return null;
  let data = null;
  try {
    data = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const seed = Number.isInteger(data.seed) ? data.seed : fallbackSeed ?? 0;
  const progression = data.level_progression === "variable" ? "variable" : "fixed";
  const base = createState(seed, data.start_level || startLevel, progression);
  if (Array.isArray(data.board)) {
    base.board = data.board;
  }
  if (Array.isArray(data.bag)) {
    base.bag = data.bag.slice();
  }
  if (Number.isInteger(data.bag_count)) base.bagCount = data.bag_count;
  if (data.piece && typeof data.piece === "object") {
    base.piece = {
      shape: data.piece.shape,
      rot: data.piece.rot,
      x: data.piece.x,
      y: data.piece.y,
    };
  }
  if (data.next_piece_shape) base.nextShape = data.next_piece_shape;
  if (data.hold_piece_shape !== undefined) base.holdShape = data.hold_piece_shape;
  if (typeof data.hold_used === "boolean") base.holdUsed = data.hold_used;
  if (Number.isInteger(data.score)) base.score = data.score;
  if (Number.isFinite(data.time_ms)) base.timeMs = data.time_ms;
  if (Number.isInteger(data.lines_cleared_total)) base.lines = data.lines_cleared_total;
  if (Number.isFinite(data.goal_lines_total)) base.goalLinesTotal = data.goal_lines_total;
  if (Number.isInteger(data.level)) base.level = data.level;
  if (Number.isInteger(data.start_level)) base.startLevel = data.start_level;
  base.levelProgression = progression;
  if (typeof data.b2b_active === "boolean") base.b2bActive = data.b2b_active;
  if (typeof data.game_over === "boolean") base.gameOver = data.game_over;
  if (data.tspin) base.tspin = data.tspin;
  if (Number.isInteger(data.tetrises)) base.tetrises = data.tetrises;
  if (Number.isInteger(data.tspins)) base.tspins = data.tspins;
  if (Number.isInteger(data.combo_total)) base.comboTotal = data.combo_total;
  if (Number.isInteger(data.combo_streak)) base.comboStreak = data.combo_streak;
  updateLevel(base);
  base.running = false;
  base.started = false;
  return base;
}

function fallSpeedSeconds(level) {
  const lvl = Math.max(1, Math.min(15, Math.floor(level || 1)));
  const base = 0.8 - (lvl - 1) * 0.007;
  return Math.pow(base, lvl - 1);
}

function clampLevel(value) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(15, parsed));
}

function updateLevel(state) {
  let target = state.startLevel;
  const progression = state.levelProgression === "variable" ? "variable" : "fixed";
  if (progression === "fixed") {
    state.goalLinesTotal = state.lines;
    target = clampLevel(state.startLevel + Math.floor(state.lines / 10));
  } else {
    let remaining = state.goalLinesTotal;
    let lvl = state.startLevel;
    while (lvl < 15) {
      const goal = 5 * lvl;
      if (remaining < goal) break;
      remaining -= goal;
      lvl += 1;
    }
    target = clampLevel(lvl);
  }
  if (state.level !== target) {
    state.level = target;
  }
  if (progression === "fixed") {
    if (state.level >= 15) {
      state.goalRemaining = 0;
    } else {
      const linesIntoLevel = state.lines - (state.level - state.startLevel) * 10;
      state.goalRemaining = Math.max(0, 10 - linesIntoLevel);
    }
  } else {
    let remaining = state.goalLinesTotal;
    let lvl = state.startLevel;
    while (lvl < 15 && remaining >= 5 * lvl) {
      remaining -= 5 * lvl;
      lvl += 1;
    }
    state.goalRemaining = lvl >= 15 ? 0 : Math.max(0, 5 * lvl - remaining);
  }
  state.baseDropMs = Math.max(1, Math.round(fallSpeedSeconds(state.level) * 1000));
  state.dropMs = state.softDrop
    ? Math.max(1, Math.floor(state.baseDropMs / 20))
    : state.baseDropMs;
}

function awardedGoalLines(lines, tspinType, b2bActive) {
  let base = 0;
  let qualifies = false;
  if (tspinType === "tspin") {
    if (lines === 0) base = 4;
    else if (lines === 1) {
      base = 8;
      qualifies = true;
    } else if (lines === 2) {
      base = 12;
      qualifies = true;
    } else if (lines === 3) {
      base = 16;
      qualifies = true;
    }
  } else if (tspinType === "mini") {
    if (lines === 0) base = 1;
    else {
      base = 2;
      qualifies = true;
    }
  } else {
    if (lines === 1) base = 1;
    else if (lines === 2) base = 3;
    else if (lines === 3) base = 5;
    else if (lines === 4) {
      base = 8;
      qualifies = true;
    }
  }
  if (qualifies && b2bActive && base > 0) {
    base += base * 0.5;
  }
  return base;
}

function scoreForClear(level, lines, tspinType, b2bActive) {
  let base = 0;
  let qualifies = false;
  if (tspinType === "tspin") {
    if (lines === 0) {
      base = 400 * level;
    } else if (lines === 1) {
      base = 800 * level;
      qualifies = true;
    } else if (lines === 2) {
      base = 1200 * level;
      qualifies = true;
    } else if (lines === 3) {
      base = 1600 * level;
      qualifies = true;
    }
  } else if (tspinType === "mini") {
    if (lines === 0) {
      base = 100 * level;
    } else {
      base = 200 * level;
      qualifies = true;
    }
  } else {
    if (lines === 1) {
      base = 100 * level;
    } else if (lines === 2) {
      base = 300 * level;
    } else if (lines === 3) {
      base = 500 * level;
    } else if (lines === 4) {
      base = 800 * level;
      qualifies = true;
    }
  }

  let bonus = 0;
  let nextB2b = b2bActive;
  if (qualifies) {
    if (b2bActive) {
      bonus = Math.floor(base * 0.5);
    }
    nextB2b = true;
  } else if (lines >= 1 && lines <= 3) {
    nextB2b = false;
  }

  return { points: base + bonus, b2bActive: nextB2b };
}

function ensureBag(state) {
  if (state.bag.length === 0) {
    state.bag = shuffledBag(state.rng);
    state.bagCount += 1;
  }
}

function getUpcomingShapes(state, count) {
  if (count <= 0) return [];
  const upcoming = [state.nextShape, ...state.bag];
  if (upcoming.length >= count) return upcoming.slice(0, count);
  const rngClone = createRng(state.seed, state.rng.getState());
  while (upcoming.length < count) {
    const bag = shuffledBag(rngClone);
    for (const shape of bag) {
      upcoming.push(shape);
      if (upcoming.length >= count) break;
    }
  }
  return upcoming.slice(0, count);
}

function spawnNext(state) {
  state.piece = newPiece(state.nextShape);
  ensureBag(state);
  state.nextShape = state.bag.shift();
  state.holdUsed = false;
  state.lockMoves = 0;
  state.lowestY = pieceBottomY(state.piece);
  state.locking = false;
  state.lockElapsed = 0;
  updateLevel(state);
  if (collides(state.board, state.piece)) {
    state.gameOver = true;
    state.running = false;
  }
}

function updateLowestY(state) {
  const bottom = pieceBottomY(state.piece);
  if (state.lowestY == null || bottom > state.lowestY) {
    state.lowestY = bottom;
    state.lockMoves = 0;
    if (state.locking) {
      state.lockElapsed = 0;
    }
    return true;
  }
  return false;
}

function stepDown(state) {
  const moved = { ...state.piece, y: state.piece.y + 1 };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    state.locking = false;
    state.lockElapsed = 0;
    updateLowestY(state);
    state.lastAction = "move";
    if (state.softDrop) {
      state.score += 1;
    }
    return;
  }
  if (!state.locking) {
    state.locking = true;
    state.lockElapsed = 0;
  }
}

function cornerOccupied(board, x, y) {
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H_TOTAL) return true;
  return board[y][x] !== 0;
}

function tspinType(state) {
  const piece = state.piece;
  if (piece.shape !== "T" || state.lastAction !== "rotate") return "none";
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  const corners = {
    A: [cx - 1, cy - 1],
    B: [cx + 1, cy - 1],
    C: [cx - 1, cy + 1],
    D: [cx + 1, cy + 1],
  };
  const rot = piece.rot % 4;
  let front = ["A", "B"];
  let back = ["C", "D"];
  if (rot === 1) {
    front = ["B", "D"];
    back = ["A", "C"];
  } else if (rot === 2) {
    front = ["C", "D"];
    back = ["A", "B"];
  } else if (rot === 3) {
    front = ["A", "C"];
    back = ["B", "D"];
  }
  const frontHits = front.reduce((acc, k) => acc + (cornerOccupied(state.board, ...corners[k]) ? 1 : 0), 0);
  const backHits = back.reduce((acc, k) => acc + (cornerOccupied(state.board, ...corners[k]) ? 1 : 0), 0);
  if (state.lastRotateKick === 4) return "tspin";
  if (frontHits + backHits < 3) return "none";
  if (frontHits === 2 && backHits === 2) return "tspin";
  if (frontHits === 2 && backHits >= 1) return "tspin";
  if (backHits === 2 && frontHits >= 1) return "mini";
  return "none";
}

function settlePiece(state) {
  lockPiece(state.board, state.piece);
  state.tspin = tspinType(state);
  const levelBefore = state.level;
  const prevB2b = state.b2bActive;
  const result = clearLines(state.board);
  state.board = result.board;
  if (result.cleared > 0) {
    state.lines += result.cleared;
    state.comboStreak = (state.comboStreak || 0) + 1;
    if (state.comboStreak === 2) {
      state.comboTotal = (state.comboTotal || 0) + 1;
    }
    if (result.cleared === 4) {
      state.tetrises = (state.tetrises || 0) + 1;
    }
    if (state.tspin !== "none") {
      state.tspins = (state.tspins || 0) + 1;
    }
  } else {
    state.comboStreak = 0;
  }
  const scored = scoreForClear(levelBefore, result.cleared, state.tspin, state.b2bActive);
  state.score += scored.points;
  state.b2bActive = scored.b2bActive;
  if (state.levelProgression === "variable") {
    state.goalLinesTotal += awardedGoalLines(result.cleared, state.tspin, prevB2b);
  }
  updateLevel(state);
  state.locking = false;
  state.lockElapsed = 0;
  spawnNext(state);
}

function serializeState(state) {
  return JSON.stringify({
    version: 1,
    board: state.board,
    bag: state.bag.slice(),
    bag_count: state.bagCount,
    seed: state.seed,
    start_level: state.startLevel,
    level: state.level,
    level_progression: state.levelProgression,
    b2b_active: state.b2bActive,
    goal_lines_total: state.goalLinesTotal,
    piece: { ...state.piece },
    next_piece_shape: state.nextShape,
    hold_piece_shape: state.holdShape,
    hold_used: state.holdUsed,
    score: state.score,
    time_ms: state.timeMs,
    lines_cleared_total: state.lines,
    tetrises: state.tetrises,
    tspins: state.tspins,
    combo_streak: state.comboStreak,
    combo_total: state.comboTotal,
    game_over: state.gameOver,
    tspin: state.tspin,
    options: state.options || {},
  });
}

function updateBackendState(node) {
  if (!node?.widgets) return;
  const stateWidget = node.widgets.find((w) => w.name === "state");
  const actionWidget = node.widgets.find((w) => w.name === "action");
  const stateIndex = node.widgets.indexOf(stateWidget);
  const actionIndex = node.widgets.indexOf(actionWidget);
  if (!node.widgets_values) {
    node.widgets_values = [];
  }
  if (stateWidget) {
    node.__tetrisLive.state.options = getOptionsForState(node);
    const stateValue = serializeState(node.__tetrisLive.state);
    stateWidget.value = stateValue;
    if (stateIndex >= 0) node.widgets_values[stateIndex] = stateValue;
  }
  if (actionWidget) {
    actionWidget.value = "sync";
    if (actionIndex >= 0) node.widgets_values[actionIndex] = "sync";
  }
  if (node.widgets?.length) {
    node.widgets_values = node.widgets.map((w) => w.value);
  }
}

function move(state, dx, dy, opts = {}) {
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    if (!opts.skipLastAction) {
      state.lastAction = "move";
    }
    updateLowestY(state);
    return true;
  }
  return false;
}

function rotate(state, delta) {
  const rotated = rotateWithKick(state.board, state.piece, delta);
  if (rotated) {
    state.piece = rotated.piece;
    state.lastAction = "rotate";
    state.lastRotateKick = rotated.kick;
    updateLowestY(state);
    return true;
  }
  return false;
}

function kickTable(shape, fromRot, toRot) {
  if (shape === "O") return [[0, 0]];
  if (shape === "I") {
    const table = {
      "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
      "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
      "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
      "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
      "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
      "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    };
    return table[`${fromRot}>${toRot}`] || [[0, 0]];
  }
  const table = {
    "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  return table[`${fromRot}>${toRot}`] || [[0, 0]];
}

function rotateWithKick(board, piece, delta) {
  const fromRot = piece.rot % 4;
  const toRot = (fromRot + delta + 4) % 4;
  const kicks = kickTable(piece.shape, fromRot, toRot);
  for (let i = 0; i < kicks.length; i += 1) {
    const [dx, dy] = kicks[i];
    const candidate = { ...piece, rot: toRot, x: piece.x + dx, y: piece.y + dy };
    if (!collides(board, candidate)) return { piece: candidate, kick: i };
  }
  return null;
}

function hardDrop(state) {
  let moved = 0;
  while (move(state, 0, 1, { skipLastAction: true })) {
    moved += 1;
    // keep dropping
  }
  if (moved > 0) {
    state.score += moved * 2;
  }
  settlePiece(state);
}

function holdPiece(state) {
  if (state.holdUsed || state.gameOver) return false;
  const currentShape = state.piece.shape;
  if (state.holdShape) {
    const swapShape = state.holdShape;
    state.holdShape = currentShape;
    state.piece = newPiece(swapShape);
  } else {
    state.holdShape = currentShape;
    ensureBag(state);
    state.piece = newPiece(state.nextShape);
    state.nextShape = state.bag.shift();
  }
  state.holdUsed = true;
  state.lockMoves = 0;
  state.lowestY = pieceBottomY(state.piece);
  state.locking = false;
  state.lockElapsed = 0;
  state.lastAction = "hold";
  state.lastRotateKick = null;
  state.tspin = "none";
  updateLevel(state);
  if (collides(state.board, state.piece)) {
    state.gameOver = true;
    state.running = false;
  }
  return true;
}

function getLayout(node) {
  const pauseBottom = null;
  const minTop = HEADER_H + PADDING + TOOLBAR_H + CONTROL_MIN;
  const topY = Math.max(minTop, HEADER_H + PADDING + TOOLBAR_H + CONTROL_GAP);
  const bottomY = Math.max(topY, node.size[1] - PADDING);
  const innerH = Math.max(0, bottomY - topY);
  const innerW = Math.max(0, node.size[0] - PADDING * 2);

  const showHold = getHoldEnabled(node);
  const showNext = getNextPieceEnabled(node);
  const sideSlots = 2;

  let sideW = 120;
  let blockSize = BLOCK;
  const effectiveRows = GRID_H_VISIBLE + EXTRA_VISIBLE_ROWS;
  for (let i = 0; i < 2; i += 1) {
    const boardW = Math.max(0, innerW - sideW * sideSlots - PADDING * sideSlots);
    blockSize = Math.floor(Math.min(boardW / GRID_W, innerH / effectiveRows));
    blockSize = Math.max(6, blockSize);
    sideW = Math.max(PREVIEW_GRID * blockSize + PADDING * 2, 120);
  }

  const boardW = blockSize * GRID_W;
  const extraPx = Math.round(blockSize * EXTRA_VISIBLE_ROWS);
  const boardH = blockSize * GRID_H_VISIBLE + extraPx;
  const boardX = Math.max(PADDING, Math.round((node.size[0] - boardW) / 2));
  const boardY = Math.round(topY);
  const sideX = Math.round(boardX + boardW + PADDING);
  const sideY = boardY;

  node.__tetrisLastLayout = {
    boardY,
    pauseBottom,
  };

  return {
    boardX,
    boardY,
    boardW,
    boardH,
    sideX,
    sideY,
    sideW,
    blockSize,
    extraPx,
    showHold,
    showNext,
  };
}

function getLockMode(node) {
  const defaultMode = "extended";
  const raw = `${getConfig(node).lock_down_mode || ""}`.trim().toLowerCase();
  if (["extended", "infinite", "classic"].includes(raw)) return raw;
  return defaultMode;
}

function applyLockModeAfterAction(state, mode) {
  const onSurface = collides(state.board, { ...state.piece, y: state.piece.y + 1 });
  if (!onSurface) {
    state.locking = false;
    state.lockElapsed = 0;
    return;
  }
  state.locking = true;
  if (mode === "classic") {
    return;
  }
  if (mode === "infinite") {
    state.lockElapsed = 0;
    return;
  }
  if (state.lockMoves < 15) {
    state.lockMoves += 1;
    state.lockElapsed = 0;
  } else {
    state.lockElapsed = state.lockDelayMs;
  }
}

function setMoveDirection(state, dir) {
  if (state.moveDir === dir) return;
  state.moveDir = dir;
  state.moveDasElapsed = 0;
  state.moveArrElapsed = 0;
}

function clearMoveDirection(state) {
  state.moveDir = null;
  state.moveDasElapsed = 0;
  state.moveArrElapsed = 0;
}

function updateAutoRepeat(state, node, deltaMs) {
  if (!state.moveDir) return;
  state.moveDasElapsed += deltaMs;
  if (state.moveDasElapsed < DAS_MS) return;
  state.moveArrElapsed += deltaMs;
  while (state.moveArrElapsed >= ARR_MS) {
    state.moveArrElapsed -= ARR_MS;
    const dx = state.moveDir === "left" ? -1 : 1;
    if (move(state, dx, 0)) {
      applyLockModeAfterAction(state, getLockMode(node));
    }
  }
}

function drawBlockSized(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size - 1, size - 1);
}

function ghostLandingY(state) {
  const ghost = { ...state.piece };
  while (!collides(state.board, { ...ghost, y: ghost.y + 1 })) {
    ghost.y += 1;
  }
  return ghost.y;
}

function drawGhostPiece(ctx, state, boardX, boardY, blockSize, color, outlineColor) {
  const ghostY = ghostLandingY(state);
  const ghost = { ...state.piece, y: ghostY };
  const cells = pieceCells(ghost);
  ctx.globalAlpha = 0.33;
  for (const [x, y] of cells) {
    if (y >= HIDDEN_ROWS - 1 && y < GRID_H_TOTAL) {
      ctx.fillStyle = color;
      ctx.fillRect(
        boardX + x * blockSize,
        boardY + (y - HIDDEN_ROWS) * blockSize,
        blockSize - 1,
        blockSize - 1
      );
    }
  }
  ctx.globalAlpha = 0.67;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 1;
  for (const [x, y] of cells) {
    if (y >= HIDDEN_ROWS - 1 && y < GRID_H_TOTAL) {
      ctx.strokeRect(
        boardX + x * blockSize + 0.5,
        boardY + (y - HIDDEN_ROWS) * blockSize + 0.5,
        blockSize - 2,
        blockSize - 2
      );
    }
  }
  ctx.globalAlpha = 1;
}

function getInputDataByName(node, name) {
  const idx = node?.inputs?.findIndex((inp) => inp?.name === name);
  if (idx == null || idx < 0) return null;
  if (typeof node.getInputData !== "function") return null;
  return node.getInputData(idx);
}

function coerceImageSource(value) {
  if (!value) return null;
  if (
    value instanceof HTMLImageElement ||
    value instanceof HTMLCanvasElement ||
    value instanceof ImageBitmap ||
    value instanceof OffscreenCanvas ||
    value instanceof HTMLVideoElement
  ) {
    return value;
  }
  if (value.image) {
    const img = value.image;
    if (
      img instanceof HTMLImageElement ||
      img instanceof HTMLCanvasElement ||
      img instanceof ImageBitmap ||
      img instanceof OffscreenCanvas
    ) {
      return img;
    }
  }
  return null;
}

function toByteArray(data) {
  if (!data) return null;
  if (data instanceof Uint8ClampedArray) return data;
  let array = data;
  if (data instanceof Uint8Array) {
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof Float32Array || data instanceof Float64Array) {
    array = Array.from(data);
  }
  if (Array.isArray(array)) {
    let max = 0;
    for (let i = 0; i < array.length; i += 1) {
      const v = array[i];
      if (Number.isFinite(v) && v > max) max = v;
    }
    const scale = max <= 1 ? 255 : 1;
    const out = new Uint8ClampedArray(array.length);
    for (let i = 0; i < array.length; i += 1) {
      const v = array[i];
      const value = Number.isFinite(v) ? v * scale : 0;
      out[i] = Math.max(0, Math.min(255, Math.round(value)));
    }
    return out;
  }
  return null;
}

function buildCanvasFromData(value) {
  if (!value || !value.data || !value.width || !value.height) return null;
  const width = Math.max(1, Math.floor(value.width));
  const height = Math.max(1, Math.floor(value.height));
  const bytes = toByteArray(value.data);
  if (!bytes) return null;
  const expected3 = width * height * 3;
  const expected4 = width * height * 4;
  let pixels = bytes;
  if (bytes.length === expected3) {
    pixels = new Uint8ClampedArray(expected4);
    for (let i = 0; i < width * height; i += 1) {
      const src = i * 3;
      const dst = i * 4;
      pixels[dst] = bytes[src];
      pixels[dst + 1] = bytes[src + 1];
      pixels[dst + 2] = bytes[src + 2];
      pixels[dst + 3] = 255;
    }
  } else if (bytes.length !== expected4) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imgData = new ImageData(pixels, width, height);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function buildCanvasFromTensor(value) {
  if (!value || !value.data || !value.shape) return null;
  const shape = Array.isArray(value.shape) ? value.shape : null;
  if (!shape || shape.length < 2) return null;
  let height = null;
  let width = null;
  let channels = null;
  if (shape.length >= 4) {
    channels = shape[shape.length - 1];
    width = shape[shape.length - 2];
    height = shape[shape.length - 3];
  } else if (shape.length === 3) {
    channels = shape[2];
    width = shape[1];
    height = shape[0];
  }
  if (!width || !height || !channels) return null;
  if (channels !== 3 && channels !== 4) return null;
  const frameSize = width * height * channels;
  let data = value.data;
  if (Array.isArray(data)) {
    data = data.slice(0, frameSize);
  } else if (data && typeof data.subarray === "function" && data.length > frameSize) {
    data = data.subarray(0, frameSize);
  }
  return buildCanvasFromData({ data, width, height });
}

function getImageInfo(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  if (Array.isArray(value.tetrinode_background)) return value.tetrinode_background[0] || null;
  if (Array.isArray(value.ui?.tetrinode_background)) return value.ui.tetrinode_background[0] || null;
  if (Array.isArray(value.images)) return value.images[0] || null;
  if (Array.isArray(value.image)) return value.image[0] || null;
  if (Array.isArray(value.result)) return value.result[0] || null;
  return value;
}

function imageInfoUrl(info) {
  if (!info) return null;
  if (typeof info === "string") return info;
  if (info.url) return info.url;
  const filename = info.filename || info.name;
  if (!filename) return null;
  const type = info.type || "temp";
  const subfolder = info.subfolder || "";
  return `./view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`;
}

function getImageFromInfo(node, info) {
  const url = imageInfoUrl(info);
  if (!url) return null;
  if (IMAGE_CACHE.has(url)) {
    return IMAGE_CACHE.get(url);
  }
  const img = new Image();
  img.src = url;
  img.addEventListener("load", () => {
    node?.setDirtyCanvas(true, true);
  });
  IMAGE_CACHE.set(url, img);
  return img;
}

function getLinkedImageInfo(node, name) {
  const resolved = getInputLink(node, name);
  if (!resolved) return null;
  const { origin, link } = resolved;
  if (!origin) return null;
  const slot = link?.origin_slot ?? 0;
  const outputKey = origin.outputs?.[slot]?.name;
  const outputs = app?.nodeOutputs?.[origin.id] || app?.nodeOutputs?.[`${origin.id}`];
  if (outputs) {
    const candidates = [
      outputKey ? outputs[outputKey] : null,
      outputs.tetrinode_background,
      outputs.ui?.tetrinode_background,
      outputs.images,
      outputs.image,
      outputs.result,
      outputs.output,
    ];
    for (const candidate of candidates) {
      const info = getImageInfo(candidate);
      if (info) return info;
    }
  }
  const linked = origin.outputs?.[slot]?.links || [];
  for (const linkId of linked) {
    const linkInfo = node?.graph?.links?.[linkId];
    if (!linkInfo) continue;
    const targetId = linkInfo.target_id;
    const targetOutputs = app?.nodeOutputs?.[targetId] || app?.nodeOutputs?.[`${targetId}`];
    if (!targetOutputs) continue;
    const previewCandidates = [
      targetOutputs.images,
      targetOutputs.image,
      targetOutputs.result,
      targetOutputs.output,
    ];
    for (const candidate of previewCandidates) {
      const info = getImageInfo(candidate);
      if (info) return info;
    }
  }
  return null;
}

function getLinkedImageSource(node, name) {
  const resolved = getInputLink(node, name);
  if (!resolved) return null;
  const { origin, link } = resolved;
  const slot = link?.origin_slot ?? 0;
  if (!origin) return null;
  if (Array.isArray(origin.imgs)) {
    const candidate = origin.imgs[slot] || origin.imgs[0];
    const source = coerceImageSource(candidate);
    if (source) return source;
  }
  if (Array.isArray(origin.images)) {
    const candidate = origin.images[slot] || origin.images[0];
    const source = coerceImageSource(candidate);
    if (source) return source;
  }
  const direct = coerceImageSource(origin.image || origin.img || origin._img || origin._image);
  if (direct) return direct;
  return null;
}

function getBackgroundSource(node) {
  const raw = getInputDataByName(node, "background_image");
  let value = Array.isArray(raw) ? raw[0] : raw;
  let source = null;
  let info = null;
  if (!value) {
    source = getLinkedImageSource(node, "background_image");
    value = source;
  }
  if (!value && !source) {
    info = getLinkedImageInfo(node, "background_image");
    if (!info) {
      const selfOutputs = app?.nodeOutputs?.[node?.id] || app?.nodeOutputs?.[`${node?.id}`];
      info = getImageInfo(
        selfOutputs?.tetrinode_background
        || selfOutputs?.ui?.tetrinode_background
        || selfOutputs?.images
        || selfOutputs?.image
        || selfOutputs?.result,
      );
    }
    if (!info) return null;
    value = info;
  }
  if (!node.__tetrisBg) node.__tetrisBg = {};
  if (node.__tetrisBg.value === value && node.__tetrisBg.source) {
    return node.__tetrisBg.source;
  }
  if (!source) {
    source = coerceImageSource(value);
  }
  if (!source) {
    info = info || getImageInfo(value) || getLinkedImageInfo(node, "background_image");
    if (info) value = info;
    source = getImageFromInfo(node, info);
  }
  if (!source) {
    source = buildCanvasFromData(value);
  }
  if (!source) {
    source = buildCanvasFromTensor(value);
  }
  node.__tetrisBg = { value, source };
  return source || null;
}

function drawBoardBackground(ctx, source, boardX, boardY, boardW, boardH, fallbackColor) {
  if (!source) {
    ctx.fillStyle = fallbackColor || COLORS.X;
    ctx.fillRect(boardX, boardY, boardW, boardH);
    return;
  }
  const srcW =
    source.videoWidth ||
    source.naturalWidth ||
    source.width ||
    source.displayWidth ||
    0;
  const srcH =
    source.videoHeight ||
    source.naturalHeight ||
    source.height ||
    source.displayHeight ||
    0;
  if (!srcW || !srcH) {
    ctx.fillStyle = fallbackColor || COLORS.X;
    ctx.fillRect(boardX, boardY, boardW, boardH);
    return;
  }
  const scale = Math.max(boardW / srcW, boardH / srcH);
  const cropW = boardW / scale;
  const cropH = boardH / scale;
  const sx = Math.max(0, (srcW - cropW) / 2);
  const sy = Math.max(0, (srcH - cropH) / 2);
  ctx.drawImage(source, sx, sy, cropW, cropH, boardX, boardY, boardW, boardH);
}

function drawBoardGrid(ctx, boardX, boardY, boardW, boardH, blockSize, color, extraPx) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < GRID_W; x += 1) {
    const lineX = boardX + x * blockSize - 0.5;
    ctx.moveTo(lineX, boardY - 0.5);
    ctx.lineTo(lineX, boardY + boardH + 0.5);
  }
  const yOffset = extraPx || 0;
  for (let y = 0; y < GRID_H_VISIBLE; y += 1) {
    const lineY = boardY + yOffset + y * blockSize - 0.5;
    ctx.moveTo(boardX - 0.5, lineY);
    ctx.lineTo(boardX + boardW + 0.5, lineY);
  }
  ctx.stroke();
}

function drawNode(node, ctx) {
  const live = node.__tetrisLive;
  if (!live) return;
  if (!node.__tetrisWidgetsHidden) {
    applyWidgetHiding(node);
  }
  syncStartLevel(live.state, node);
  syncSeed(live.state, node);
  const { state } = live;
  const {
    boardX,
    boardY,
    boardW,
    boardH,
    sideX,
    sideY,
    sideW,
    blockSize,
    extraPx,
    showHold,
    showNext,
  } = getLayout(node);
  const theme = getThemeColors(node);
  const palette = getColorPalette(node);
  const ghostEnabled = isGhostEnabled(node);
  const showPreviews = state.started && state.running;
  const showBoardContents = showPreviews || state.gameOver;
  const showControls = getShowControls(node);
  const gridEnabled = getGridEnabled(node);
  const gridColor = getGridColor(node);

  const bgSource = getBackgroundSource(node);
  drawBoardBackground(ctx, bgSource, boardX, boardY, boardW, boardH, palette.X);
  if (gridEnabled && gridColor) {
    drawBoardGrid(ctx, boardX, boardY, boardW, boardH, blockSize, gridColor, extraPx);
  }
  ctx.strokeStyle = "rgba(150,150,150,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(boardX - 0.5, boardY - 0.5, boardW + 1, boardH + 1);

  const hideBoard = !state.gameOver && state.started && !state.running && !state.showBoardWhilePaused;
  if (!hideBoard) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(boardX, boardY, boardW, boardH);
    ctx.clip();
    if (HIDDEN_ROWS > 0 && showBoardContents) {
      const hiddenRow = HIDDEN_ROWS - 1;
      for (let x = 0; x < GRID_W; x += 1) {
        const cell = state.board[hiddenRow][x];
        if (cell) {
          drawBlockSized(
            ctx,
            boardX + x * blockSize,
            boardY - blockSize + extraPx,
            blockSize,
            palette[cell],
          );
        }
      }
    }
    for (let y = 0; y < GRID_H_VISIBLE; y += 1) {
      const boardYIndex = y + HIDDEN_ROWS;
      for (let x = 0; x < GRID_W; x += 1) {
        const cell = state.board[boardYIndex][x];
        if (cell) {
          drawBlockSized(
            ctx,
            boardX + x * blockSize,
            boardY + y * blockSize + extraPx,
            blockSize,
            palette[cell],
          );
        }
      }
    }

    if (!state.gameOver && ghostEnabled && showPreviews) {
      drawGhostPiece(ctx, state, boardX, boardY + extraPx, blockSize, palette[state.piece.shape], COLORS.Text);
    }

    if (showBoardContents) {
      for (const [x, y] of pieceCells(state.piece)) {
        if (y >= HIDDEN_ROWS - 1 && y < GRID_H_TOTAL) {
          drawBlockSized(
            ctx,
            boardX + x * blockSize,
            boardY + (y - HIDDEN_ROWS) * blockSize + extraPx,
            blockSize,
            palette[state.piece.shape],
          );
        }
      }
    }
    ctx.restore();
  }

  const previewBox = Math.max(4, Math.floor(PREVIEW_GRID * blockSize * PREVIEW_SCALE));
  const rightInset = Math.max(0, Math.floor((sideW - previewBox) / 2));
  const columnShift = Math.max(4, Math.floor(blockSize * 0.2));
  const baseLeftX = showHold ? boardX - PADDING - sideW + rightInset : PADDING;
  const leftX = baseLeftX + columnShift;
  const rightX = sideX + rightInset + columnShift;
  const maxWidthRight = Math.max(0, node.size[0] - rightX - PADDING);
  const leftColumnW = showHold ? previewBox : Math.max(0, boardX - PADDING * 2);
  const maxWidthLeft = Math.max(0, leftColumnW);
  const measureFits = (size, lines, maxWidth) => {
    ctx.font = `bold ${size}px sans-serif`;
    let widest = ctx.measureText(lines[0]).width;
    ctx.font = `${size}px sans-serif`;
    for (let i = 1; i < lines.length; i += 1) {
      widest = Math.max(widest, ctx.measureText(lines[i]).width);
    }
    return widest <= maxWidth;
  };
  let hudFontSize = Math.max(8, Math.floor(blockSize * 0.5));
  while (hudFontSize > 8) {
    if (measureFits(hudFontSize, ["Lines:", "Score:", "Time:", "Level:", "Goal:", "Tetrises:", "T-Spins:", "Combos:", "TPM:", "LPM:"], maxWidthLeft)) break;
    hudFontSize -= 1;
  }
  const scoreFontSize = Math.max(7, hudFontSize - 1);
  const innerPad = Math.max(2, Math.floor(blockSize * 0.2));
  const titleFontSize = Math.max(6, scoreFontSize - 1);
  const titlePad = Math.max(6, Math.floor(titleFontSize * 0.6));
  const titleHeight = titleFontSize + titlePad;
  const nextBoxY = boardY;
  ctx.fillStyle = theme.text;
  const lineGap = Math.floor(scoreFontSize * 0.6);
  const leftHudTopY = showHold ? nextBoxY + previewBox + PADDING * 1.2 : sideY;
  const scoreLabelY = leftHudTopY + scoreFontSize + 1;
  const scoreValueY = scoreLabelY + scoreFontSize + 2;
  const timeLabelY = scoreValueY + lineGap + scoreFontSize;
  const timeValueY = timeLabelY + scoreFontSize + 2;
  const linesLabelY = timeValueY + lineGap + scoreFontSize + 6;
  const linesValueY = linesLabelY;
  const levelLabelY = linesLabelY + lineGap + scoreFontSize;
  const levelValueY = levelLabelY;
  const goalLabelY = levelLabelY + lineGap + scoreFontSize;
  const goalValueY = goalLabelY;
  const statsTopY = goalLabelY + lineGap + scoreFontSize + 6;
  const tetrisLabelY = statsTopY + scoreFontSize;
  const tetrisValueY = tetrisLabelY;
  const tspinLabelY = tetrisLabelY + lineGap + scoreFontSize;
  const tspinValueY = tspinLabelY;
  const comboLabelY = tspinLabelY + lineGap + scoreFontSize;
  const comboValueY = comboLabelY;
  const tpmLabelY = comboLabelY + lineGap + scoreFontSize;
  const tpmValueY = tpmLabelY;
  const lpmLabelY = tpmLabelY + lineGap + scoreFontSize;
  const lpmValueY = lpmLabelY;
  ctx.font = `bold ${scoreFontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText("Score:", leftX, scoreLabelY);
  ctx.fillText("Time:", leftX, timeLabelY);
  ctx.fillText("Lines:", leftX, linesLabelY);
  ctx.fillText("Level:", leftX, levelLabelY);
  ctx.fillText("Goal:", leftX, goalLabelY);
  ctx.fillText("Tetrises:", leftX, tetrisLabelY);
  ctx.fillText("T-Spins:", leftX, tspinLabelY);
  ctx.fillText("Combos:", leftX, comboLabelY);
  ctx.fillText("TPM:", leftX, tpmLabelY);
  ctx.fillText("LPM:", leftX, lpmLabelY);
  ctx.font = `${scoreFontSize}px sans-serif`;
  const linesValue = state.levelProgression === "variable" ? state.goalLinesTotal : state.lines;
  const linesText =
    Number.isFinite(linesValue) && Math.abs(linesValue % 1) > 0.001
      ? linesValue.toFixed(1)
      : `${Math.round(linesValue)}`;
  const remaining = state.goalRemaining ?? 0;
  const remainingText =
    Number.isFinite(remaining) && Math.abs(remaining % 1) > 0.001
      ? remaining.toFixed(1)
      : `${Math.round(remaining)}`;
  const minutes = state.timeMs > 0 ? state.timeMs / 60000 : 0;
  const tpm = minutes > 0 ? (state.tetrises || 0) / minutes : 0;
  const lpm = minutes > 0 ? (state.lines || 0) / minutes : 0;
  const tpmText = minutes > 0 ? tpm.toFixed(1) : "0";
  const lpmText = minutes > 0 ? lpm.toFixed(1) : "0";
  const valueX = leftX + previewBox - 2;
  ctx.textAlign = "right";
  ctx.fillText(`${state.score}`, valueX, scoreValueY);
  ctx.fillText(formatTimeMs(state.timeMs), valueX, timeValueY);
  ctx.fillText(linesText, valueX, linesValueY);
  ctx.fillText(`${state.level}`, valueX, levelValueY);
  ctx.fillText(remainingText, valueX, goalValueY);
  ctx.fillText(`${state.tetrises || 0}`, valueX, tetrisValueY);
  ctx.fillText(`${state.tspins || 0}`, valueX, tspinValueY);
  ctx.fillText(`${state.comboTotal || 0}`, valueX, comboValueY);
  ctx.fillText(tpmText, valueX, tpmValueY);
  ctx.fillText(lpmText, valueX, lpmValueY);
  ctx.textAlign = "left";
  const bindings = getControlBindings(node);
  const controlEntries = showControls
    ? [
      { label: "Move Left:", value: formatKeyList(bindings.moveLeft) },
      { label: "Move Right:", value: formatKeyList(bindings.moveRight) },
      { label: "Rotate CW:", value: formatKeyList(bindings.rotateCw) },
      { label: "Rotate CCW:", value: formatKeyList(bindings.rotateCcw) },
      { label: "Soft Drop:", value: formatKeyList(bindings.softDrop) },
      { label: "Hard Drop:", value: formatKeyList(bindings.hardDrop) },
      { label: "Hold:", value: formatKeyList(bindings.hold) },
      { label: "Reset:", value: formatKeyList(bindings.reset) },
      { label: "Pause:", value: formatKeyList(bindings.pause) },
    ]
    : [];
  let fontSize = Math.max(4, Math.floor(blockSize * 0.3));
  if (controlEntries.length) {
    while (fontSize > 8) {
      const labels = controlEntries.map((entry) => entry.label);
      if (measureFits(fontSize, labels, maxWidthRight)) break;
      fontSize -= 1;
    }
  }
  const lineHeight = fontSize + 3;
  const tablePad = Math.max(6, Math.floor(fontSize * 0.6));
  const tableGap = Math.max(6, Math.floor(fontSize * 0.6));
  let controlsHeight = 0;
  let leftColWidth = 0;
  let rightColWidth = 0;
  let controlRows = [];
  if (controlEntries.length) {
    ctx.font = `bold ${fontSize}px sans-serif`;
    leftColWidth = Math.max(...controlEntries.map((entry) => ctx.measureText(entry.label).width));
    leftColWidth = Math.min(leftColWidth, Math.max(40, Math.floor(maxWidthRight * 0.45)));
    rightColWidth = Math.max(0, maxWidthRight - tablePad * 2 - leftColWidth - tableGap);
    ctx.font = `${fontSize}px sans-serif`;
    const wrapValue = (value) => {
      if (!value) return [""];
      const parts = value.split(" / ");
      const lines = [];
      let current = "";
      for (const part of parts) {
        const chunk = current ? `${current} / ${part}` : part;
        if (ctx.measureText(chunk).width <= rightColWidth || !current) {
          current = chunk;
        } else {
          lines.push(current);
          current = part;
        }
      }
      if (current) lines.push(current);
      return lines;
    };
    controlRows = controlEntries.map((entry) => ({
      label: entry.label,
      lines: wrapValue(entry.value),
    }));
    controlsHeight = controlRows.reduce((sum, row) => sum + row.lines.length * lineHeight, 0);
  }
  const infoBlockHeight = controlEntries.length
    ? controlsHeight + tablePad * 2 + lineHeight
    : 0;

  const holdNextTitleY = nextBoxY + titleFontSize + 4;
  const titleInset = Math.max(4, Math.floor(titleFontSize * 0.5));
  ctx.font = `bold ${titleFontSize}px sans-serif`;
  if (showHold && showPreviews) {
    ctx.fillText("Hold", leftX + titleInset, holdNextTitleY);
  }
  if (showNext && showPreviews) {
    ctx.fillText("Next", rightX + titleInset, holdNextTitleY);
  }

  const drawPreviewShape = (shape, originX, boxY, cellSize, areaH) => {
    if (!shape || !SHAPES[shape]) return;
    const preview = SHAPES[shape][0];
    let minX = 99;
    let minY = 99;
    let maxX = -99;
    let maxY = -99;
    for (const [px, py] of preview) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    const shapeW = maxX - minX + 1;
    const shapeH = maxY - minY + 1;
    const areaW = previewBox - innerPad * 2;
    const contentH = Math.max(0, areaH - innerPad * 2);
    const offX = Math.round((areaW - shapeW * cellSize) / 2);
    const offY = Math.round((contentH - shapeH * cellSize) / 2);
    for (const [px, py] of preview) {
      const gx = px - minX;
      const gy = py - minY;
      drawBlockSized(
        ctx,
        originX + innerPad + offX + gx * cellSize,
        boxY + innerPad + offY + gy * cellSize,
        cellSize,
        palette[shape],
      );
    }
  };

  const previewContentH = Math.max(4, previewBox - titleHeight);
  const nextCellSize = Math.max(4, Math.floor((previewContentH - innerPad * 2) / PREVIEW_GRID));
  if (showHold && showPreviews) {
    drawPreviewShape(state.holdShape, leftX, nextBoxY + titleHeight, nextCellSize, previewContentH);
    ctx.strokeStyle = "rgba(150,150,150,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX + 0.5, nextBoxY + 0.5, previewBox - 1, previewBox - 1);
  }
  if (showNext && showPreviews) {
    drawPreviewShape(state.nextShape, rightX, nextBoxY + titleHeight, nextCellSize, previewContentH);
    ctx.strokeStyle = "rgba(150,150,150,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rightX + 0.5, nextBoxY + 0.5, previewBox - 1, previewBox - 1);
  }

  const queueCountTarget = showNext && showPreviews ? getQueueSize(node) : 0;
  const showQueue = queueCountTarget > 0;
  const queueBoxY = nextBoxY + previewBox + PADDING * 1.2;
  const queueBoxW = previewBox;
  const queueBoxX = rightX;
  const queueTitleY = queueBoxY + titleFontSize + 4;
  if (showQueue) {
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.fillStyle = theme.text;
    ctx.fillText("Queue", rightX + titleInset, queueTitleY);
  }

  const upcoming = getUpcomingShapes(state, queueCountTarget + 1);
  const queue = upcoming.slice(1, queueCountTarget + 1);
  const queueGapCells = 1;
  const queueContentY = queueBoxY + titleHeight;
  const availableQueueHeight =
    boardY + boardH - infoBlockHeight - PADDING * 1.4 - queueBoxY;
  const queueCount = Math.min(queue.length, queueCountTarget);
  const getShapeBounds = (shape) => {
    const cells = SHAPES[shape]?.[0] || [];
    if (!cells.length) return null;
    let minX = 99;
    let minY = 99;
    let maxX = -99;
    let maxY = -99;
    for (const [px, py] of cells) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    return {
      minX,
      minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  };
  const boundsList = queue
    .slice(0, queueCount)
    .map((shape) => getShapeBounds(shape))
    .filter(Boolean);
  const shapeHeights = boundsList.map((bounds) => bounds.height);
  const shapeWidths = boundsList.map((bounds) => bounds.width);
  const totalCells =
    shapeHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, queueCount - 1) * queueGapCells;
  const maxShapeWidth = shapeWidths.length ? Math.max(...shapeWidths) : PREVIEW_GRID;
  const availableInnerH = Math.max(0, availableQueueHeight - titleHeight - innerPad * 2);
  const maxCellByHeight = totalCells > 0 ? Math.floor(availableInnerH / totalCells) : 0;
  const maxCellByWidth = Math.floor((queueBoxW - innerPad * 2) / maxShapeWidth);
  const queueCellSize = Math.max(4, Math.min(maxCellByHeight, maxCellByWidth));
  const drawQueueCount = queueCellSize > 0 ? boundsList.length : 0;
  let cursorY = queueContentY + innerPad;
  boundsList.slice(0, drawQueueCount).forEach((bounds, idx) => {
    const shape = queue[idx];
    if (!shape || !SHAPES[shape]) return;
    const shapeOffsetX = Math.max(
      0,
      Math.floor(
        (queueBoxW - innerPad * 2 - bounds.width * queueCellSize) / 2,
      ),
    );
    for (const [px, py] of SHAPES[shape][0]) {
      const gx = px - bounds.minX;
      const gy = py - bounds.minY;
      drawBlockSized(
        ctx,
        queueBoxX + innerPad + shapeOffsetX + gx * queueCellSize,
        cursorY + gy * queueCellSize,
        queueCellSize,
        palette[shape],
      );
    }
    cursorY += bounds.height * queueCellSize;
    if (idx < drawQueueCount - 1) {
      cursorY += queueGapCells * queueCellSize;
    }
  });
  if (showQueue && drawQueueCount > 0) {
    ctx.strokeStyle = "rgba(150,150,150,0.8)";
    ctx.lineWidth = 1;
    const outlineHeight = Math.min(
      availableQueueHeight,
      shapeHeights
        .slice(0, drawQueueCount)
        .reduce((sum, h) => sum + h, 0) * queueCellSize
        + Math.max(0, drawQueueCount - 1) * queueGapCells * queueCellSize
        + innerPad * 2
        + titleHeight,
    );
    ctx.strokeRect(queueBoxX + 0.5, queueBoxY + 0.5, queueBoxW - 1, outlineHeight - 1);
  }

  const previewBottom = nextBoxY + previewBox;
  const queueBottom =
    showQueue && drawQueueCount > 0
      ? queueBoxY
        + Math.min(
          availableQueueHeight,
          shapeHeights
            .slice(0, drawQueueCount)
            .reduce((sum, h) => sum + h, 0) * queueCellSize
            + Math.max(0, drawQueueCount - 1) * queueGapCells * queueCellSize
            + innerPad * 2
            + titleHeight,
        )
      : previewBottom;
  const minInfoY = queueBottom + PADDING * 1.6 + 22;
  const maxInfoY = boardY + boardH - infoBlockHeight;
  const infoY = maxInfoY < minInfoY ? maxInfoY : Math.max(minInfoY, maxInfoY);
  const baseInfoY = infoY;
  if (controlEntries.length) {
    ctx.fillStyle = theme.text;
    ctx.font = `bold ${titleFontSize}px sans-serif`;
    const tableY = baseInfoY;
    const tableX = rightX;
    const tableW = Math.max(0, maxWidthRight);
    const tableH = Math.max(0, boardY + boardH - tableY);
    ctx.fillText("Controls", rightX + titleInset, tableY + titleFontSize + 4);
    ctx.strokeStyle = "rgba(150,150,150,0.8)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX + 0.5, tableY + 0.5, tableW - 1, tableH - 1);
    ctx.font = `${fontSize}px sans-serif`;
    let rowY = tableY + titleHeight + tablePad + Math.floor(fontSize * 0.25);
    for (const row of controlRows) {
      const labelX = tableX + tablePad + leftColWidth;
      ctx.textAlign = "right";
      ctx.fillText(row.label, labelX, rowY);
      ctx.textAlign = "left";
      const valueX = tableX + tablePad + leftColWidth + tableGap;
      for (let i = 0; i < row.lines.length; i += 1) {
        const lineY = rowY + i * lineHeight;
        ctx.fillText(row.lines[i], valueX, lineY);
      }
      rowY += row.lines.length * lineHeight;
    }
    ctx.textAlign = "left";
  }

  if (state.gameOver) {
    drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, {
      label: "Game Over",
      sublabel: `Press Reset or ${formatPauseHint(bindings)} to play`,
      centerOffsetY: 0,
    });
  } else if (!state.running && state.showBoardWhilePaused) {
    drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, {
      label: "Paused",
      sublabel: `Press ${formatPauseHint(bindings)} to resume`,
      centerOffsetY: 0,
    });
  } else if (!state.running && !state.showBoardWhilePaused) {
    const label = state.started ? "Paused" : "Start a new game";
    const sublabel = state.started
      ? `Press ${formatPauseHint(bindings)} to resume`
      : "Press Reset or Pause to play";
    drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, {
      label,
      sublabel,
      centerOffsetY: 0,
    });
  }

  drawStatusMessage(node, ctx, { boardX, boardY, boardW, boardH, blockSize, bindings });
  drawToolbar(node, ctx, boardY);
}

function formatPauseHint(bindings) {
  const pauseLabel = formatKeyLabel(bindings.pause?.[0]) || "Pause";
  const pauseAlt = formatKeyLabel(bindings.pause?.[1]);
  return pauseAlt ? `${pauseLabel} (or ${pauseAlt})` : pauseLabel;
}

function drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, opts) {
  const { label, sublabel, centerOffsetY } = opts;
  ctx.fillStyle = COLORS.Overlay;
  ctx.fillRect(boardX, boardY, boardW, boardH);
  ctx.fillStyle = getThemeColors(node).text;
  const statusFont = Math.max(12, Math.floor(blockSize * 0.8));
  const subFont = Math.max(10, Math.floor(blockSize * 0.55));
  const centerY = boardY + boardH / 2 + (centerOffsetY || 0);
  ctx.font = `${statusFont}px sans-serif`;
  ctx.fillText(label, boardX + 28, centerY - Math.floor(subFont));
  ctx.font = `${subFont}px sans-serif`;
  ctx.fillText(sublabel, boardX + 28, centerY + subFont);
}

function drawStatusMessage(node, ctx, layout) {
  const msg = node.__tetrisStatusMessage;
  if (!msg) return;
  if (performance.now() > msg.until) {
    node.__tetrisStatusMessage = null;
    return;
  }
  const { boardX, boardY, boardW, boardH, blockSize, bindings } = layout;
  const pauseHint = formatPauseHint(bindings);
  drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, {
    label: "Paused",
    sublabel: `Press ${pauseHint} to resume`,
    centerOffsetY: 0,
  });
  const text = msg.text || "";
  if (!text) return;
  ctx.save();
  ctx.font = "12px sans-serif";
  const paddingX = 10;
  const paddingY = 6;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 20 + paddingY;
  const x = boardX + (boardW - width) / 2;
  const y = boardY + 100 - height / 2;
  ctx.fillStyle = msg.kind === "error" ? "rgba(180,60,60,0.85)" : "rgba(30,120,60,0.85)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + paddingX, y + height - 8);
  ctx.restore();
}

function getThemeColors(node) {
  const config = getConfig(node);
  const theme = config.theme && config.theme_colors?.[config.theme] ? config.theme : "glass";
  return config.theme_colors?.[theme] || THEME_PRESETS[theme];
}

function ensureUiState(node) {
  if (!node.__tetrisUi) {
    node.__tetrisUi = {
      toolbarButtons: [],
      hoverButton: null,
      modal: null,
      captureAction: null,
    };
  }
  return node.__tetrisUi;
}

function buildToolbarButtons(node, toolbarY) {
  const btnSize = 24;
  const gap = 8;
  const top = toolbarY + (TOOLBAR_H - btnSize) / 2;
  const leftStart = PADDING + 6;
  const rightStart = node.size[0] - PADDING - 6;
  const leftButtons = [
    { id: "load", label: "L", tooltip: "Load State" },
    { id: "reset", label: "R", tooltip: "Reset" },
    { id: "pause", label: "P", tooltip: "Pause/Play" },
  ];
  const rightButtons = [
    { id: "controls", label: "K", tooltip: "Controls" },
    { id: "colors", label: "C", tooltip: "Colors" },
    { id: "gameplay", label: "G", tooltip: "Gameplay" },
    { id: "theme", label: "T", tooltip: "Theme" },
  ];
  const buttons = [];
  let x = leftStart;
  for (const btn of leftButtons) {
    buttons.push({ ...btn, x, y: top, w: btnSize, h: btnSize });
    x += btnSize + gap;
  }
  let rightX = rightStart;
  for (const btn of rightButtons) {
    rightX -= btnSize;
    buttons.push({ ...btn, x: rightX, y: top, w: btnSize, h: btnSize });
    rightX -= gap;
  }
  return { buttons, height: TOOLBAR_H, top };
}

function drawToolbar(node, ctx, boardY) {
  const ui = ensureUiState(node);
  const theme = getThemeColors(node);
  const desiredY = boardY - TOOLBAR_H - 10;
  const barY = Math.max(HEADER_H + 2, Math.round(desiredY));
  const { buttons } = buildToolbarButtons(node, barY);
  ui.toolbarButtons = buttons;
  const barX = PADDING;
  const barW = node.size[0] - PADDING * 2;
  const barH = TOOLBAR_H - 6;
  ui.toolbarRect = { x: barX, y: barY, w: barW, h: barH };
  ctx.save();
  ctx.fillStyle = theme.panel_bg;
  ctx.strokeStyle = theme.panel_border;
  ctx.lineWidth = 1;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const btn of buttons) {
    const hovered = ui.hoverButton && ui.hoverButton.id === btn.id;
    ctx.fillStyle = hovered ? theme.button_hover : theme.button_bg;
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = theme.panel_border;
    ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
    ctx.fillStyle = theme.text;
    ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
  }
  if (ui.hoverButton?.tooltip) {
    const tooltip = ui.hoverButton.tooltip;
    ctx.font = "11px sans-serif";
    const padding = 6;
    const width = ctx.measureText(tooltip).width + padding * 2;
    const height = 20;
    const tipX = Math.min(node.size[0] - width - 8, ui.hoverButton.x + ui.hoverButton.w / 2 - width / 2);
    const tipY = barY + barH + 6;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(tipX, tipY, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillText(tooltip, tipX + width / 2, tipY + height / 2 + 0.5);
  }
  ctx.restore();
}

function hitToolbarButton(node, pos, boardY = null) {
  const ui = ensureUiState(node);
  if (!ui.toolbarButtons?.length) {
    const fallbackY = boardY ?? node.__tetrisLastLayout?.boardY ?? (HEADER_H + TOOLBAR_H + 10);
    const metrics = buildToolbarButtons(node, Math.max(HEADER_H + 2, fallbackY - TOOLBAR_H - 10));
    ui.toolbarButtons = metrics.buttons;
  }
  const [x, y] = pos;
  return ui.toolbarButtons.find(
    (btn) => x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h,
  );
}

function handleToolbarClick(node, pos) {
  const btn = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
  if (!btn) return false;
  if (btn.id === "reset") {
    resetNode(node);
    return true;
  }
  if (btn.id === "pause") {
    togglePause(node);
    return true;
  }
  if (btn.id === "load") {
    openLoadStateModal(node);
    return true;
  }
  if (btn.id === "controls") {
    openControlsModal(node);
    return true;
  }
  if (btn.id === "colors") {
    openColorsModal(node);
    return true;
  }
  if (btn.id === "theme") {
    openThemeModal(node);
    return true;
  }
  if (btn.id === "gameplay") {
    openGameplayModal(node);
    return true;
  }
  return false;
}

function closeModal(node) {
  const ui = ensureUiState(node);
  if (ui.modal?.el) {
    ui.modal.el.remove();
  }
  ui.modal = null;
  ui.captureAction = null;
}

function pauseForModal(node) {
  const live = node.__tetrisLive;
  if (!live) return;
  live.state.running = false;
  live.state.showBoardWhilePaused = true;
  node.setDirtyCanvas(true, true);
}

function createModalBase(node, title) {
  closeModal(node);
  pauseForModal(node);
  const theme = getThemeColors(node);
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.left = "50%";
  modal.style.top = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.minWidth = "360px";
  modal.style.maxWidth = "70vw";
  modal.style.maxHeight = "70vh";
  modal.style.background = theme.panel_bg;
  modal.style.border = `1px solid ${theme.panel_border}`;
  modal.style.boxShadow = `0 10px 30px ${theme.panel_shadow}`;
  modal.style.color = theme.text;
  modal.style.backdropFilter = "blur(10px)";
  modal.style.padding = "12px";
  modal.style.borderRadius = "10px";
  modal.style.zIndex = "9999";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.gap = "10px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.cursor = "move";
  header.style.fontWeight = "600";
  header.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "X";
  closeBtn.style.marginLeft = "12px";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.color = theme.text;
  closeBtn.style.cursor = "pointer";
  closeBtn.addEventListener("click", () => closeModal(node));
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.style.overflow = "auto";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "8px";

  modal.appendChild(header);
  modal.appendChild(body);
  document.body.appendChild(modal);

  let drag = null;
  header.addEventListener("mousedown", (event) => {
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      rect: modal.getBoundingClientRect(),
    };
    event.preventDefault();
  });
  window.addEventListener("mousemove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    modal.style.left = `${drag.rect.left + dx}px`;
    modal.style.top = `${drag.rect.top + dy}px`;
    modal.style.transform = "translate(0, 0)";
  });
  window.addEventListener("mouseup", () => {
    drag = null;
  });

  ensureUiState(node).modal = { el: modal, body, title };
  return { modal, body };
}

function openLoadStateModal(node) {
  const { body } = createModalBase(node, "Load State");
  const textarea = document.createElement("textarea");
  textarea.style.width = "100%";
  textarea.style.minHeight = "140px";
  textarea.placeholder = "Paste state JSON here...";
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.addEventListener("click", () => {
    loadStateFromText(node, textarea.value);
  });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => closeModal(node));
  actions.append(loadBtn, closeBtn);
  body.append(textarea, actions);
}

function openControlsModal(node) {
  const { body } = createModalBase(node, "Controls");
  renderControlsModal(node, body);
}

function renderControlsModal(node, body) {
  body.innerHTML = "";
  const ui = ensureUiState(node);
  const config = getConfig(node);
  const actions = [
    { id: "move_left", label: "Move Left" },
    { id: "move_right", label: "Move Right" },
    { id: "rotate_cw", label: "Rotate CW" },
    { id: "rotate_ccw", label: "Rotate CCW" },
    { id: "soft_drop", label: "Soft Drop" },
    { id: "hard_drop", label: "Hard Drop" },
    { id: "hold", label: "Hold" },
    { id: "reset", label: "Reset" },
    { id: "pause", label: "Pause" },
  ];
  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.opacity = "0.8";
  hint.textContent = ui.captureAction
    ? `Press a key for ${actions.find((a) => a.id === ui.captureAction)?.label || ""} (Esc to cancel)`
    : "Click Add to capture a key binding.";
  body.appendChild(hint);
  if (ui.captureAction) {
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel Capture";
    cancel.addEventListener("click", () => {
      ui.captureAction = null;
      renderControlsModal(node, body);
    });
    body.appendChild(cancel);
  }

  actions.forEach((action) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "120px 1fr auto auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = document.createElement("div");
    label.textContent = action.label;
    const keys = document.createElement("div");
    keys.style.display = "flex";
    keys.style.gap = "6px";
    keys.style.flexWrap = "wrap";
    const values = Array.isArray(config.bindings[action.id]) ? config.bindings[action.id] : [];
    values.forEach((value) => {
      const chip = document.createElement("div");
      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.gap = "4px";
      chip.style.padding = "2px 6px";
      chip.style.borderRadius = "10px";
      chip.style.background = "rgba(255,255,255,0.08)";
      const text = document.createElement("span");
      text.textContent = formatKeyLabel(value);
      const remove = document.createElement("button");
      remove.textContent = "X";
      remove.style.border = "none";
      remove.style.background = "transparent";
      remove.style.cursor = "pointer";
      remove.addEventListener("click", () => {
        updateConfig(node, (next) => {
          next.bindings[action.id] = next.bindings[action.id].filter((k) => k !== value);
          return next;
        });
        updateBackendState(node);
        renderControlsModal(node, body);
      });
      chip.append(text, remove);
      keys.appendChild(chip);
    });
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      ui.captureAction = action.id;
      renderControlsModal(node, body);
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.bindings[action.id] = cloneDeep(DEFAULT_CONFIG.bindings[action.id]);
        return next;
      });
      updateBackendState(node);
      renderControlsModal(node, body);
    });
    row.append(label, keys, addBtn, resetBtn);
    body.appendChild(row);
  });
}

function openColorsModal(node) {
  const { body } = createModalBase(node, "Colors");
  renderColorsModal(node, body);
}

function renderColorsModal(node, body) {
  body.innerHTML = "";
  const config = getConfig(node);
  const items = [
    { id: "color_i", label: "I" },
    { id: "color_j", label: "J" },
    { id: "color_l", label: "L" },
    { id: "color_o", label: "O" },
    { id: "color_s", label: "S" },
    { id: "color_t", label: "T" },
    { id: "color_z", label: "Z" },
    { id: "background_color", label: "Background", alpha: false },
    { id: "grid_color", label: "Grid", alpha: true, target: "grid_color" },
  ];
  items.forEach((item) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "120px 1fr auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = document.createElement("div");
    label.textContent = item.label;
    const swatch = document.createElement("div");
    const value =
      item.id === "grid_color" ? config.grid_color : config.colors[item.id];
    swatch.style.width = "100%";
    swatch.style.height = "18px";
    swatch.style.border = "1px solid rgba(255,255,255,0.2)";
    swatch.style.background = value || "#000";
    const btn = document.createElement("button");
    btn.textContent = "Pick";
    btn.addEventListener("click", () => {
      openColorPicker(node, value, item.alpha !== false, (nextValue) => {
        updateConfig(node, (next) => {
          if (item.id === "grid_color") {
            next.grid_color = nextValue;
          } else {
            next.colors[item.id] = nextValue;
          }
          return next;
        });
        updateBackendState(node);
        renderColorsModal(node, body);
      });
    });
    row.append(label, swatch, btn);
    body.appendChild(row);
  });
}

function openThemeModal(node) {
  const { body } = createModalBase(node, "Theme");
  renderThemeModal(node, body);
}

function renderThemeModal(node, body) {
  body.innerHTML = "";
  const config = getConfig(node);
  const themeRow = document.createElement("div");
  themeRow.style.display = "flex";
  themeRow.style.gap = "8px";
  ["glass", "flat", "neon", "minimal"].forEach((theme) => {
    const btn = document.createElement("button");
    btn.textContent = theme;
    btn.disabled = config.theme === theme;
    btn.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.theme = theme;
        return next;
      });
      renderThemeModal(node, body);
      node.setDirtyCanvas(true, true);
    });
    themeRow.appendChild(btn);
  });
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset All Theme Colors";
  resetBtn.addEventListener("click", () => {
    updateConfig(node, (next) => {
      next.theme_colors = cloneDeep(DEFAULT_CONFIG.theme_colors);
      return next;
    });
    renderThemeModal(node, body);
    node.setDirtyCanvas(true, true);
  });
  body.append(themeRow, resetBtn);

  const themeColors = config.theme_colors?.[config.theme] || THEME_PRESETS[config.theme];
  Object.entries(themeColors).forEach(([key, value]) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "150px 1fr auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = document.createElement("div");
    label.textContent = key.replace("_", " ");
    const swatch = document.createElement("div");
    swatch.style.width = "100%";
    swatch.style.height = "18px";
    swatch.style.border = "1px solid rgba(255,255,255,0.2)";
    swatch.style.background = value;
    const btn = document.createElement("button");
    btn.textContent = "Pick";
    btn.addEventListener("click", () => {
      openColorPicker(node, value, true, (nextValue) => {
        updateConfig(node, (next) => {
          next.theme_colors[config.theme][key] = nextValue;
          return next;
        });
        renderThemeModal(node, body);
        node.setDirtyCanvas(true, true);
      });
    });
    row.append(label, swatch, btn);
    body.appendChild(row);
  });
}

function openGameplayModal(node) {
  const { body } = createModalBase(node, "Gameplay");
  renderGameplayModal(node, body);
}

function renderGameplayModal(node, body) {
  body.innerHTML = "";
  const config = getConfig(node);
  const checkbox = (labelText, key) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!config[key];
    input.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = input.checked;
        return next;
      });
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
    });
    row.append(input, document.createTextNode(labelText));
    body.appendChild(row);
  };
  checkbox("Show Controls", "show_controls");
  checkbox("Ghost Piece", "ghost_piece");
  checkbox("Next Piece", "next_piece");
  checkbox("Hold Queue", "hold_queue");
  checkbox("Grid", "grid_enabled");

  const selectRow = (labelText, key, options) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr";
    row.style.gap = "8px";
    const label = document.createElement("div");
    label.textContent = labelText;
    const select = document.createElement("select");
    options.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      if (`${config[key]}` === value) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = select.value;
        return next;
      });
      updateBackendState(node);
    });
    row.append(label, select);
    body.appendChild(row);
  };

  selectRow("Lock Down", "lock_down_mode", ["extended", "infinite", "classic"]);
  selectRow("Level Progression", "level_progression", ["fixed", "variable"]);

  const numberRow = (labelText, key, min, max) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr";
    row.style.gap = "8px";
    const label = document.createElement("div");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.value = config[key];
    input.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = Number.parseInt(input.value, 10);
        return next;
      });
      updateBackendState(node);
    });
    row.append(label, input);
    body.appendChild(row);
  };

  numberRow("Start Level", "start_level", 1, 15);
  numberRow("Queue Size", "queue_size", 0, 6);
}

function openColorPicker(node, value, allowAlpha, onApply) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.4)";
  overlay.style.zIndex = "10000";
  const dialog = document.createElement("div");
  dialog.style.position = "fixed";
  dialog.style.left = "50%";
  dialog.style.top = "50%";
  dialog.style.transform = "translate(-50%, -50%)";
  dialog.style.padding = "12px";
  dialog.style.borderRadius = "10px";
  dialog.style.background = "rgba(24,24,30,0.92)";
  dialog.style.color = "#fff";
  dialog.style.display = "flex";
  dialog.style.flexDirection = "column";
  dialog.style.gap = "8px";
  const components = parseColorComponents(value);
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = rgbToHex(components.r, components.g, components.b);
  const alphaInput = document.createElement("input");
  alphaInput.type = "range";
  alphaInput.min = "0";
  alphaInput.max = "1";
  alphaInput.step = "0.01";
  alphaInput.value = `${components.a}`;
  alphaInput.disabled = !allowAlpha;
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  const apply = document.createElement("button");
  apply.textContent = "Apply";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  actions.append(apply, cancel);
  dialog.append(colorInput, alphaInput, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  cancel.addEventListener("click", () => overlay.remove());
  apply.addEventListener("click", () => {
    const hex = colorInput.value;
    const { r, g, b } = hexToRgb(hex);
    const alpha = allowAlpha ? Number.parseFloat(alphaInput.value) : 1;
    const next = allowAlpha && alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : rgbToHex(r, g, b);
    onApply(next);
    overlay.remove();
  });
}

function parseColorComponents(value) {
  const rgba = parseRgbaString(value || "");
  if (rgba) {
    const parts = rgba
      .replace(/rgba?\(|\)/g, "")
      .split(",")
      .map((v) => Number.parseFloat(v.trim()));
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
  }
  if (typeof value === "string" && value.trim().startsWith("#")) {
    const { r, g, b } = hexToRgb(value.trim());
    return { r, g, b, a: 1 };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

function hexToRgb(hex) {
  const trimmed = hex.replace("#", "");
  const r = Number.parseInt(trimmed.slice(0, 2), 16);
  const g = Number.parseInt(trimmed.slice(2, 4), 16);
  const b = Number.parseInt(trimmed.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ensureBackgroundUpdater(node) {
  const live = node.__tetrisLive;
  if (!live || live.bgTimer) return;
  live.bgTimer = setInterval(() => {
    const bg = getBackgroundSource(node);
    if (bg && live.bgSource !== bg) {
      live.bgSource = bg;
      node.setDirtyCanvas(true, true);
    }
  }, 250);
}

function loadStateFromText(node, text) {
  const live = node.__tetrisLive;
  if (!live) return;
  if (!text || !text.trim()) {
    setStatusMessage(node, "No state input found.", "error");
    return;
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    setStatusMessage(node, "Invalid state JSON.", "error");
    return;
  }
  const validationError = validateStatePayload(parsed);
  if (validationError) {
    setStatusMessage(node, validationError, "error");
    return;
  }
  const seed = getSeedValue(node, { allowRandomize: false });
  const startLevel = getStartLevel(node);
  const progression = getLevelProgression(node);
  const hydrated = hydrateState(text, seed ?? 0, startLevel, progression);
  if (!hydrated) {
    setStatusMessage(node, "Failed to load state.", "error");
    return;
  }
  node.__tetrisLive.state = hydrated;
  node.__tetrisLive.state.started = true;
  node.__tetrisLive.state.running = false;
  node.__tetrisLive.state.showBoardWhilePaused = true;
  resetInputState(node.__tetrisLive.state);
  stopTimer(node);
  ensureTimer(node);
  updateBackendState(node);
  node.setDirtyCanvas(true, true);
  setStatusMessage(node, "State loaded.", "success");
}

function validateStatePayload(payload) {
  if (!payload || typeof payload !== "object") return "Invalid state payload.";
  if (!Array.isArray(payload.board)) return "State missing board.";
  if (payload.board.length !== GRID_H_TOTAL) return "Board must be 40 rows.";
  for (const row of payload.board) {
    if (!Array.isArray(row) || row.length !== GRID_W) return "Board rows must be 10 columns.";
  }
  const piece = payload.piece;
  if (!piece || typeof piece !== "object") return "State missing piece.";
  if (typeof piece.shape !== "string") return "Piece shape missing.";
  if (!Number.isInteger(piece.rot)) return "Piece rotation invalid.";
  if (!Number.isInteger(piece.x) || !Number.isInteger(piece.y)) return "Piece position invalid.";
  return null;
}

function setStatusMessage(node, text, kind = "info") {
  node.__tetrisStatusMessage = {
    text,
    kind,
    until: performance.now() + 2500,
  };
  node.setDirtyCanvas(true, true);
}

function resetInputState(state) {
  state.moveDir = null;
  state.moveHeldLeft = false;
  state.moveHeldRight = false;
  state.moveDasElapsed = 0;
  state.moveArrElapsed = 0;
  state.softDrop = false;
  state.dropMs = state.baseDropMs;
}

function syncSeed(state, node) {
  const nextSeed = getSeedValue(node, { allowRandomize: false });
  if (Number.isInteger(nextSeed)) {
    if (nextSeed !== state.seed) {
      if (state.started) {
        return;
      }
      stopTimer(node);
      const nextState = createState(nextSeed, state.startLevel);
      nextState.running = false;
      nextState.started = false;
      node.__tetrisLive.state = nextState;
      updateBackendState(node);
      ensureTimer(node);
      node.setDirtyCanvas(true, true);
      return;
    }
    state.seed = nextSeed;
  }
}

function getStartLevel(node) {
  const defaultValue = 1;
  const parsed = Number.parseInt(`${getConfig(node).start_level}`, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return clampLevel(parsed);
}

function getLevelProgression(node) {
  const raw = `${getConfig(node).level_progression || ""}`.trim().toLowerCase();
  if (raw === "variable") return "variable";
  return "fixed";
}

function syncStartLevel(state, node) {
  const startLevel = getStartLevel(node);
  const progression = getLevelProgression(node);
  if (startLevel !== state.startLevel || progression !== state.levelProgression) {
    if (state.started) {
      return;
    }
    stopTimer(node);
    const nextState = createState(state.seed, startLevel, progression);
    nextState.running = false;
    nextState.started = false;
    node.__tetrisLive.state = nextState;
    updateBackendState(node);
    ensureTimer(node);
    node.setDirtyCanvas(true, true);
  } else {
    state.levelProgression = progression;
    updateLevel(state);
  }
}

function resetNode(node) {
  const live = node.__tetrisLive;
  if (!live) return;
  const seed = getSeedValue(node, { allowRandomize: true });
  const startLevel = getStartLevel(node);
  const progression = getLevelProgression(node);
  live.state = createState(seed ?? live.state.seed, startLevel, progression);
  node.size = [750, 950];
  node.__tetrisSizeInitialized = true;
  live.state.started = true;
  live.state.running = true;
  live.state.showBoardWhilePaused = false;
  updateBackendState(node);
  node.setDirtyCanvas(true, true);
}

function togglePause(node) {
  const live = node.__tetrisLive;
  if (!live) return;
  if (!live.state.started && !live.state.gameOver) {
    live.state.started = true;
    live.state.running = true;
  } else {
    live.state.running = !live.state.running;
  }
  live.state.showBoardWhilePaused = false;
  updateBackendState(node);
  node.setDirtyCanvas(true, true);
}

function ensureTimer(node) {
  const live = node.__tetrisLive;
  if (!live || live.state.timer) return;
  live.state.timer = setInterval(() => {
    if (live.state.running && live.state.started && !live.state.gameOver && !isNodeSelected(node)) {
      live.state.running = false;
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
      return;
    }
    if (!live.state.running || live.state.gameOver) return;
    const lockMode = getLockMode(node);
    updateAutoRepeat(live.state, node, 50);
    live.state.elapsed += 50;
    live.state.timeMs += 50;
    if (live.state.locking) {
      if (lockMode === "extended" && live.state.lockMoves >= 15) {
        settlePiece(live.state);
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
        return;
      }
      live.state.lockElapsed += 50;
      if (live.state.lockElapsed >= live.state.lockDelayMs) {
        settlePiece(live.state);
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
        return;
      }
    }
    if (live.state.elapsed >= live.state.dropMs) {
      live.state.elapsed = 0;
      stepDown(live.state);
      if (lockMode === "extended" && live.state.lockMoves >= 15 && live.state.locking) {
        settlePiece(live.state);
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
        return;
      }
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
    }
  }, 50);
}

function stopTimer(node) {
  const live = node.__tetrisLive;
  if (live?.state?.timer) {
    clearInterval(live.state.timer);
    live.state.timer = null;
  }
  if (live?.bgTimer) {
    clearInterval(live.bgTimer);
    live.bgTimer = null;
  }
}

function getSelectedLiveNode(allowFallback = false) {
  const selected = app.canvas?.selected_nodes;
  let fallback = null;
  if (allowFallback) {
    const nodes = app.graph?._nodes || [];
    for (const node of nodes) {
      if (node?.comfyClass === NODE_CLASS && node.__tetrisLive) {
        fallback = node;
        break;
      }
    }
  }
  if (!selected) return fallback;
  for (const key of Object.keys(selected)) {
    const node = selected[key];
    if (node?.comfyClass === NODE_CLASS && node.__tetrisLive) return node;
  }
  return fallback;
}

function isNodeSelected(node) {
  const selected = app.canvas?.selected_nodes;
  if (!selected) return false;
  for (const key of Object.keys(selected)) {
    if (selected[key] === node) return true;
  }
  return false;
}

function handleKey(event) {
  if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
  const node = getSelectedLiveNode(false);
  if (!node) return;
  const live = node.__tetrisLive;
  if (!live) return;
  const ui = node.__tetrisUi;
  if (ui?.captureAction) {
    if (event.key && event.key.toLowerCase() === "escape") {
      ui.captureAction = null;
      if (ui.modal?.body) {
        renderControlsModal(node, ui.modal.body);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const binding = bindingFromEvent(event);
    if (!binding) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    updateConfig(node, (next) => {
      const list = Array.isArray(next.bindings[ui.captureAction])
        ? next.bindings[ui.captureAction]
        : [];
      if (!list.includes(binding)) {
        list.push(binding);
      }
      next.bindings[ui.captureAction] = list.slice(0, 5);
      return next;
    });
    updateBackendState(node);
    ui.captureAction = null;
    if (ui.modal?.body) {
      renderControlsModal(node, ui.modal.body);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (ui?.modal) {
    if (event.key && event.key.toLowerCase() === "escape") {
      closeModal(node);
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  const state = live.state;
  const bindings = getControlBindings(node);
  const matches = (binding) => keyMatches(event, binding);
  const resetPressed = matches(bindings.reset);
  const pausePressed = matches(bindings.pause);
  if (state.gameOver) {
    if (resetPressed || pausePressed) {
      resetNode(node);
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }
  if (
    event.repeat
    && (matches(bindings.rotateCw)
      || matches(bindings.rotateCcw)
      || matches(bindings.moveLeft)
      || matches(bindings.moveRight)
      || matches(bindings.softDrop)
      || matches(bindings.hardDrop)
      || matches(bindings.hold)
      || matches(bindings.reset)
      || matches(bindings.pause))
  ) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const canAct =
    state.running ||
    matches(bindings.pause) ||
    matches(bindings.reset);
  if (!canAct) return;
  let handled = true;
  if (matches(bindings.moveLeft)) {
    state.moveHeldLeft = true;
    setMoveDirection(state, "left");
    if (move(state, -1, 0)) applyLockModeAfterAction(state, getLockMode(node));
  } else if (matches(bindings.moveRight)) {
    state.moveHeldRight = true;
    setMoveDirection(state, "right");
    if (move(state, 1, 0)) applyLockModeAfterAction(state, getLockMode(node));
  } else if (matches(bindings.rotateCw)) {
    if (rotate(state, 1)) {
      applyLockModeAfterAction(state, getLockMode(node));
    }
  } else if (matches(bindings.rotateCcw)) {
    if (rotate(state, -1)) {
      applyLockModeAfterAction(state, getLockMode(node));
    }
  } else if (matches(bindings.softDrop)) {
    state.softDrop = true;
    state.dropMs = Math.max(1, Math.floor(state.baseDropMs / 20));
  } else if (matches(bindings.hardDrop)) {
    hardDrop(state);
  } else if (matches(bindings.hold)) {
    holdPiece(state);
  } else if (matches(bindings.reset)) {
    resetNode(node);
  } else if (matches(bindings.pause)) {
    togglePause(node);
  } else {
    handled = false;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
    updateBackendState(node);
    node.setDirtyCanvas(true, true);
  }
}

function handleKeyUp(event) {
  if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
  const node = getSelectedLiveNode(false);
  if (!node) return;
  const live = node.__tetrisLive;
  if (!live || live.state.gameOver) return;
  if (node.__tetrisUi?.modal) return;
  const bindings = getControlBindings(node);
  const matches = (binding) => keyMatches(event, binding);
  if (matches(bindings.moveLeft)) {
    live.state.moveHeldLeft = false;
    if (live.state.moveHeldRight) {
      setMoveDirection(live.state, "right");
    } else {
      clearMoveDirection(live.state);
    }
  }
  if (matches(bindings.moveRight)) {
    live.state.moveHeldRight = false;
    if (live.state.moveHeldLeft) {
      setMoveDirection(live.state, "left");
    } else {
      clearMoveDirection(live.state);
    }
  }
  if (!matches(bindings.softDrop)) return;
  live.state.softDrop = false;
  live.state.dropMs = live.state.baseDropMs;
}

function applyWidgetHiding(node) {
  const hideWidgets = new Set([
    "action",
    "state",
    "block_size",
  ]);
  if (!node.widgets) return;
  let touched = false;
  for (const widget of node.widgets) {
    if (hideWidgets.has(widget?.name)) {
      widget.hidden = true;
      widget.computeSize = () => [0, 0];
      widget.draw = () => {};
      touched = true;
    }
  }
  if (touched) {
    node.__tetrisWidgetsHidden = true;
    node.setDirtyCanvas(true, true);
  }
}

function isValidLinkId(link) {
  return Number.isInteger(link) && link >= 0;
}

function getInputLink(node, name) {
  const input = node?.inputs?.find((inp) => inp?.name === name);
  if (!input || !isValidLinkId(input.link)) return null;
  let linkId = input.link;
  let link = null;
  let origin = null;
  for (let hop = 0; hop < 8; hop += 1) {
    link = node.graph?.links?.[linkId];
    if (!link) return null;
    origin = node.graph?._nodes_by_id?.[link.origin_id];
    if (!origin) return null;
    const isReroute = origin?.type === "Reroute" || origin?.comfyClass === "Reroute";
    if (!isReroute) {
      return { link, origin };
    }
    const rerouteInput = origin.inputs?.[0];
    if (!rerouteInput || !isValidLinkId(rerouteInput.link)) {
      return { link, origin };
    }
    linkId = rerouteInput.link;
  }
  return null;
}

function getInputValue(node, name) {
  const idx = node?.inputs?.findIndex((inp) => inp?.name === name);
  if (idx == null || idx < 0) return null;
  const input = node.inputs[idx];
  if (!isValidLinkId(input?.link)) return null;
  if (typeof node.getInputData !== "function") return null;
  const value = node.getInputData(idx);
  let candidate = value;
  if (value && typeof value === "object") {
    if ("value" in value) {
      candidate = value.value;
    } else if ("seed" in value) {
      candidate = value.seed;
    }
  }
  const coerced = coerceInt(candidate);
  return coerced != null ? coerced : null;
}

function coerceInt(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return null;
}

function getLinkedInputValue(node, name) {
  const resolved = getInputLink(node, name);
  if (!resolved) return null;
  const { link, origin } = resolved;
  const output = origin.outputs?.[link.origin_slot];
  if (output && output.value !== undefined) {
    const coerced = coerceInt(output.value);
    if (coerced != null) return coerced;
  }
  const outputName = output?.name;
  if (outputName && origin.widgets) {
    const widgetIndex = origin.widgets.findIndex((w) => w.name === outputName);
    if (widgetIndex >= 0) {
      const widgetValue = origin.widgets[widgetIndex]?.value;
      const coerced = coerceInt(widgetValue);
      if (coerced != null) return coerced;
      if (origin.widgets_values && origin.widgets_values.length > widgetIndex) {
        const coercedStored = coerceInt(origin.widgets_values[widgetIndex]);
        if (coercedStored != null) return coercedStored;
      }
    }
  }
  if (origin.widgets_values && origin.widgets_values.length) {
    const coerced = coerceInt(origin.widgets_values[0]);
    if (coerced != null) return coerced;
  }
  if (origin.widgets && origin.widgets.length) {
    const coerced = coerceInt(origin.widgets[0]?.value);
    if (coerced != null) return coerced;
  }
  return null;
}

function isSeedLinked(node) {
  return !!getInputLink(node, "seed");
}

function resolveSeed(value, allowRandomize) {
  const coerced = coerceInt(value);
  if (coerced == null) return null;
  if (coerced < 0) {
    if (!allowRandomize) return null;
    const max = 0xffffffff;
    return Math.floor(Math.random() * (max + 1));
  }
  return coerced;
}

function getSeedValue(node, options = {}) {
  const allowRandomize = options.allowRandomize === true;
  const liveInput = getInputValue(node, "seed");
  const liveResolved = resolveSeed(liveInput, allowRandomize);
  if (liveResolved != null) return liveResolved;
  const linked = getLinkedInputValue(node, "seed");
  const linkedResolved = resolveSeed(linked, allowRandomize);
  if (linkedResolved != null) return linkedResolved;
  const seedWidget = node.widgets?.find((w) => w.name === "seed");
  const fallback = resolveSeed(seedWidget?.value, allowRandomize);
  return fallback != null ? fallback : 0;
}

function normalizeBindingValue(value) {
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

function getControlBindings(node) {
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
  };
}

function getQueueSize(node) {
  const parsed = Number.parseInt(`${getConfig(node).queue_size}`, 10);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(0, Math.min(6, parsed));
}

function getHoldEnabled(node) {
  return !!getConfig(node).hold_queue;
}

function getNextPieceEnabled(node) {
  return !!getConfig(node).next_piece;
}

function getShowControls(node) {
  return !!getConfig(node).show_controls;
}

function getGridEnabled(node) {
  return !!getConfig(node).grid_enabled;
}

function getGridColor(node) {
  const raw = getConfig(node).grid_color;
  const parsed = normalizeColor(raw, true);
  return parsed || "rgba(255,255,255,0.2)";
}

function formatKeyLabel(value) {
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
  if (value === "arrowleft") return "ArrowLeft";
  if (value === "arrowright") return "ArrowRight";
  if (value === "arrowup") return "ArrowUp";
  if (value === "arrowdown") return "ArrowDown";
  if (value.startsWith("numpad")) {
    return value.replace("numpad", "Num");
  }
  return value.toUpperCase();
}

function formatTimeMs(ms) {
  const total = Math.max(0, Math.floor(ms || 0));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  const mm = `${minutes}`.padStart(2, "0");
  const ss = `${seconds}`.padStart(2, "0");
  const cc = `${centis}`.padStart(2, "0");
  return `${mm}:${ss}.${cc}`;
}

function formatKeyList(values) {
  if (!values) return "";
  const items = values
    .map((value) => formatKeyLabel(value))
    .filter((value) => value);
  return items.join(", ");
}

function normalizeEventKey(event) {
  const key = event.key ? event.key.toLowerCase() : "";
  const code = event.code ? event.code.toLowerCase() : "";
  return { key, code };
}

function bindingFromEvent(event) {
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

function keyMatches(event, binding) {
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

function parseHexColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(defaults, stored) {
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

function getConfig(node) {
  if (!node) return cloneDeep(DEFAULT_CONFIG);
  if (!node.properties) node.properties = {};
  const stored = node.properties.tetrinode_config;
  const merged = mergeConfig(DEFAULT_CONFIG, stored);
  node.properties.tetrinode_config = merged;
  return merged;
}

function updateConfig(node, updater) {
  const current = getConfig(node);
  const next = updater(cloneDeep(current));
  node.properties.tetrinode_config = next;
  return next;
}

function getOptionsForState(node) {
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
    ...config.colors,
  };
}

function normalizeColor(value, allowAlpha = true) {
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

function parseRgbaString(value) {
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

function getColorPalette(node) {
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
    const allowAlpha = key !== "background_color";
    const parsed = normalizeColor(raw, allowAlpha);
    if (parsed) palette[shape] = parsed;
  }
  return palette;
}

function isGhostEnabled(node) {
  return !!getConfig(node).ghost_piece;
}

function ensureSeedControlWidget(node) {
  if (!node?.widgets) return;
  const existing = node.widgets.find((w) => w.name === "control_after_generate");
  if (existing) return;
  const seedIndex = node.widgets.findIndex((w) => w.name === "seed");
  if (seedIndex < 0) return;
  const widget = node.addWidget(
    "combo",
    "control_after_generate",
    "randomize",
    () => {},
    { values: ["randomize", "increment", "decrement", "fixed"] }
  );
  const currentIndex = node.widgets.indexOf(widget);
  if (currentIndex >= 0) {
    node.widgets.splice(currentIndex, 1);
    node.widgets.splice(seedIndex + 1, 0, widget);
  }
}

function applySeedAfterGenerate(node) {
  if (isSeedLinked(node)) return;
  if (!node?.widgets) return;
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
  if (!seedWidget || !controlWidget) return;
  let mode = controlWidget.value;
  const controlIndex = node.widgets.indexOf(controlWidget);
  if (!mode && controlIndex >= 0 && node.widgets_values) {
    mode = node.widgets_values[controlIndex];
  }
  mode = `${mode || ""}`.toLowerCase();
  if (mode === "fixed") return;
  const min = coerceInt(seedWidget.options?.min) ?? 0;
  const maxOption = seedWidget.options?.max;
  if (maxOption != null && !Number.isSafeInteger(maxOption)) {
    return;
  }
  const max =
    Number.isFinite(maxOption) && Number.isSafeInteger(maxOption)
      ? maxOption
      : 0x7fffffff;
  const current = coerceInt(seedWidget.value) ?? min;
  let next = current;
  if (mode === "increment") {
    next = current >= max ? min : current + 1;
  } else if (mode === "decrement") {
    next = current <= min ? max : current - 1;
  } else if (mode === "randomize") {
    next = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  seedWidget.value = next;
  const seedIndex = node.widgets.indexOf(seedWidget);
  if (!node.widgets_values) node.widgets_values = [];
  if (seedIndex >= 0) node.widgets_values[seedIndex] = next;
}

app.registerExtension({
  name: EXT_NAME,
  async nodeCreated(node) {
    if (node?.comfyClass !== NODE_CLASS) return;
    applyWidgetHiding(node);
    ensureSeedControlWidget(node);
    ensureUiState(node);
    getConfig(node);
    const seed = getSeedValue(node, { allowRandomize: true });
    const startLevel = getStartLevel(node);
    const progression = getLevelProgression(node);
    node.__tetrisLive = { state: createState(seed ?? 0, startLevel, progression) };

    if (!node.__tetrisSizeInitialized) {
      node.size = [750, 950];
      node.__tetrisSizeInitialized = true;
    }

    const originalDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      const result = originalDraw?.apply(this, arguments);
      drawNode(node, ctx);
      return result;
    };

    const originalMouseDown = node.onMouseDown;
    node.onMouseDown = function (event, pos, _graphcanvas) {
      if (handleToolbarClick(node, pos)) {
        node.setDirtyCanvas(true, true);
        return true;
      }
      return originalMouseDown?.apply(this, arguments);
    };

    const originalMouseMove = node.onMouseMove;
    node.onMouseMove = function (event, pos, _graphcanvas) {
      const ui = ensureUiState(node);
      const hovered = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
      const next = hovered ? hovered.id : null;
      if (next !== (ui.hoverButton?.id || null)) {
        ui.hoverButton = hovered;
        node.setDirtyCanvas(true, true);
      }
      return originalMouseMove?.apply(this, arguments);
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
      closeModal(node);
      stopTimer(node);
      return originalRemoved?.apply(this, arguments);
    };
    const originalExecuted = node.onExecuted;
    node.onExecuted = function () {
      const result = originalExecuted?.apply(this, arguments);
      applySeedAfterGenerate(node);
      return result;
    };

    syncSeed(node.__tetrisLive.state, node);
    node.__tetrisLive.state.running = false;
    updateBackendState(node);
    ensureTimer(node);
    ensureBackgroundUpdater(node);
    if (!node.__tetrisLive.api) {
      node.__tetrisLive.api = {
        rotateCw: () => {
          rotate(node.__tetrisLive.state, 1);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
        rotateCcw: () => {
          rotate(node.__tetrisLive.state, -1);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
        hardDrop: () => {
          hardDrop(node.__tetrisLive.state);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
      };
    }
  },
  async setup() {
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("keyup", handleKeyUp, true);
  },
});
