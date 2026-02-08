export function createBackendStateHelpers(deps) {
  const {
    getLayout,
    getColorPalette,
    getConfig,
    getGridEnabled,
    getGridColor,
    isGhostEnabled,
    getThemeColors,
    getOptionsForState,
    getBackgroundSource,
    drawBoardBackground,
    drawBoardGrid,
    drawHardDropTrail,
    drawGhostPiece,
    drawTetrisGlow,
    drawActionToast,
    ensurePieceTextureTransforms,
    pieceCells,
    serializeState,
    drawBlockSized,
    getBlockStyle,
    adjustColorByFactor,
    colorWithAlpha,
    colors,
    hiddenRows,
    gridWidth,
    gridHeightVisible,
    gridHeightTotal,
  } = deps;

  function ensureBoardCache(node, state, layout, palette) {
    const live = node.__tetrisLive;
    if (!live || !state) return null;
    const { boardW, boardH, blockSize, extraPx } = layout;
    if (!live.boardCanvas) {
      live.boardCanvas = document.createElement("canvas");
      live.boardCtx = live.boardCanvas.getContext("2d");
      live.boardDirty = true;
    }
    const canvas = live.boardCanvas;
    const ctx = live.boardCtx;
    const style = getBlockStyle(node);
    const animConfig = getConfig(node);
    const clearPhase = state.clearing && state.lineClear
      ? {
        elapsed: state.lineClear.elapsed,
        duration: state.lineClear.duration,
        flashMs: state.lineClear.flashMs ?? 0,
        wipeMs: state.lineClear.wipeMs ?? 0,
      }
      : null;
    const cacheKey = JSON.stringify({
      boardW,
      boardH,
      blockSize,
      extraPx,
      palette,
      style,
      clearPhase,
    });
    if (canvas.width !== boardW || canvas.height !== boardH) {
      canvas.width = boardW;
      canvas.height = boardH;
      live.boardDirty = true;
    }
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const flashActive = state.lockFlash && now < state.lockFlash.until;
    const lockFlash = state.lockFlash;
    const lockProgress = lockFlash && lockFlash.duration
      ? Math.min(1, Math.max(0, (lockFlash.elapsed ?? 0) / lockFlash.duration))
      : 0;
    const dirty = live.boardDirty || state.boardDirty || flashActive;
    if (!dirty && live.boardCacheKey === cacheKey) {
      return canvas;
    }
    live.boardCacheKey = cacheKey;
    live.boardDirty = false;
    state.boardDirty = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (hiddenRows > 0) {
      const hiddenRow = hiddenRows - 1;
      for (let x = 0; x < gridWidth; x += 1) {
        const cell = state.board[hiddenRow][x];
        if (cell) {
          const textureTransform = state.boardTextures?.[hiddenRow]?.[x] ?? null;
          const flashKey = `${x},${hiddenRow}`;
          const flashColor = flashActive && state.lockFlash?.cells?.has(flashKey)
            ? adjustColorByFactor(palette[cell], 0.3)
            : palette[cell];
          drawBlockSized(
            ctx,
            x * blockSize,
            -blockSize + extraPx,
            blockSize,
            flashColor,
            node,
            textureTransform,
          );
        }
      }
    }
    const clearRows = animConfig.anim_line_clear !== false && state.clearing && state.lineClear?.rows?.length
      ? new Set(state.lineClear.rows)
      : null;
    const clearElapsed = state.lineClear?.elapsed ?? 0;
    const clearFlashMs = state.lineClear?.flashMs ?? 0;
    const clearWipeMs = state.lineClear?.wipeMs ?? 0;
    const clearProgress = clearWipeMs > 0
      ? Math.min(1, Math.max(0, (clearElapsed - clearFlashMs) / clearWipeMs))
      : 0;
    const clearCenter = gridWidth / 2;
    const clearMaxDist = clearCenter - 0.5;
    let beamMin = 0;
    let beamMax = gridWidth + gridHeightTotal;
    if (flashActive && lockFlash?.cells?.size) {
      let min = Infinity;
      let max = -Infinity;
      for (const key of lockFlash.cells) {
        const [sx, sy] = key.split(",").map(Number);
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
        const diag = sx + sy;
        min = Math.min(min, diag);
        max = Math.max(max, diag);
      }
      if (Number.isFinite(min) && Number.isFinite(max)) {
        beamMin = min;
        beamMax = max;
      }
    }
    const span = Math.max(1, beamMax - beamMin);
    const beamCenter = beamMin + span * lockProgress;
    const beamWidth = 0.65;

    if (clearRows && state.lineClear && getConfig(node).anim_line_clear !== false) {
      drawTetrisGlow(ctx, 0, extraPx, blockSize, state.lineClear.rows, clearElapsed, state.lineClear.duration);
    }

    for (let y = 0; y < gridHeightVisible; y += 1) {
      const boardYIndex = y + hiddenRows;
      for (let x = 0; x < gridWidth; x += 1) {
        const cell = state.board[boardYIndex][x];
        if (cell) {
          if (clearRows && clearRows.has(boardYIndex)) {
            const dist = Math.abs((x + 0.5) - clearCenter);
            if (clearProgress >= (dist / clearMaxDist)) {
              continue;
            }
          }
          const textureTransform = state.boardTextures?.[boardYIndex]?.[x] ?? null;
          const flashColor = palette[cell];
          drawBlockSized(
            ctx,
            x * blockSize,
            y * blockSize + extraPx,
            blockSize,
            flashColor,
            node,
            textureTransform,
          );
        }
      }
    }
    if (flashActive && lockFlash?.cells?.size) {
      for (const key of lockFlash.cells) {
        const [sx, sy] = key.split(",").map(Number);
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
        if (sy < hiddenRows || sy >= hiddenRows + gridHeightVisible) continue;
        const drawX = sx * blockSize;
        const drawY = (sy - hiddenRows) * blockSize + extraPx;
        const diag = sx + sy;
        const distance = Math.abs(diag - beamCenter);
        if (distance > beamWidth) continue;
        const t = 1 - (distance / beamWidth);
        const alpha = Math.min(1, t * t);
        ctx.save();
        ctx.beginPath();
        ctx.rect(drawX, drawY, blockSize, blockSize);
        ctx.clip();
        const grad = ctx.createLinearGradient(drawX, drawY, drawX + blockSize, drawY + blockSize);
        grad.addColorStop(0, `rgba(255,255,255,${0.05 * alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${0.9 * alpha})`);
        grad.addColorStop(1, `rgba(255,255,255,${0.05 * alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(drawX, drawY, blockSize, blockSize);
        ctx.restore();
      }
    }
    return canvas;
  }

  function captureMatrixImage(node) {
    const live = node.__tetrisLive;
    if (!live) return null;
    const { state } = live;
    if (!state) return null;
    const {
      boardW,
      boardH,
      blockSize,
      extraPx,
    } = getLayout(node);
    if (!live.captureCanvas) {
      live.captureCanvas = document.createElement("canvas");
      live.captureCtx = live.captureCanvas.getContext("2d");
    }
    const canvas = live.captureCanvas;
    const ctx = live.captureCtx;
    if (canvas.width !== boardW || canvas.height !== boardH) {
      canvas.width = boardW;
      canvas.height = boardH;
    }
    const palette = getColorPalette(node);
    const animConfig = getConfig(node);
    const gridEnabled = getGridEnabled(node);
    const gridColor = getGridColor(node);
    const bgSource = getBackgroundSource(node);
    const ghostEnabled = isGhostEnabled(node);
    const hideBoard = !state.gameOver && state.started && !state.running && !state.showBoardWhilePaused;
    const showPreviews = state.started && state.running && !hideBoard;
    const showBoardContents = (showPreviews || state.gameOver) && !hideBoard;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoardBackground(ctx, bgSource, 0, 0, boardW, boardH, palette.X);
    if (gridEnabled && gridColor) {
      drawBoardGrid(ctx, 0, 0, boardW, boardH, blockSize, gridColor, extraPx);
    }
    if (hideBoard) {
      return canvas.toDataURL("image/png");
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, boardW, boardH);
    ctx.clip();
    if (showBoardContents) {
      const cache = ensureBoardCache(node, state, { boardW, boardH, blockSize, extraPx }, palette);
      if (cache) {
        ctx.drawImage(cache, 0, 0);
      }
    }
    if (showBoardContents && !state.clearing && animConfig.anim_hard_drop_trail !== false) {
      drawHardDropTrail(ctx, state, 0, extraPx, blockSize, palette);
    }
    if (!state.gameOver && ghostEnabled && showPreviews && !state.clearing) {
      drawGhostPiece(ctx, state, 0, extraPx, blockSize, palette[state.piece.shape], colors.Text);
    }
    if (showBoardContents && !state.clearing) {
      const pieceTransforms = ensurePieceTextureTransforms(state.piece);
      pieceCells(state.piece).forEach(([x, y], index) => {
        if (y >= hiddenRows - 1 && y < gridHeightTotal) {
          drawBlockSized(
            ctx,
            x * blockSize,
            (y - hiddenRows) * blockSize + extraPx,
            blockSize,
            palette[state.piece.shape],
            node,
            pieceTransforms[index] ?? null,
          );
        }
      });
    }
    if (showBoardContents && state.lineClear?.rows?.length && animConfig.anim_line_clear !== false) {
      const flashMs = state.lineClear.flashMs ?? 0;
      const elapsed = state.lineClear.elapsed ?? 0;
      const wipeMs = state.lineClear.wipeMs ?? 0;
      const wipeProgress = wipeMs > 0 ? Math.min(1, Math.max(0, (elapsed - flashMs) / wipeMs)) : 0;
      const clearCenter = gridWidth / 2;
      const clearMaxDist = clearCenter - 0.5;
      if (wipeProgress > 0) {
        const ghostAlpha = 0.5 * (1 - wipeProgress);
        if (ghostAlpha > 0.01) {
          ctx.save();
          state.lineClear.rows.forEach((row) => {
            if (row < hiddenRows) return;
            const y = (row - hiddenRows) * blockSize + extraPx;
            for (let x = 0; x < gridWidth; x += 1) {
              const cell = state.board[row]?.[x];
              if (!cell) continue;
              const dist = Math.abs((x + 0.5) - clearCenter);
              if (wipeProgress >= (dist / clearMaxDist)) {
                const color = palette[cell];
                ctx.fillStyle = colorWithAlpha(color, ghostAlpha);
                ctx.fillRect(x * blockSize, y, blockSize, blockSize);
              }
            }
          });
          ctx.restore();
        }
      }
      if (elapsed < flashMs) {
        const intensity = 0.35 * Math.max(0, 1 - (elapsed / flashMs));
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${intensity})`;
        state.lineClear.rows.forEach((row) => {
          if (row < hiddenRows) return;
          const y = (row - hiddenRows) * blockSize + extraPx;
          ctx.fillRect(0, y, boardW, blockSize);
        });
        ctx.restore();
      }
      drawTetrisGlow(ctx, boardX, boardY + extraPx, blockSize, state.lineClear.rows, elapsed, state.lineClear.duration);
    }
    if (animConfig.anim_score_toasts !== false) {
      drawActionToast(
        ctx,
        state,
        { boardX: 0, boardY: 0, boardW, boardH, blockSize },
        getThemeColors(node),
        palette,
      );
    }
    ctx.restore();
    return canvas.toDataURL("image/png");
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
      const options = getOptionsForState(node);
      const capture = captureMatrixImage(node);
      if (capture) {
        options.matrix_capture = capture;
      }
      node.__tetrisLive.state.options = options;
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

  return {
    ensureBoardCache,
    captureMatrixImage,
    updateBackendState,
  };
}
