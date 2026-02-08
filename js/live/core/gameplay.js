import {
  GRID_H_TOTAL,
  GRID_W,
  HIDDEN_ROWS,
  SPAWN_Y,
} from "../constants.js";
import { SHAPES } from "../data/shapes.js";

export function createRng(seed, stateOverride = null) {
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

const PIXELATED_TEXTURE_SAMPLE_RATIO = 0.25;
const PIXELATED_TEXTURE_ROTATIONS = [0, 90, 180, 270];

export function createPixelatedTransform() {
  const size = PIXELATED_TEXTURE_SAMPLE_RATIO;
  const max = Math.max(0, 1 - size);
  return {
    u: Math.random() * max,
    v: Math.random() * max,
    size,
    rotation: PIXELATED_TEXTURE_ROTATIONS[Math.floor(Math.random() * PIXELATED_TEXTURE_ROTATIONS.length)],
    flipX: Math.random() < 0.5,
    flipY: Math.random() < 0.5,
  };
}

export function ensurePieceTextureTransforms(piece) {
  if (!piece || !piece.shape) return [];
  const expected = SHAPES[piece.shape]?.[0]?.length ?? 0;
  if (!Array.isArray(piece.textureTransforms) || piece.textureTransforms.length !== expected) {
    piece.textureTransforms = Array.from({ length: expected }, () => createPixelatedTransform());
  }
  return piece.textureTransforms;
}

export function getPreviewTextureTransforms(state, shape, key) {
  if (!state || !shape || !SHAPES[shape]) return [];
  if (!state.previewTextureCache) state.previewTextureCache = {};
  const expected = SHAPES[shape]?.[0]?.length ?? 0;
  const entry = state.previewTextureCache[key];
  if (!entry || entry.shape !== shape || entry.transforms.length !== expected) {
    const transforms = Array.from({ length: expected }, () => createPixelatedTransform());
    state.previewTextureCache[key] = { shape, transforms };
  }
  return state.previewTextureCache[key].transforms;
}

export function getUiPreviewTextureTransforms(ui, shape) {
  if (!ui || !shape || !SHAPES[shape]) return [];
  if (!ui.blockStylePreviewTextureCache) ui.blockStylePreviewTextureCache = {};
  const expected = SHAPES[shape]?.[0]?.length ?? 0;
  const entry = ui.blockStylePreviewTextureCache[shape];
  if (!entry || entry.transforms.length !== expected) {
    ui.blockStylePreviewTextureCache[shape] = {
      transforms: Array.from({ length: expected }, () => createPixelatedTransform()),
    };
  }
  return ui.blockStylePreviewTextureCache[shape].transforms;
}

export function shuffledBag(rng) {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

export function newPiece(shape) {
  return { shape, rot: 0, x: 3, y: SPAWN_Y };
}

export function pieceBottomY(piece) {
  return Math.max(...pieceCells(piece).map(([, y]) => y));
}

export function emptyBoard() {
  const board = [];
  for (let y = 0; y < GRID_H_TOTAL; y += 1) {
    const row = new Array(GRID_W).fill(0);
    board.push(row);
  }
  return board;
}

export function emptyTextureBoard() {
  const board = [];
  for (let y = 0; y < GRID_H_TOTAL; y += 1) {
    const row = new Array(GRID_W).fill(null);
    board.push(row);
  }
  return board;
}

export function pieceCells(piece) {
  const shape = SHAPES[piece.shape][piece.rot % 4];
  return shape.map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
}

export function collides(board, piece) {
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H_TOTAL) return true;
    if (board[y][x]) return true;
  }
  return false;
}

export function lockPiece(board, piece, textureBoard = null, textureTransforms = null) {
  const cells = pieceCells(piece);
  cells.forEach(([x, y], index) => {
    if (y >= 0 && y < GRID_H_TOTAL && x >= 0 && x < GRID_W) {
      board[y][x] = piece.shape;
      if (textureBoard) {
        textureBoard[y][x] = textureTransforms?.[index] ?? createPixelatedTransform();
      }
    }
  });
}

