export function createStatusOverlayHelpers(deps) {
  const { formatKeyLabel, colors, getThemeColors } = deps;

  function formatPauseHint(bindings) {
    const pauseLabel = formatKeyLabel(bindings.pause?.[0]) || "Pause";
    const pauseAlt = formatKeyLabel(bindings.pause?.[1]);
    return pauseAlt ? `${pauseLabel} (or ${pauseAlt})` : pauseLabel;
  }

  function drawPauseOverlay(ctx, node, boardX, boardY, boardW, boardH, blockSize, bindings, opts) {
    const { label, sublabel, centerOffsetY } = opts;
    ctx.fillStyle = colors.Overlay;
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

  function formatThemeName(theme) {
    if (!theme) return "";
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  }

  function formatThemeKeyLabel(key) {
    if (!key) return "";
    const renamed = key.replace("bg", "background");
    return renamed
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
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

  return {
    formatPauseHint,
    drawPauseOverlay,
    formatThemeName,
    formatThemeKeyLabel,
    drawStatusMessage,
  };
}
