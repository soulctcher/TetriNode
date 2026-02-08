export function createNodeCanvasHelpers(deps) {
  const {
    applyWidgetHiding,
    syncStartLevel,
    syncSeed,
    getLayout,
    getThemeColors,
    getColorPalette,
    isGhostEnabled,
    getShowControls,
    getGridEnabled,
    getGridColor,
    getConfig,
    getBackgroundSource,
    drawBoardBackground,
    drawBoardGrid,
    applyBorderGlow,
    clearBorderGlow,
    ensureBoardCache,
    drawHardDropTrail,
    drawGhostPiece,
    colors,
    colorWithAlpha,
    drawActionToast,
    padding,
    previewGrid,
    previewScale,
    getControlBindings,
    formatKeyLabel,
    formatTimeMs,
    getQueueSize,
    getUpcomingShapes,
    shapes,
    getPreviewTextureTransforms,
    drawBlockSized,
    drawPanelBox,
    hiddenRows,
    gridHeightTotal,
    gridWidth,
    drawPauseOverlay,
    formatPauseHint,
    drawStatusMessage,
    drawToolbar,
    ensurePieceTextureTransforms,
    pieceCells,
  } = deps;

  function ensureWidgetDrawCapture(node) {
    if (!node?.widgets?.length) return;
    const width = node.size?.[0] || 0;
    const fallbackHeight = Number.isFinite(LiteGraph?.NODE_WIDGET_HEIGHT)
      ? LiteGraph.NODE_WIDGET_HEIGHT
      : 20;
    node.widgets.forEach((widget) => {
      if (!widget || widget.__tnDrawWrapped !== undefined) return;
      if (typeof widget.draw !== "function") {
        widget.__tnDrawWrapped = false;
        return;
      }
      const original = widget.draw;
      widget.__tnDrawWrapped = true;
      widget.__tnDrawOriginal = original;
      widget.draw = function () {
        const result = original.apply(this, arguments);
        const y = arguments[3];
        const heightArg = arguments[4];
        const size = typeof widget.computeSize === "function" ? widget.computeSize(width) : widget.size;
        const computed = Array.isArray(size) ? size[1] : widget.height;
        const rowHeight = Number.isFinite(heightArg)
          ? heightArg
          : Number.isFinite(computed)
            ? computed
            : fallbackHeight;
        if (Number.isFinite(y)) {
          const bottom = y + rowHeight;
          const current = node.__tetrisWidgetBottom;
          node.__tetrisWidgetBottom =
            current == null ? bottom : Math.max(current, bottom);
        }
        return result;
      };
    });
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
      sideY,
      blockSize,
      extraPx,
      showHold,
      showNext,
    } = getLayout(node);
    const theme = getThemeColors(node);
    const palette = getColorPalette(node);
    const ghostEnabled = isGhostEnabled(node);
    const showControls = getShowControls(node);
    const gridEnabled = getGridEnabled(node);
    const gridColor = getGridColor(node);
    const animConfig = getConfig(node);
  
    const bgSource = getBackgroundSource(node);
    drawBoardBackground(ctx, bgSource, boardX, boardY, boardW, boardH, palette.X);
    if (gridEnabled && gridColor) {
      drawBoardGrid(ctx, boardX, boardY, boardW, boardH, blockSize, gridColor, extraPx);
    }
    ctx.strokeStyle = theme.panel_border;
    ctx.lineWidth = 1;
    applyBorderGlow(ctx, node);
    ctx.strokeRect(boardX - 0.5, boardY - 0.5, boardW + 1, boardH + 1);
    clearBorderGlow(ctx);
  
    const hideBoard = !state.gameOver && state.started && !state.running && !state.showBoardWhilePaused;
    const showPreviews = state.started && state.running && !hideBoard;
    const showBoardContents = (showPreviews || state.gameOver) && !hideBoard;
    if (!hideBoard) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(boardX, boardY, boardW, boardH);
      ctx.clip();
      if (showBoardContents) {
        const cache = ensureBoardCache(node, state, { boardW, boardH, blockSize, extraPx }, palette);
        if (cache) {
          ctx.drawImage(cache, boardX, boardY);
        }
      }
  
    if (showBoardContents && !state.clearing && animConfig.anim_hard_drop_trail !== false) {
      drawHardDropTrail(ctx, state, boardX, boardY + extraPx, blockSize, palette);
    }
    if (!state.gameOver && ghostEnabled && showPreviews && !state.clearing) {
      drawGhostPiece(ctx, state, boardX, boardY + extraPx, blockSize, palette[state.piece.shape], colors.Text);
    }
  
    if (showBoardContents && !state.clearing) {
      const pieceTransforms = ensurePieceTextureTransforms(state.piece);
      pieceCells(state.piece).forEach(([x, y], index) => {
        if (y >= hiddenRows - 1 && y < gridHeightTotal) {
            drawBlockSized(
              ctx,
              boardX + x * blockSize,
              boardY + (y - hiddenRows) * blockSize + extraPx,
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
            const y = boardY + (row - hiddenRows) * blockSize + extraPx;
            for (let x = 0; x < gridWidth; x += 1) {
              const cell = state.board[row]?.[x];
              if (!cell) continue;
              const dist = Math.abs((x + 0.5) - clearCenter);
              if (wipeProgress >= (dist / clearMaxDist)) {
                const color = palette[cell];
                ctx.fillStyle = colorWithAlpha(color, ghostAlpha);
                ctx.fillRect(boardX + x * blockSize, y, blockSize, blockSize);
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
          const y = boardY + (row - hiddenRows) * blockSize + extraPx;
          ctx.fillRect(boardX, y, boardW, blockSize);
        });
        ctx.restore();
      }
    }
      ctx.restore();
    }
  
    if (animConfig.anim_score_toasts !== false) {
      drawActionToast(
        ctx,
        state,
        { boardX, boardY, boardW, boardH, blockSize },
        theme,
        palette,
      );
    }
  
    const previewBox = Math.max(4, Math.floor(previewGrid * blockSize * previewScale));
    const columnShift = Math.max(4, Math.floor(blockSize * 0.2));
    const leftBoxX = padding;
    const leftBoxW = Math.max(0, boardX - padding * 2);
    const leftX = leftBoxX + columnShift;
    const rightBoxX = boardX + boardW + padding;
    const rightBoxW = Math.max(0, node.size[0] - padding - rightBoxX);
    const maxWidthRight = Math.max(0, node.size[0] - rightBoxX - padding);
    const leftColumnW = leftBoxW;
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
    const leftHudTopY = showHold ? nextBoxY + previewBox + padding * 1.2 : sideY;
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
    const valueX = leftBoxX + leftBoxW - 3;
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
        { label: "Move Left:", value: formatKeyLabel(bindings.moveLeft?.[0]) },
        { label: "Move Right:", value: formatKeyLabel(bindings.moveRight?.[0]) },
        { label: "Rotate CW:", value: formatKeyLabel(bindings.rotateCw?.[0]) },
        { label: "Rotate CCW:", value: formatKeyLabel(bindings.rotateCcw?.[0]) },
        { label: "Soft Drop:", value: formatKeyLabel(bindings.softDrop?.[0]) },
        { label: "Hard Drop:", value: formatKeyLabel(bindings.hardDrop?.[0]) },
        { label: "Hold:", value: formatKeyLabel(bindings.hold?.[0]) },
        { label: "Reset:", value: formatKeyLabel(bindings.reset?.[0]) },
        { label: "Pause:", value: formatKeyLabel(bindings.pause?.[0]) },
        { label: "Settings:", value: formatKeyLabel(bindings.settings?.[0]) },
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
    const controlsPad = tablePad + 3;
    const tableGap = Math.max(6, Math.floor(fontSize * 0.6));
    const tableWForControls = Math.max(0, maxWidthLeft);
    let controlsHeight = 0;
    let leftColWidth = 0;
    let rightColWidth = 0;
    let controlRows = [];
    if (controlEntries.length) {
      ctx.font = `bold ${fontSize}px sans-serif`;
      leftColWidth = Math.max(...controlEntries.map((entry) => ctx.measureText(entry.label).width));
      leftColWidth = Math.min(leftColWidth, Math.max(40, Math.floor(tableWForControls * 0.45)));
      rightColWidth = Math.max(0, tableWForControls - controlsPad * 2 - leftColWidth - tableGap);
      ctx.font = `${fontSize}px sans-serif`;
      const wrapValue = (value) => {
        if (!value) return [""];
        const parts = value.split(", ");
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
    const drawScaledBlock = (targetX, targetY, targetSize, color, transform = null) => {
      const live = node.__tetrisLive;
      if (!live) return;
      if (!live.previewBlockCanvas) {
        live.previewBlockCanvas = document.createElement("canvas");
        live.previewBlockCtx = live.previewBlockCanvas.getContext("2d");
      }
      const sourceCanvas = live.previewBlockCanvas;
      const sourceCtx = live.previewBlockCtx;
      if (sourceCanvas.width !== blockSize || sourceCanvas.height !== blockSize) {
        sourceCanvas.width = blockSize;
        sourceCanvas.height = blockSize;
      }
      sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      drawBlockSized(sourceCtx, 0, 0, blockSize, color, node, transform);
      ctx.drawImage(sourceCanvas, targetX, targetY, targetSize, targetSize);
    };
    const drawPreviewShape = (shape, originX, boxY, cellSize, areaH, boxW, transforms = null) => {
      if (!shape || !shapes[shape]) return;
      const preview = shapes[shape][0];
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
      const areaW = (boxW ?? previewBox) - innerPad * 2;
      const contentH = Math.max(0, areaH - innerPad * 2);
      const offX = Math.round((areaW - shapeW * cellSize) / 2);
      const offY = Math.round((contentH - shapeH * cellSize) / 2);
      preview.forEach(([px, py], index) => {
        const gx = px - minX;
        const gy = py - minY;
        drawScaledBlock(
          originX + innerPad + offX + gx * cellSize,
          boxY + innerPad + offY + gy * cellSize,
          cellSize,
          palette[shape],
          transforms?.[index] ?? null,
        );
      });
    };
  
    const previewContentH = Math.max(4, previewBox);
    const nextCellSize = Math.max(4, Math.floor((previewContentH - innerPad * 2) / previewGrid));
    const showHoldPanel = showHold && !hideBoard;
    const showNextPanel = showNext && !hideBoard;
    if (showHoldPanel) {
      drawPanelBox(ctx, node, leftBoxX, nextBoxY, leftBoxW, previewBox, theme.panel_bg, theme.panel_border);
      if (showPreviews) {
        const holdTransforms = getPreviewTextureTransforms(state, state.holdShape, "hold");
        drawPreviewShape(
          state.holdShape,
          leftBoxX,
          nextBoxY,
          nextCellSize,
          previewContentH,
          leftBoxW,
          holdTransforms,
        );
      }
      ctx.fillStyle = theme.text;
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      ctx.fillText("Hold", leftBoxX + titleInset, holdNextTitleY);
    }
    if (showNextPanel) {
      drawPanelBox(ctx, node, rightBoxX, nextBoxY, rightBoxW, previewBox, theme.panel_bg, theme.panel_border);
      if (showPreviews) {
        const nextTransforms = getPreviewTextureTransforms(state, state.nextShape, "next");
        drawPreviewShape(
          state.nextShape,
          rightBoxX,
          nextBoxY,
          nextCellSize,
          previewContentH,
          rightBoxW,
          nextTransforms,
        );
      }
      ctx.fillStyle = theme.text;
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      ctx.fillText("Next", rightBoxX + titleInset, holdNextTitleY);
    }
  
    const queueCountTarget = showNextPanel ? getQueueSize(node) : 0;
    const showQueue = queueCountTarget > 0;
    const queueBoxY = nextBoxY + previewBox + padding * 1.2;
    const queueBoxW = rightBoxW;
    const queueBoxX = rightBoxX;
    const queueTitleY = queueBoxY + titleFontSize + 4;
    const upcoming = getUpcomingShapes(state, queueCountTarget + 1);
    const queue = upcoming.slice(1, queueCountTarget + 1);
    const queueGapCells = 1;
    const queueContentY = queueBoxY + titleHeight;
    const availableQueueHeight = Math.max(0, boardY + boardH - queueBoxY);
    const queueCount = Math.min(queue.length, queueCountTarget);
    const getShapeBounds = (shape) => {
      const cells = shapes[shape]?.[0] || [];
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
    const maxShapeWidth = shapeWidths.length ? Math.max(...shapeWidths) : previewGrid;
    const availableInnerH = Math.max(0, availableQueueHeight - titleHeight - innerPad * 2);
    const maxCellByHeight = totalCells > 0 ? Math.floor(availableInnerH / totalCells) : 0;
    const maxCellByWidth = Math.floor((queueBoxW - innerPad * 2) / maxShapeWidth);
    let queueCellSize = Math.max(4, Math.min(maxCellByHeight, maxCellByWidth));
    let drawQueueCount = queueCellSize > 0 ? boundsList.length : 0;
    const previewBottom = nextBoxY + previewBox;
    const queuePanelBottom = queueBoxY + availableQueueHeight;
    const queueBottom =
      showQueue && drawQueueCount > 0
        ? queuePanelBottom
        : previewBottom;
    const minInfoY = queueBottom + padding * 1.6 + 22;
    const maxInfoY = boardY + boardH - infoBlockHeight;
    const infoY = maxInfoY < minInfoY ? maxInfoY : Math.max(minInfoY, maxInfoY);
    const baseInfoY = infoY;
    const outlineHeight = showQueue && drawQueueCount > 0
      ? Math.max(0, queueBottom - queueBoxY)
      : 0;
    if (showQueue && drawQueueCount > 0) {
      const availableInnerH2 = Math.max(0, outlineHeight - titleHeight - innerPad * 2);
      const maxCellByHeight2 = totalCells > 0 ? Math.floor(availableInnerH2 / totalCells) : 0;
      queueCellSize = Math.max(4, Math.min(maxCellByHeight2, maxCellByWidth));
      drawQueueCount = queueCellSize > 0 ? boundsList.length : 0;
    }
    if (showQueue && drawQueueCount > 0) {
      drawPanelBox(ctx, node, queueBoxX, queueBoxY, queueBoxW, outlineHeight, theme.panel_bg, theme.panel_border);
      ctx.fillStyle = theme.text;
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      ctx.fillText("Queue", rightBoxX + titleInset, queueTitleY);
    }
    if (node.__tetrisLastLayout) {
      node.__tetrisLastLayout.boardBottom = boardY + boardH;
      node.__tetrisLastLayout.queueTop = showQueue && drawQueueCount > 0 ? queueBoxY : null;
      node.__tetrisLastLayout.queueBottom = showQueue && drawQueueCount > 0 ? queueBottom : null;
    }
    let cursorY = queueContentY + innerPad;
    boundsList.slice(0, drawQueueCount).forEach((bounds, idx) => {
      const shape = queue[idx];
      if (!shape || !shapes[shape]) return;
      if (!showPreviews) return;
      const queueTransforms = getPreviewTextureTransforms(state, shape, `queue-${idx}`);
      const shapeOffsetX = Math.max(
        0,
        Math.floor(
          (queueBoxW - innerPad * 2 - bounds.width * queueCellSize) / 2,
        ),
      );
      shapes[shape][0].forEach(([px, py], index) => {
        const gx = px - bounds.minX;
        const gy = py - bounds.minY;
        drawScaledBlock(
          queueBoxX + innerPad + shapeOffsetX + gx * queueCellSize,
          cursorY + gy * queueCellSize,
          queueCellSize,
          palette[shape],
          queueTransforms[index] ?? null,
        );
      });
      cursorY += bounds.height * queueCellSize;
      if (idx < drawQueueCount - 1) {
        cursorY += queueGapCells * queueCellSize;
      }
    });
  
    if (controlEntries.length) {
      ctx.fillStyle = theme.text;
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      const tableY = baseInfoY;
      const tableX = leftBoxX;
      const tableW = leftBoxW;
      const tableH = Math.max(0, boardY + boardH - tableY);
      drawPanelBox(ctx, node, tableX, tableY, tableW, tableH, theme.panel_bg, theme.panel_border);
      ctx.fillStyle = theme.text;
      ctx.fillText("Controls", tableX + titleInset, tableY + titleFontSize + 4);
      ctx.font = `${fontSize}px sans-serif`;
      let rowY = tableY + titleHeight + tablePad + Math.floor(fontSize * 0.25);
      for (const row of controlRows) {
        const labelX = tableX + controlsPad + leftColWidth;
        ctx.textAlign = "right";
        ctx.fillText(row.label, labelX, rowY);
        ctx.textAlign = "left";
        const valueX = tableX + controlsPad + leftColWidth + tableGap;
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

  return { ensureWidgetDrawCapture, drawNode };
}