export function clearLines(board, textureBoard = null) {
  const remaining = [];
  const remainingTextures = textureBoard ? [] : null;
  for (let y = 0; y < GRID_H_TOTAL; y += 1) {
    if (board[y].some((cell) => cell === 0)) {
      remaining.push(board[y]);
      if (remainingTextures) remainingTextures.push(textureBoard[y]);
    }
  }
  const cleared = GRID_H_TOTAL - remaining.length;
  while (remaining.length < GRID_H_TOTAL) {
    remaining.unshift(new Array(GRID_W).fill(0));
    if (remainingTextures) remainingTextures.unshift(new Array(GRID_W).fill(null));
  }
  return { board: remaining, textures: remainingTextures, cleared };
}

export function fullLineRows(board) {
  const rows = [];
  for (let y = 0; y < board.length; y += 1) {
    if (board[y].every((cell) => cell !== 0)) {
      rows.push(y);
    }
  }
  return rows;
}

export function createState(seed, startLevel = 1, levelProgression = "fixed") {
  const rng = createRng(seed);
  const bag = shuffledBag(rng);
  const piece = newPiece(bag.shift());
  ensurePieceTextureTransforms(piece);
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
    holdTextureTransforms: null,
    holdUsed: false,
    board: emptyBoard(),
    boardTextures: emptyTextureBoard(),
    previewTextureCache: {},
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
    hasStartedGame: false,
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
    lastLockedPiece: null,
    lockFlash: null,
    lineClear: null,
    clearing: false,
    pendingClear: null,
    hardDropTrail: null,
    actionToast: null,
    b2bStreak: 0,
    rotateSinceLock: false,
    tspin: "none",
    lockMoves: 0,
    lowestY: pieceBottomY(piece),
    moveDir: null,
    moveHeldLeft: false,
    moveHeldRight: false,
    moveDasElapsed: 0,
    moveArrElapsed: 0,
    boardDirty: true,
    timer: null,
  };
}

export function hydrateState(serialized, fallbackSeed, startLevel = 1) {
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
  base.boardTextures = emptyTextureBoard();
  for (let y = 0; y < GRID_H_TOTAL; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      if (base.board[y]?.[x]) {
        base.boardTextures[y][x] = createPixelatedTransform();
      }
    }
  }
  if (Array.isArray(data.bag)) {
    base.bag = data.bag.slice();
  }
  base.previewTextureCache = {};
  if (Number.isInteger(data.bag_count)) base.bagCount = data.bag_count;
  if (data.piece && typeof data.piece === "object") {
    base.piece = {
      shape: data.piece.shape,
      rot: data.piece.rot,
      x: data.piece.x,
      y: data.piece.y,
    };
  }
  ensurePieceTextureTransforms(base.piece);
  if (data.next_piece_shape) base.nextShape = data.next_piece_shape;
  if (data.hold_piece_shape !== undefined) base.holdShape = data.hold_piece_shape;
  if (base.holdShape) {
    const count = SHAPES[base.holdShape]?.[0]?.length ?? 0;
    base.holdTextureTransforms = Array.from({ length: count }, () => createPixelatedTransform());
  } else {
    base.holdTextureTransforms = null;
  }
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

export function fallSpeedSeconds(level) {
  const lvl = Math.max(1, Math.min(15, Math.floor(level || 1)));
  const base = 0.8 - (lvl - 1) * 0.007;
  return Math.pow(base, lvl - 1);
}

export function clampLevel(value) {
  const parsed = Number.parseInt(`${value}`, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(15, parsed));
}

