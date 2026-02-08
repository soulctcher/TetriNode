export function createToolbarIconHelpers(iconDefs) {
  const {
    load,
    reset,
    pause,
    play,
    settings,
  } = iconDefs;

  const getLoadPath = createPathGetter(load.path);
  const getResetPath = createPathGetter(reset.path);
  const getPausePath = createPathGetter(pause.path);
  const getPlayPath = createPathGetter(play.path);
  const getSettingsPath = createPathGetter(settings.path);

  function drawLoadIcon(ctx, x, y, size, color) {
    const path = getLoadPath();
    if (!path) return false;
    ctx.save();
    ctx.translate(x, y);
    const scale = size / load.viewbox;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawSaveIcon(ctx, x, y, size, color) {
    const path = getLoadPath();
    if (!path) return false;
    ctx.save();
    const scale = size / load.viewbox;
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(scale, scale);
    ctx.rotate(Math.PI);
    ctx.translate(-load.viewbox / 2, -load.viewbox / 2);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawResetIcon(ctx, x, y, size, color) {
    const path = getResetPath();
    if (!path) return false;
    ctx.save();
    ctx.translate(x, y);
    const scale = size / reset.viewbox;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawPauseIcon(ctx, x, y, size, color) {
    const path = getPausePath();
    if (!path) return false;
    ctx.save();
    ctx.translate(x, y);
    const scale = size / pause.viewbox;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawPlayIcon(ctx, x, y, size, color) {
    const path = getPlayPath();
    if (!path) return false;
    ctx.save();
    ctx.translate(x, y);
    const scale = size / play.viewbox;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawSettingsIcon(ctx, x, y, size, color) {
    const path = getSettingsPath();
    if (!path) return false;
    ctx.save();
    ctx.translate(x, y);
    const scale = size / settings.viewbox;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
    return true;
  }

  function drawSpeakerIcon(ctx, x, y, size, color, muted) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.12);
    const bodyW = size * 0.35;
    const bodyH = size * 0.5;
    const bodyX = x + size * 0.1;
    const bodyY = y + (size - bodyH) / 2;
    ctx.beginPath();
    ctx.rect(bodyX, bodyY, bodyW, bodyH);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW, bodyY);
    ctx.lineTo(x + size * 0.9, y + size * 0.15);
    ctx.lineTo(x + size * 0.9, y + size * 0.85);
    ctx.lineTo(bodyX + bodyW, bodyY + bodyH);
    ctx.closePath();
    ctx.fill();
    if (muted) {
      ctx.beginPath();
      ctx.moveTo(x + size * 0.15, y + size * 0.15);
      ctx.lineTo(x + size * 0.85, y + size * 0.85);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x + size * 0.78, y + size * 0.5, size * 0.18, -0.6, 0.6);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  return {
    drawLoadIcon,
    drawSaveIcon,
    drawResetIcon,
    drawPauseIcon,
    drawPlayIcon,
    drawSettingsIcon,
    drawSpeakerIcon,
  };
}

function createPathGetter(pathData) {
  let cache = undefined;
  return () => {
    if (cache !== undefined) return cache;
    if (!window.Path2D) {
      cache = null;
      return cache;
    }
    try {
      cache = new Path2D(pathData);
    } catch {
      cache = null;
    }
    return cache;
  };
}
