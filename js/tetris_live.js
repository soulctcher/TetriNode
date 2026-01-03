import { app } from "../../scripts/app.js";

const EXT_NAME = "tetrinode.live";
const NODE_CLASS = "TetriNode";

const GRID_W = 10;
const GRID_H_TOTAL = 40;
const GRID_H_VISIBLE = 20;
const HIDDEN_ROWS = GRID_H_TOTAL - GRID_H_VISIBLE;
const SPAWN_Y = HIDDEN_ROWS - 2;
const PREVIEW_GRID = 4;
const BLOCK = 16;
const PADDING = 12;
const HEADER_H = 28;
const CONTROL_GAP = 0;
const PAUSE_GAP = 6;
const CONTROL_MIN = 110;
const CENTER_BIAS_X = 24;

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

function createRng(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function shuffledBag(rng) {
  const bag = Object.keys(SHAPES);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

function newPiece(shape) {
  return { shape, rot: 0, x: 3, y: SPAWN_Y };
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

function createState(seed) {
  const rng = createRng(seed);
  const bag = shuffledBag(rng);
  const piece = newPiece(bag.shift());
  const nextShape = bag.shift();
  const baseDropMs = 600;
  return {
    seed,
    rng,
    bag,
    bagCount: 0,
    piece,
    nextShape,
    board: emptyBoard(),
    score: 0,
    lines: 0,
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
    timer: null,
  };
}

function ensureBag(state) {
  if (state.bag.length === 0) {
    state.bag = shuffledBag(state.rng);
    state.bagCount += 1;
  }
}

function spawnNext(state) {
  state.piece = newPiece(state.nextShape);
  ensureBag(state);
  state.nextShape = state.bag.shift();
  if (collides(state.board, state.piece)) {
    state.gameOver = true;
    state.running = false;
  }
}

function stepDown(state) {
  const moved = { ...state.piece, y: state.piece.y + 1 };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    state.locking = false;
    state.lockElapsed = 0;
    return;
  }
  if (!state.locking) {
    state.locking = true;
    state.lockElapsed = 0;
  }
}

function settlePiece(state) {
  lockPiece(state.board, state.piece);
  const result = clearLines(state.board);
  state.board = result.board;
  if (result.cleared > 0) {
    state.lines += result.cleared;
  }
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
    piece: { ...state.piece },
    next_piece_shape: state.nextShape,
    score: state.score,
    lines_cleared_total: state.lines,
    game_over: state.gameOver,
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

function move(state, dx, dy) {
  const moved = { ...state.piece, x: state.piece.x + dx, y: state.piece.y + dy };
  if (!collides(state.board, moved)) {
    state.piece = moved;
    state.locking = false;
    state.lockElapsed = 0;
    return true;
  }
  return false;
}

function rotate(state, delta) {
  const rotated = { ...state.piece, rot: (state.piece.rot + delta + 4) % 4 };
  if (!collides(state.board, rotated)) {
    state.piece = rotated;
    state.locking = false;
    state.lockElapsed = 0;
  }
}

function hardDrop(state) {
  while (move(state, 0, 1)) {
    // keep dropping
  }
  settlePiece(state);
}

function drawBlock(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function getWidgetBottom(node) {
  if (!node.widgets) return 0;
  let maxY = 0;
  let maxMeasured = 0;
  let flowY = HEADER_H + PADDING;
  for (const w of node.widgets) {
    if (w?.hidden) continue;
    let h = 24;
    if (typeof w.computeSize === "function") {
      const size = w.computeSize();
      if (size && Number.isFinite(size[1]) && size[1] > 0) {
        h = size[1];
      }
    }
    if (w?.type === "button") {
      h = Math.max(h, 28);
    }
    flowY += h + 6;
    maxY = Math.max(maxY, flowY);
    if (typeof w.last_y === "number" && w.last_y > 0) {
      maxMeasured = Math.max(maxMeasured, w.last_y + h);
    }
  }
  return maxMeasured > 0 ? maxMeasured : maxY;
}

function getLayout(node) {
  let widgetBottom = getWidgetBottom(node);
  const pauseWidget = node?.widgets?.find((w) => w.name === "Pause/Play");
  let pauseBottom = null;
  if (pauseWidget) {
    let pauseH = 24;
    if (typeof pauseWidget.computeSize === "function") {
      const size = pauseWidget.computeSize();
      if (size && Number.isFinite(size[1]) && size[1] > 0) {
        pauseH = size[1];
      }
    }
    if (pauseWidget.type === "button") {
      pauseH = Math.max(pauseH, 32);
    }
    if (typeof pauseWidget.last_y === "number" && pauseWidget.last_y > 0) {
      pauseBottom = pauseWidget.last_y + pauseH;
      widgetBottom = pauseBottom + PAUSE_GAP;
    }
  }
  const minTop = HEADER_H + PADDING + CONTROL_MIN;
  const topY = Math.max(minTop, widgetBottom + CONTROL_GAP);
  const bottomY = Math.max(topY, node.size[1] - PADDING);
  const innerH = Math.max(0, bottomY - topY);
  const innerW = Math.max(0, node.size[0] - PADDING * 2);

  let sideW = 120;
  let blockSize = BLOCK;
  for (let i = 0; i < 2; i += 1) {
    const boardW = Math.max(0, innerW - sideW - PADDING);
    blockSize = Math.floor(Math.min(boardW / GRID_W, innerH / GRID_H_VISIBLE));
    blockSize = Math.max(6, blockSize);
    sideW = Math.max(PREVIEW_GRID * blockSize + PADDING * 2, 120);
  }

  const boardW = blockSize * GRID_W;
  const boardH = blockSize * GRID_H_VISIBLE;
  const totalW = boardW + sideW + PADDING;
  const boardX = Math.max(PADDING, (node.size[0] - totalW) / 2 + CENTER_BIAS_X);
  const boardY = topY;
  const sideX = boardX + boardW + PADDING;
  const sideY = boardY;

  node.__tetrisLastLayout = {
    boardY,
    pauseBottom,
  };

  return { boardX, boardY, boardW, boardH, sideX, sideY, blockSize };
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
    if (y >= HIDDEN_ROWS && y < GRID_H_TOTAL) {
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
    if (y >= HIDDEN_ROWS && y < GRID_H_TOTAL) {
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
  if (!value) {
    source = getLinkedImageSource(node, "background_image");
    value = source;
  }
  if (!value && !source) return null;
  if (!node.__tetrisBg) node.__tetrisBg = {};
  if (node.__tetrisBg.value === value && node.__tetrisBg.source) {
    return node.__tetrisBg.source;
  }
  if (!source) {
    source = coerceImageSource(value);
  }
  if (!source) {
    source = buildCanvasFromData(value);
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

function drawNode(node, ctx) {
  const live = node.__tetrisLive;
  if (!live) return;
  if (!node.__tetrisWidgetsHidden) {
    applyWidgetHiding(node);
  }
  syncSeed(live.state, node);
  const { state } = live;
  const { boardX, boardY, boardW, boardH, sideX, sideY, blockSize } = getLayout(node);
  const palette = getColorPalette(node);
  const ghostEnabled = isGhostEnabled(node);

  const bgSource = getBackgroundSource(node);
  drawBoardBackground(ctx, bgSource, boardX, boardY, boardW, boardH, palette.X);
  ctx.strokeStyle = "rgba(150,150,150,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(boardX + 0.5, boardY + 0.5, boardW - 1, boardH - 1);

  for (let y = 0; y < GRID_H_VISIBLE; y += 1) {
    const boardYIndex = y + HIDDEN_ROWS;
    for (let x = 0; x < GRID_W; x += 1) {
      const cell = state.board[boardYIndex][x];
      if (cell) {
        drawBlockSized(ctx, boardX + x * blockSize, boardY + y * blockSize, blockSize, palette[cell]);
      }
    }
  }

  if (!state.gameOver && ghostEnabled) {
    drawGhostPiece(ctx, state, boardX, boardY, blockSize, palette[state.piece.shape], COLORS.Text);
  }

  for (const [x, y] of pieceCells(state.piece)) {
    if (y >= HIDDEN_ROWS && y < GRID_H_TOTAL) {
      drawBlockSized(
        ctx,
        boardX + x * blockSize,
        boardY + (y - HIDDEN_ROWS) * blockSize,
        blockSize,
        palette[state.piece.shape],
      );
    }
  }

  const scoreFontSize = Math.max(10, Math.floor(blockSize * 0.55));
  ctx.fillStyle = COLORS.Text;
  const lineGap = Math.floor(scoreFontSize * 0.6);
  const linesLabelY = sideY + scoreFontSize + 1;
  const linesValueY = linesLabelY + scoreFontSize + 2;
  const scoreLabelY = linesValueY + lineGap + scoreFontSize;
  const scoreValueY = scoreLabelY + scoreFontSize + 2;
  ctx.font = `bold ${scoreFontSize}px sans-serif`;
  ctx.fillText("Lines Cleared:", sideX, linesLabelY);
  ctx.fillText("Score:", sideX, scoreLabelY);
  ctx.font = `${scoreFontSize}px sans-serif`;
  ctx.fillText(`${state.lines}`, sideX, linesValueY);
  ctx.fillText(`${state.score}`, sideX, scoreValueY);
  const nextLabelY = scoreValueY + scoreFontSize + lineGap * 2;
  ctx.font = `bold ${scoreFontSize}px sans-serif`;
  ctx.fillText("Next Piece:", sideX, nextLabelY);

  const preview = SHAPES[state.nextShape][0];
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
  const offX = Math.floor((PREVIEW_GRID - shapeW) / 2) - minX;
  const offY = Math.floor((PREVIEW_GRID - shapeH) / 2) - minY;
  for (const [px, py] of preview) {
    const gx = px + offX;
    const gy = py + offY;
    if (gx >= 0 && gx < PREVIEW_GRID && gy >= 0 && gy < PREVIEW_GRID) {
      drawBlockSized(
        ctx,
        sideX + gx * blockSize,
        nextLabelY + 10 + gy * blockSize,
        blockSize,
        palette[state.nextShape],
      );
    }
  }

  const previewY = nextLabelY + 10;
  ctx.strokeStyle = "rgba(150,150,150,0.8)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sideX + 0.5, previewY + 0.5, PREVIEW_GRID * blockSize - 1, PREVIEW_GRID * blockSize - 1);

  const bindings = getControlBindings(node);
  const infoLines = [
    "Controls:",
    `Move Left - ${formatKeyLabel(bindings.moveLeft)}`,
    `Move Right - ${formatKeyLabel(bindings.moveRight)}`,
    `Rotate CW - ${formatKeyLabel(bindings.rotateCw)}`,
    `Rotate CCW - ${formatKeyLabel(bindings.rotateCcw)}`,
    `Soft Drop - ${formatKeyLabel(bindings.softDrop)}`,
    `Hard Drop - ${formatKeyLabel(bindings.hardDrop)}`,
    `Reset - ${bindings.reset.toUpperCase()}`,
    `Pause - ${bindings.pause.toUpperCase()}`,
  ];
  const fontSize = Math.max(9, Math.floor(blockSize * 0.52));
  const lineHeight = fontSize + 3;
  const infoBlockHeight = infoLines.length * lineHeight;
  const minInfoY = previewY + PREVIEW_GRID * blockSize + PADDING * 1.4;
  const maxInfoY = boardY + boardH - infoBlockHeight;
  const infoY = maxInfoY < minInfoY ? maxInfoY : Math.max(minInfoY, maxInfoY);
  const baseInfoY = infoY;
  ctx.fillStyle = COLORS.Text;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(infoLines[0], sideX, baseInfoY);
  ctx.font = `${fontSize}px sans-serif`;
  for (let i = 1; i < infoLines.length; i += 1) {
    ctx.fillText(infoLines[i], sideX, baseInfoY + i * lineHeight);
  }

  if (state.gameOver) {
    ctx.fillStyle = COLORS.Overlay;
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.fillStyle = COLORS.Text;
    const statusFont = Math.max(12, Math.floor(blockSize * 0.8));
    ctx.font = `${statusFont}px sans-serif`;
    ctx.fillText("Game Over", boardX + 28, boardY + boardH / 2);
  } else if (!state.running) {
    ctx.fillStyle = COLORS.Overlay;
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.fillStyle = COLORS.Text;
    const statusFont = Math.max(12, Math.floor(blockSize * 0.8));
    const subFont = Math.max(10, Math.floor(blockSize * 0.55));
    const label = state.started ? "Paused" : "Start a new game";
    const sublabel = state.started ? "Press P to resume" : "Press Reset or P";
    ctx.font = `${statusFont}px sans-serif`;
    ctx.fillText(label, boardX + 28, boardY + boardH / 2 - Math.floor(subFont));
    ctx.font = `${subFont}px sans-serif`;
    ctx.fillText(sublabel, boardX + 28, boardY + boardH / 2 + subFont);
  }
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

function syncSeed(state, node) {
  const nextSeed = getSeedValue(node, { allowRandomize: false });
  if (Number.isInteger(nextSeed)) {
    if (nextSeed !== state.seed) {
      if (state.started) {
        return;
      }
      stopTimer(node);
      const nextState = createState(nextSeed);
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

function resetNode(node) {
  const live = node.__tetrisLive;
  if (!live) return;
  const seed = getSeedValue(node, { allowRandomize: true });
  live.state = createState(seed ?? live.state.seed);
  live.state.started = true;
  live.state.running = true;
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
  updateBackendState(node);
  node.setDirtyCanvas(true, true);
}

function ensureTimer(node) {
  const live = node.__tetrisLive;
  if (!live || live.state.timer) return;
  live.state.timer = setInterval(() => {
    if (!live.state.running || live.state.gameOver) return;
    live.state.elapsed += 50;
    if (live.state.locking) {
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

function handleKey(event) {
  if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
  const node = getSelectedLiveNode(false);
  if (!node) return;
  const live = node.__tetrisLive;
  if (!live || live.state.gameOver) return;

  const state = live.state;
  const bindings = getControlBindings(node);
  const key = event.key.toLowerCase();
  const canAct = state.running || key === bindings.pause || key === bindings.reset;
  if (!canAct) return;
  let handled = true;
  switch (key) {
    case bindings.moveLeft:
      move(state, -1, 0);
      break;
    case bindings.moveRight:
      move(state, 1, 0);
      break;
    case bindings.rotateCw:
      rotate(state, 1);
      break;
    case bindings.rotateCcw:
      rotate(state, -1);
      break;
    case bindings.softDrop:
      state.softDrop = true;
      state.dropMs = Math.max(1, Math.floor(state.baseDropMs / 20));
      break;
    case bindings.hardDrop:
      hardDrop(state);
      break;
    case bindings.reset:
      resetNode(node);
      break;
    case bindings.pause:
      togglePause(node);
      break;
    default:
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
  const bindings = getControlBindings(node);
  const key = event.key.toLowerCase();
  if (key !== bindings.softDrop) return;
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

function ensureOptionsDivider(node) {
  if (!node?.widgets) return;
  if (node.__tetrisDividerAdded) return;
  const pauseIndex = node.widgets.findIndex((w) => w.name === "pause");
  if (pauseIndex < 0) return;
  const divider = {
    type: "tetrinode_divider",
    name: "divider",
    draw(ctx, _, width, y, height) {
      ctx.strokeStyle = "rgba(235,235,235,0.25)";
      ctx.beginPath();
      const lineY = y + 4;
      ctx.moveTo(10, lineY);
      ctx.lineTo(width - 10, lineY);
      ctx.stroke();
    },
    computeSize(width) {
      return [width, 12];
    },
  };
  node.widgets.splice(pauseIndex + 1, 0, divider);
  node.__tetrisDividerAdded = true;
  node.setDirtyCanvas(true, true);
}

function ensureGhostDivider(node) {
  if (!node?.widgets) return;
  if (node.__tetrisGhostDividerAdded) return;
  const bgIndex = node.widgets.findIndex((w) => w.name === "background_color");
  if (bgIndex < 0) return;
  const divider = {
    type: "tetrinode_divider",
    name: "divider_ghost",
    draw(ctx, _, width, y, height) {
      ctx.strokeStyle = "rgba(235,235,235,0.25)";
      ctx.beginPath();
      const lineY = y + 4;
      ctx.moveTo(10, lineY);
      ctx.lineTo(width - 10, lineY);
      ctx.stroke();
    },
    computeSize(width) {
      return [width, 12];
    },
  };
  node.widgets.splice(bgIndex + 1, 0, divider);
  node.__tetrisGhostDividerAdded = true;
  node.setDirtyCanvas(true, true);
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

function getControlBindings(node) {
  const defaultBindings = {
    moveLeft: "a",
    moveRight: "d",
    rotateCw: "w",
    rotateCcw: "q",
    softDrop: "s",
    hardDrop: " ",
    reset: "r",
    pause: "p",
  };
  if (!node) return defaultBindings;
  const normalizeKey = (value) => {
    const raw = `${value}`.trim().toLowerCase();
    if (!raw) return raw;
    if (raw === "space" || raw === "spacebar") return " ";
    return raw;
  };
  const linked = getLinkedOptionsNode(node);
  const lookup = (name, fallback) => {
    if (linked?.widgets) {
      const widget = linked.widgets.find((w) => w.name === name);
      if (widget && typeof widget.value === "string") {
        const trimmed = widget.value.trim();
        if (trimmed) return normalizeKey(trimmed);
      }
    }
    if (node.widgets) {
      const widget = node.widgets.find((w) => w.name === name);
      if (widget && typeof widget.value === "string") {
        const trimmed = widget.value.trim();
        if (trimmed) return normalizeKey(trimmed);
      }
    }
    return normalizeKey(fallback);
  };
  return {
    moveLeft: lookup("move_left", defaultBindings.moveLeft),
    moveRight: lookup("move_right", defaultBindings.moveRight),
    rotateCw: lookup("rotate_cw", defaultBindings.rotateCw),
    rotateCcw: lookup("rotate_ccw", defaultBindings.rotateCcw),
    softDrop: lookup("soft_drop", defaultBindings.softDrop),
    hardDrop: lookup("hard_drop", defaultBindings.hardDrop),
    reset: lookup("reset", defaultBindings.reset),
    pause: lookup("pause", defaultBindings.pause),
  };
}

function formatKeyLabel(value) {
  if (value === " ") return "SPACE";
  return value.toUpperCase();
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

function coerceStringValue(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "object" && "value" in value) {
    const inner = value.value;
    if (typeof inner === "string") return inner;
    if (typeof inner === "number" && Number.isFinite(inner)) return String(inner);
  }
  return null;
}

function getLinkedStringValue(node, name) {
  const resolved = getInputLink(node, name);
  if (!resolved) return null;
  const { link, origin } = resolved;
  const output = origin.outputs?.[link.origin_slot];
  if (output && output.value !== undefined) {
    return coerceStringValue(output.value);
  }
  const outputName = output?.name;
  if (outputName && origin.widgets) {
    const widgetIndex = origin.widgets.findIndex((w) => w.name === outputName);
    if (widgetIndex >= 0) {
      const widgetValue = origin.widgets[widgetIndex]?.value;
      const coerced = coerceStringValue(widgetValue);
      if (coerced) return coerced;
      if (origin.widgets_values && origin.widgets_values.length > widgetIndex) {
        const stored = coerceStringValue(origin.widgets_values[widgetIndex]);
        if (stored) return stored;
      }
    }
  }
  if (origin.widgets_values && origin.widgets_values.length) {
    const coerced = coerceStringValue(origin.widgets_values[0]);
    if (coerced) return coerced;
  }
  if (origin.widgets && origin.widgets.length) {
    const coerced = coerceStringValue(origin.widgets[0]?.value);
    if (coerced) return coerced;
  }
  return null;
}

function getColorPalette(node) {
  const palette = { ...COLORS };
  const linked = getLinkedOptionsNode(node);
  if (!linked?.widgets) return palette;
  const lookup = (name) => {
    const linkedValue = getLinkedStringValue(linked, name);
    const coercedInput = coerceStringValue(linkedValue);
    if (coercedInput) {
      const parsed = parseHexColor(coercedInput);
      if (parsed) return parsed;
    }
    const widget = linked.widgets.find((w) => w.name === name);
    const widgetValue = coerceStringValue(widget?.value);
    return parseHexColor(widgetValue);
  };
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
    const parsed = lookup(key);
    if (parsed) palette[shape] = parsed;
  }
  return palette;
}

function isGhostEnabled(node) {
  const linked = getLinkedOptionsNode(node);
  const lookup = (source) => {
    if (!source?.widgets) return null;
    const widget = source.widgets.find((w) => w.name === "ghost_piece");
    if (widget && typeof widget.value === "boolean") {
      return widget.value;
    }
    if (widget && typeof widget.value === "string") {
      const trimmed = widget.value.trim().toLowerCase();
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
    }
    return null;
  };
  const linkedValue = lookup(linked);
  if (linkedValue != null) return linkedValue;
  const localValue = lookup(node);
  if (localValue != null) return localValue;
  return true;
}

function getLinkedOptionsNode(node) {
  if (!node?.inputs) return null;
  const input = node.inputs.find((inp) => inp?.name === "tetrinode_options");
  if (!input || input.link == null) return null;
  const link = node.graph?.links?.[input.link];
  if (!link) return null;
  const origin = node.graph?._nodes_by_id?.[link.origin_id];
  if (!origin) return null;
  return origin.comfyClass === "TetriNodeOptions" ? origin : null;
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
    if (node?.comfyClass === "TetriNodeOptions") {
      ensureOptionsDivider(node);
      ensureGhostDivider(node);
      return;
    }
    if (node?.comfyClass !== NODE_CLASS) return;
    applyWidgetHiding(node);
    ensureSeedControlWidget(node);
    const seed = getSeedValue(node, { allowRandomize: true });
    node.__tetrisLive = { state: createState(seed ?? 0) };

    const boardW = GRID_W * BLOCK;
    const boardH = GRID_H_VISIBLE * BLOCK;
    const sideW = PREVIEW_GRID * BLOCK + PADDING * 2;
    const widgetArea = 60;
    node.size = [
      boardW + sideW + PADDING * 2,
      boardH + HEADER_H + PADDING + widgetArea,
    ];

    node.addWidget("button", "Reset", "Reset", () => resetNode(node));
    node.addWidget("button", "Pause/Play", "Pause", () => togglePause(node));

    const originalDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      const result = originalDraw?.apply(this, arguments);
      drawNode(node, ctx);
      return result;
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
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
  },
  async setup() {
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("keyup", handleKeyUp, true);
  },
});
