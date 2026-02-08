export function createRenderEffects(deps) {
  const {
    collides,
    pieceCells,
    colorWithAlpha,
    adjustColorByFactor,
    hiddenRows,
    gridHeightTotal,
    gridWidth,
  } = deps;

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
      if (y >= hiddenRows - 1 && y < gridHeightTotal) {
        ctx.fillStyle = color;
        ctx.fillRect(
          boardX + x * blockSize,
          boardY + (y - hiddenRows) * blockSize,
          blockSize - 1,
          blockSize - 1,
        );
      }
    }
    ctx.globalAlpha = 0.67;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1;
    for (const [x, y] of cells) {
      if (y >= hiddenRows - 1 && y < gridHeightTotal) {
        ctx.strokeRect(
          boardX + x * blockSize + 0.5,
          boardY + (y - hiddenRows) * blockSize + 0.5,
          blockSize - 2,
          blockSize - 2,
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTetrisGlow(ctx, boardX, boardY, blockSize, rows, elapsed, duration) {
    if (!rows || rows.length !== 4) return;
    if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0) return;
    const progress = Math.min(1, Math.max(0, elapsed / duration));
    const baseAlpha = 0.95 * (1 - progress);
    if (baseAlpha <= 0.01) return;
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    if (!Number.isFinite(minRow) || !Number.isFinite(maxRow)) return;
    ctx.save();
    if (maxRow >= hiddenRows) {
      const flicker = 0.7 + 0.3 * Math.sin(elapsed / 32);
      const alpha = Math.max(0, baseAlpha * flicker);
      const jitter = Math.sin(elapsed / 18) * 0.6;
      const y = boardY + (Math.max(minRow, hiddenRows) - hiddenRows) * blockSize;
      const h = (maxRow - Math.max(minRow, hiddenRows) + 1) * blockSize;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(255, 210, 72, 1)";
      ctx.lineWidth = 6;
      ctx.shadowBlur = 26 + Math.abs(jitter) * 4;
      ctx.shadowColor = "rgba(255, 210, 72, 0.98)";
      ctx.strokeRect(boardX + 1 + jitter, y + 1, gridWidth * blockSize - 2, h - 2);
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = "rgba(255, 235, 150, 1)";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "rgba(255, 235, 150, 0.9)";
      ctx.strokeRect(boardX + 4 - jitter, y + 4, gridWidth * blockSize - 8, h - 8);
    }
    ctx.restore();
  }

  function drawHardDropTrail(ctx, state, boardX, boardY, blockSize, palette) {
    const trail = state.hardDropTrail;
    if (!trail) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const progress = trail.duration > 0 ? (now - trail.start) / trail.duration : 1;
    if (progress >= 1) return;
    const alpha = Math.max(0, 0.28 * (1 - progress));
    if (alpha <= 0.01) return;
    const baseColor = palette[trail.shape] || palette.T;
    ctx.save();
    ctx.globalAlpha = 1;
    const span = Math.max(1, trail.endY - trail.startY);
    for (let y = trail.startY; y <= trail.endY; y += 1) {
      const piece = { shape: trail.shape, rot: trail.rot, x: trail.x, y };
      const cells = pieceCells(piece);
      const rowFade = Math.max(0, (y - trail.startY) / span);
      for (const [cx, cy] of cells) {
        if (cy >= hiddenRows - 1 && cy < gridHeightTotal) {
          ctx.fillStyle = colorWithAlpha(baseColor, alpha * rowFade);
          ctx.fillRect(
            boardX + cx * blockSize,
            boardY + (cy - hiddenRows) * blockSize,
            blockSize - 1,
            blockSize - 1,
          );
        }
      }
    }
    ctx.restore();
  }

  function drawActionToast(ctx, state, layout, theme, palette) {
    const toast = state.actionToast;
    if (!toast) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const duration = toast.duration ?? 1200;
    const elapsed = Math.min(duration, Math.max(0, now - toast.start));
    if (now >= toast.until) return;
    const progress = duration > 0 ? (elapsed / duration) : 1;
    const alpha = Math.max(0, 1 - progress);
    const { boardX, boardY, boardW, boardH, blockSize } = layout;
    const baseSize = Math.max(12, Math.round(blockSize * 0.55));
    const fontSize = Math.round(baseSize * (toast.scale || 1));
    ctx.save();
    ctx.font = `700 ${fontSize}px sans-serif`;
    const text = toast.text;
    const textWidth = ctx.measureText(text).width;
    const pad = 6;
    const anchorX = toast.anchorX ?? 4.5;
    const anchorY = toast.anchorY ?? hiddenRows + 2;
    let x = boardX + anchorX * blockSize - textWidth / 2;
    let y = boardY + (anchorY - hiddenRows) * blockSize - (progress * blockSize * 0.6);
    x = Math.max(boardX + pad, Math.min(boardX + boardW - textWidth - pad, x));
    y = Math.max(boardY + pad, Math.min(boardY + boardH - fontSize - pad, y));
    const colorKey = toast.colorKey || state.lastLockedPiece?.shape || "T";
    const baseColor = palette?.[colorKey] || theme?.text || "rgba(255,255,255,0.95)";
    const outlineColor = adjustColorByFactor(baseColor, -0.5);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.15));
    ctx.strokeStyle = outlineColor;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = baseColor;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  return {
    ghostLandingY,
    drawGhostPiece,
    drawTetrisGlow,
    drawHardDropTrail,
    drawActionToast,
  };
}
