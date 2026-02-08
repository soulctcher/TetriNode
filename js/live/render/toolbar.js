export function createToolbarRenderer(deps) {
  const {
    ensureUiState,
    getConfig,
    syncMusicFromConfig,
    getThemeColors,
    defaultConfig,
    clampMusicVolume,
    toolbarHeight,
    headerHeight,
    padding,
    getThemeCornerRadius,
    drawLoadIcon,
    drawSaveIcon,
    drawResetIcon,
    drawPauseIcon,
    drawPlayIcon,
    drawSettingsIcon,
    drawSpeakerIcon,
  } = deps;

  function buildToolbarButtons(node, toolbarY, barH) {
    const btnSize = 24;
    const gap = 8;
    const top = toolbarY + (barH - btnSize) / 2;
    const leftStart = padding + 6;
    const rightStart = node.size[0] - padding - 6;
    const leftButtons = [
      { id: "load", label: "L", tooltip: "Load State" },
      { id: "save", label: "S", tooltip: "Save State" },
      { id: "reset", label: "R", tooltip: "Reset" },
      { id: "pause", label: "P", tooltip: "Pause/Play" },
    ];
    const rightButtons = [
      { id: "settings", label: "S", tooltip: "Settings" },
      { id: "music_volume", label: "", tooltip: "Volume", w: 90, h: 10 },
      { id: "music_mute", label: "M", tooltip: "Mute" },
    ];
    const buttons = [];
    let x = leftStart;
    for (const btn of leftButtons) {
      const w = btn.w ?? btnSize;
      const h = btn.h ?? btnSize;
      const y = top + (btnSize - h) / 2;
      buttons.push({ ...btn, x, y, w, h });
      x += w + gap;
    }
    let rightX = rightStart;
    for (const btn of rightButtons) {
      const w = btn.w ?? btnSize;
      const h = btn.h ?? btnSize;
      rightX -= w;
      const y = top + (btnSize - h) / 2;
      buttons.push({ ...btn, x: rightX, y, w, h });
      rightX -= gap;
    }
    return { buttons, height: toolbarHeight, top };
  }

  function drawToolbar(node, ctx, boardY) {
    const ui = ensureUiState(node);
    const config = getConfig(node);
    syncMusicFromConfig(node);
    const theme = getThemeColors(node);
    const themeSettings = config.theme_settings || defaultConfig.theme_settings;
    const live = node.__tetrisLive;
    const state = live?.state;
    const isPlaying = !!(state && state.running && state.started && !state.gameOver);
    const pauseTooltip = isPlaying ? "Pause" : "Play";
    const musicVolume = clampMusicVolume(config.music_volume ?? 100);
    const musicMuted = !!config.music_muted || musicVolume <= 0;
    const desiredY = boardY - toolbarHeight - 10;
    const barY = Math.max(headerHeight + 2, Math.round(desiredY));
    const barX = padding;
    const barW = node.size[0] - padding * 2;
    const barH = toolbarHeight - 6;
    const { buttons } = buildToolbarButtons(node, barY, barH);
    ui.toolbarButtons = buttons;
    ui.toolbarRect = { x: barX, y: barY, w: barW, h: barH };
    ctx.save();
    ctx.fillStyle = theme.panel_bg;
    ctx.strokeStyle = theme.panel_border;
    ctx.lineWidth = 1;
    if (config.theme === "neon") {
      ctx.shadowColor = theme.panel_border;
      ctx.shadowBlur = themeSettings.neon_glow || 8;
    }
    if ((config.theme === "glass" || config.theme === "neon") && typeof ctx.roundRect === "function") {
      const radius = getThemeCornerRadius(node);
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, radius);
      ctx.fill();
      if (config.theme !== "flat" && config.theme !== "minimal") {
        ctx.stroke();
      }
    } else if (config.theme !== "minimal") {
      ctx.fillRect(barX, barY, barW, barH);
      if (config.theme !== "flat") {
        ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
      }
    }
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const btn of buttons) {
      if (btn.id === "pause") {
        btn.tooltip = pauseTooltip;
      }
      if (btn.id === "music_mute") {
        btn.tooltip = musicMuted ? "Unmute" : "Mute";
      }
      if (btn.id === "music_volume") {
        const trackX = btn.x;
        const trackY = btn.y + (btn.h / 2) - 2;
        const trackW = btn.w;
        const trackH = 4;
        ctx.save();
        ctx.fillStyle = theme.button_bg;
        ctx.strokeStyle = theme.panel_border;
        if ((config.theme === "glass" || config.theme === "neon") && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(trackX, trackY, trackW, trackH, 3);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(trackX, trackY, trackW, trackH);
          if (config.theme !== "flat") {
            ctx.strokeRect(trackX + 0.5, trackY + 0.5, trackW - 1, trackH - 1);
          }
        }
        const fillW = Math.round((musicVolume / 100) * trackW);
        if (fillW > 0) {
          ctx.fillStyle = theme.accent;
          ctx.fillRect(trackX, trackY, fillW, trackH);
        }
        const knobX = trackX + fillW - 3;
        ctx.fillStyle = theme.text;
        ctx.fillRect(knobX, trackY - 2, 6, trackH + 4);
        ctx.restore();
        continue;
      }
      const hovered = ui.hoverButton && ui.hoverButton.id === btn.id;
      const iconColor = theme.button || theme.text;
      if (config.theme === "glass") {
        const radius = themeSettings.glass_radius ?? 6;
        const grad = ctx.createLinearGradient(0, btn.y, 0, btn.y + btn.h);
        const gradBase =
          "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.08) 100%)";
        const gradHover =
          "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.16) 100%)";
        const stops = (hovered ? gradHover : gradBase).match(/rgba\([^)]+\)/g) || [];
        grad.addColorStop(0, stops[0] || "rgba(255,255,255,0.45)");
        grad.addColorStop(0.45, stops[1] || "rgba(255,255,255,0.22)");
        grad.addColorStop(1, stops[2] || "rgba(255,255,255,0.08)");
        ctx.fillStyle = grad;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);
          ctx.fill();
        } else {
          ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        }
        if (typeof ctx.roundRect === "function") {
          const borderWidth = 1;
          const lightStroke = "rgba(255,255,255,0.7)";
          const baseStroke = "rgba(255,255,255,0.7)";
          const outerX = btn.x + 0.5;
          const outerY = btn.y + 0.5;
          const outerW = btn.w - 1;
          const outerH = btn.h - 1;
          const innerX = btn.x + 0.5;
          const innerY = outerY + borderWidth;
          const innerW = outerW;
          const innerH = outerH - borderWidth;
          const innerRadius = Math.max(0, radius - borderWidth);
          ctx.lineWidth = borderWidth;
          ctx.strokeStyle = lightStroke;
          ctx.beginPath();
          ctx.roundRect(innerX, innerY, innerW, innerH, innerRadius);
          ctx.stroke();
          ctx.strokeStyle = baseStroke;
          ctx.beginPath();
          ctx.roundRect(outerX, outerY, outerW, outerH, radius);
          ctx.stroke();
        } else {
          ctx.strokeStyle = hovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)";
          ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
        }
      } else if (config.theme === "neon") {
        const radius = getThemeCornerRadius(node);
        ctx.fillStyle = hovered ? theme.button_hover : theme.button_bg;
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(btn.x, btn.y, btn.w, btn.h, radius);
          ctx.fill();
        } else {
          ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
        }
      } else {
        ctx.fillStyle = hovered ? theme.button_hover : theme.button_bg;
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      }
      if (config.theme !== "flat") {
        ctx.strokeStyle = theme.panel_border;
        if ((config.theme === "glass" || config.theme === "neon") && typeof ctx.roundRect === "function") {
          const radius = getThemeCornerRadius(node);
          ctx.beginPath();
          ctx.roundRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1, radius);
          ctx.stroke();
        } else {
          ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
        }
      }
      ctx.fillStyle = theme.text;
      if (btn.id === "load") {
        const iconSize = Math.floor(btn.w * 0.82);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        if (!drawLoadIcon(ctx, iconX, iconY, iconSize, iconColor)) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else if (btn.id === "save") {
        const iconSize = Math.floor(btn.w * 0.82);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        if (!drawSaveIcon(ctx, iconX, iconY, iconSize, iconColor)) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else if (btn.id === "reset") {
        const iconSize = Math.floor(btn.w * 0.82);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        if (!drawResetIcon(ctx, iconX, iconY, iconSize, iconColor)) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else if (btn.id === "pause") {
        const iconSize = Math.floor(btn.w * 0.75);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        const drew = isPlaying
          ? drawPauseIcon(ctx, iconX, iconY, iconSize, iconColor)
          : drawPlayIcon(ctx, iconX, iconY, iconSize, iconColor);
        if (!drew) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else if (btn.id === "settings") {
        const iconSize = Math.floor(btn.w * 0.7);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        if (!drawSettingsIcon(ctx, iconX, iconY, iconSize, iconColor)) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else if (btn.id === "music_mute") {
        const iconSize = Math.floor(btn.w * 0.7);
        const iconX = btn.x + (btn.w - iconSize) / 2;
        const iconY = btn.y + (btn.h - iconSize) / 2;
        if (!drawSpeakerIcon(ctx, iconX, iconY, iconSize, iconColor, musicMuted)) {
          ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
        }
      } else {
        ctx.fillText(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 0.5);
      }
    }
    if (ui.hoverButton?.tooltip) {
      const tooltip = ui.hoverButton.tooltip;
      ctx.font = "11px sans-serif";
      const paddingValue = 6;
      const width = ctx.measureText(tooltip).width + paddingValue * 2;
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

  return {
    buildToolbarButtons,
    drawToolbar,
  };
}
