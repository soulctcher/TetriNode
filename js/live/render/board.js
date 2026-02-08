import { GRID_H_VISIBLE, GRID_W } from "../constants.js";
import { COLORS } from "../data/colors.js";

export function drawBoardBackground(ctx, source, boardX, boardY, boardW, boardH, fallbackColor) {
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

export function drawBoardGrid(ctx, boardX, boardY, boardW, boardH, blockSize, color, extraPx) {
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