export function updateLevel(state) {
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

export function awardedGoalLines(lines, tspinType, b2bActive) {
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

export function scoreForClear(level, lines, tspinType, b2bActive) {
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

export function actionToastText(scoredPoints, colorKey) {
  if (!scoredPoints || scoredPoints <= 0) return null;
  return { text: `+${scoredPoints}`, colorKey };
}

export function toastScaleForChain(comboStreak, b2bStreak) {
  const chain = Math.max(comboStreak || 0, b2bStreak || 0);
  return Math.min(1.6, 1 + 0.2 * Math.max(0, chain - 1));
}

export function setActionToast(state, info, anchor, scale = 1, duration = 1200) {
  if (state.options?.anim_score_toasts === false) return;
  if (!info || !info.text) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  state.actionToast = {
    text: info.text,
    colorKey: info.colorKey,
    anchorX: anchor?.x ?? null,
    anchorY: anchor?.y ?? null,
    scale,
    until: now + duration,
    start: now,
    duration,
  };
}

export function ensureBag(state) {
  if (state.bag.length === 0) {
    state.bag = shuffledBag(state.rng);
    state.bagCount += 1;
  }
}

export function getUpcomingShapes(state, count) {
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

export function spawnNext(state) {
  state.piece = newPiece(state.nextShape);
  ensurePieceTextureTransforms(state.piece);
  ensureBag(state);
  state.nextShape = state.bag.shift();
  state.holdUsed = false;
  state.lockMoves = 0;
  state.lowestY = pieceBottomY(state.piece);
  state.locking = false;
  state.lockElapsed = 0;
  state.rotateSinceLock = false;
  updateLevel(state);
  if (collides(state.board, state.piece)) {
    state.gameOver = true;
    state.running = false;
  }
}

export function updateLowestY(state) {
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

export function stepDown(state) {
  const moved = { ...state.piece, y: state.piece.y + 1 };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    state.locking = false;
    state.lockElapsed = 0;
    updateLowestY(state);
    if (state.softDrop) {
      state.lastAction = "move";
      state.lastRotateKick = null;
      state.rotateSinceLock = false;
    }
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

export function cornerOccupied(board, x, y) {
  if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H_TOTAL) return true;
  return board[y][x] !== 0;
}

export function tspinType(state) {
  const piece = state.piece;
  if (piece.shape !== "T" || state.lastAction !== "rotate") return "none";
  const type = tspinTypeForPiece(state.board, piece);
  if (type === "none") return "none";
  if (state.lastRotateKick === 4) return "tspin";
  return type;
}

export function tspinTypeForPiece(board, piece) {
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
  const frontHits = front.reduce((acc, k) => acc + (cornerOccupied(board, ...corners[k]) ? 1 : 0), 0);
  const backHits = back.reduce((acc, k) => acc + (cornerOccupied(board, ...corners[k]) ? 1 : 0), 0);
  if (frontHits + backHits < 3) return "none";
  if (frontHits === 2 && backHits === 2) return "tspin";
  if (frontHits === 2 && backHits >= 1) return "tspin";
  if (backHits === 2 && frontHits >= 1) return "mini";
  return "none";
}

export function settlePiece(state) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const flashCells = new Set(pieceCells(state.piece).map(([x, y]) => `${x},${y}`));
  if (state.options?.anim_lock_flash !== false) {
    state.lockFlash = { until: now + 220, duration: 220, elapsed: 0, start: now, cells: flashCells };
  } else {
    state.lockFlash = null;
  }
  state.lastLockedPiece = {
    shape: state.piece.shape,
    x: state.piece.x,
    y: state.piece.y,
    rot: state.piece.rot,
  };
  lockPiece(state.board, state.piece, state.boardTextures, ensurePieceTextureTransforms(state.piece));
  state.tspin = tspinType(state);
  const fullRows = fullLineRows(state.board);
  const levelBefore = state.level;
  const prevB2b = state.b2bActive;
  const center = pieceCells(state.piece).reduce(
    (acc, [x, y]) => {
      acc.x += x + 0.5;
      acc.y += y + 0.5;
      return acc;
    },
    { x: 0, y: 0 },
  );
  const cellCount = Math.max(1, pieceCells(state.piece).length);
  const anchorX = center.x / cellCount;
  const anchorY = center.y / cellCount;
  if (fullRows.length) {
    const result = clearLines(state.board, state.boardTextures);
    const scored = scoreForClear(levelBefore, result.cleared, state.tspin, state.b2bActive);
    const qualifies = scored.b2bActive;
    const nextCombo = (state.comboStreak || 0) + 1;
    const nextB2bStreak = qualifies ? ((prevB2b ? (state.b2bStreak || 0) + 1 : 1)) : 0;
    const pendingClear = {
      result,
      cleared: result.cleared,
      tspin: state.tspin,
      rows: fullRows,
      levelBefore,
      prevB2b,
      scored,
    };
    if (state.options?.anim_line_clear === false) {
      applyPendingClear(state, pendingClear);
      state.locking = false;
      state.lockElapsed = 0;
      state.boardDirty = true;
      return;
    }
    state.pendingClear = pendingClear;
    state.clearing = true;
    state.lineClear = {
      rows: fullRows,
      elapsed: 0,
      flashMs: 80,
      wipeMs: 180 + fullRows.length * 40,
      duration: 80 + 180 + fullRows.length * 40,
    };
    const topRow = Math.min(...fullRows);
    setActionToast(
      state,
      actionToastText(scored.points, state.lastLockedPiece?.shape),
      { x: anchorX, y: Math.max(HIDDEN_ROWS, topRow - 1) },
      toastScaleForChain(nextCombo, nextB2bStreak),
    );
    state.locking = false;
    state.lockElapsed = 0;
    state.boardDirty = true;
    return;
  }
  const result = { cleared: 0 };
  const hadTspin = state.tspin !== "none";
  state.comboStreak = 0;
  if (hadTspin) {
    state.tspins = (state.tspins || 0) + 1;
  }
  const scored = scoreForClear(levelBefore, result.cleared, state.tspin, state.b2bActive);
  state.score += scored.points;
  state.b2bActive = scored.b2bActive;
  const qualifies = scored.b2bActive;
  state.b2bStreak = qualifies ? ((state.b2bStreak || 0) + (prevB2b ? 1 : 1)) : 0;
  setActionToast(
    state,
    actionToastText(scored.points, state.lastLockedPiece?.shape),
    { x: anchorX, y: anchorY - 1 },
    toastScaleForChain(state.comboStreak || 0, state.b2bStreak || 0),
  );
  if (state.levelProgression === "variable") {
    state.goalLinesTotal += awardedGoalLines(result.cleared, state.tspin, prevB2b);
  }
  updateLevel(state);
  state.locking = false;
  state.lockElapsed = 0;
  state.boardDirty = true;
  spawnNext(state);
}

export function applyPendingClear(state, pending) {
  if (!pending) return;
  state.board = pending.result.board;
  if (pending.result.textures) {
    state.boardTextures = pending.result.textures;
  }
  const hadTspin = pending.tspin !== "none";
  if (pending.cleared > 0) {
    state.lines += pending.cleared;
    state.comboStreak = (state.comboStreak || 0) + 1;
    if (state.comboStreak === 2) {
      state.comboTotal = (state.comboTotal || 0) + 1;
    }
    if (pending.cleared === 4) {
      state.tetrises = (state.tetrises || 0) + 1;
    }
    if (hadTspin) {
      state.tspins = (state.tspins || 0) + 1;
    }
  } else {
    state.comboStreak = 0;
    if (hadTspin) {
      state.tspins = (state.tspins || 0) + 1;
    }
  }
  const scored = pending.scored || scoreForClear(pending.levelBefore, pending.cleared, pending.tspin, state.b2bActive);
  state.score += scored.points;
  state.b2bActive = scored.b2bActive;
  const qualifies = scored.b2bActive;
  state.b2bStreak = qualifies
    ? (pending.prevB2b ? (state.b2bStreak || 0) + 1 : 1)
    : 0;
  if (state.levelProgression === "variable") {
    state.goalLinesTotal += awardedGoalLines(pending.cleared, pending.tspin, pending.prevB2b);
  }
  updateLevel(state);
  spawnNext(state);
}

export function serializeState(state) {
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

export function move(state, dx, dy, opts = {}) {
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    if (!opts.skipLastAction) {
      state.lastAction = "move";
      state.lastRotateKick = null;
      state.rotateSinceLock = false;
    }
    updateLowestY(state);
    return true;
  }
  return false;
}

export function rotate(state, delta) {
  const rotated = rotateWithKick(state.board, state.piece, delta);
  if (rotated) {
    state.piece = rotated.piece;
    state.lastAction = "rotate";
    state.lastRotateKick = rotated.kick;
    state.rotateSinceLock = true;
    updateLowestY(state);
    return true;
  }
  return false;
}

export function kickTable(shape, fromRot, toRot) {
  if (shape === "O") return [[0, 0]];
  if (shape === "I") {
    const table = {
      "0>1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "1>0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "1>2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
      "2>1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "2>3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "3>2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "3>0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "0>3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    };
    return table[`${fromRot}>${toRot}`] || [[0, 0]];
  }
  const table = {
    "0>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "1>0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "1>2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    "2>1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "2>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "3>2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "3>0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "0>3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  };
  return table[`${fromRot}>${toRot}`] || [[0, 0]];
}

export function rotateWithKick(board, piece, delta) {
  const fromRot = piece.rot % 4;
  const toRot = (fromRot + delta + 4) % 4;
  const kicks = kickTable(piece.shape, fromRot, toRot);
  const debug = typeof window !== "undefined" && window.__tspinDebug?.enabled && piece.shape === "T";
  for (let i = 0; i < kicks.length; i += 1) {
    const [dx, dy] = kicks[i];
    const candidate = { ...piece, rot: toRot, x: piece.x + dx, y: piece.y + dy };
    const blocked = collides(board, candidate);
    if (debug) {
      console.log(
        `[tspin-debug] kick=${i} delta=${delta} from=(${piece.x},${piece.y},${fromRot}) to=(${candidate.x},${candidate.y},${toRot}) blocked=${blocked}`
      );
      if (i === 4) {
        const cells = SHAPES[piece.shape]?.[toRot] || [];
        const occupied = cells.map(([cx, cy]) => {
          const x = candidate.x + cx;
          const y = candidate.y + cy;
          let status = "empty";
          if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H_TOTAL) {
            status = "oob";
          } else if (board[y]?.[x]) {
            status = "blocked";
          }
          return { x, y, status };
        });
        console.log(`[tspin-debug] kick=4 cells=${JSON.stringify(occupied)}`);
      }
    }
    if (!blocked) {
      return { piece: candidate, kick: i };
    }
  }
  return null;
}

export function hardDrop(state) {
  const startY = state.piece.y;
  let moved = 0;
  while (move(state, 0, 1, { skipLastAction: true })) {
    moved += 1;
    // keep dropping
  }
  if (moved > 0) {
    state.score += moved * 2;
    if (state.options?.anim_hard_drop_trail !== false) {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      state.hardDropTrail = {
        shape: state.piece.shape,
        rot: state.piece.rot,
        x: state.piece.x,
        startY,
        endY: state.piece.y,
        start: now,
        duration: 200,
      };
    } else {
      state.hardDropTrail = null;
    }
  }
  settlePiece(state);
}

export function holdPiece(state) {
  if (state.holdUsed || state.gameOver) return false;
  const currentShape = state.piece.shape;
  const currentTextures = ensurePieceTextureTransforms(state.piece);
  if (state.holdShape) {
    const swapShape = state.holdShape;
    const swapTextures = state.holdTextureTransforms;
    state.holdShape = currentShape;
    state.holdTextureTransforms = currentTextures;
    state.piece = newPiece(swapShape);
    state.piece.textureTransforms = swapTextures ?? ensurePieceTextureTransforms(state.piece);
  } else {
    state.holdShape = currentShape;
    state.holdTextureTransforms = currentTextures;
    ensureBag(state);
    state.piece = newPiece(state.nextShape);
    ensurePieceTextureTransforms(state.piece);
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
