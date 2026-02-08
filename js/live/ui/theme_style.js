export function createThemeStyleHelpers(deps) {
  const { getConfig, getThemeColors, defaultConfig, toOpaqueColor } = deps;

  function getThemeCornerRadius(node) {
    const config = getConfig(node);
    const settings = config.theme_settings || defaultConfig.theme_settings;
    if (config.theme === "glass") return settings.glass_radius ?? 6;
    if (config.theme === "neon") return settings.neon_radius ?? 6;
    if (config.theme === "flat" || config.theme === "minimal") return 0;
    return 6;
  }

  function applyBorderGlow(ctx, node) {
    const config = getConfig(node);
    if (config.theme !== "neon") return;
    const theme = getThemeColors(node);
    const settings = config.theme_settings || defaultConfig.theme_settings;
    ctx.shadowColor = theme.panel_border;
    ctx.shadowBlur = settings.neon_glow || 8;
  }

  function clearBorderGlow(ctx) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  function drawPanelBox(ctx, node, x, y, w, h, fillColor, strokeColor) {
    const config = getConfig(node);
    const radius = getThemeCornerRadius(node);
    ctx.fillStyle = fillColor;
    const drawStroke = config.theme !== "flat";
    if (drawStroke) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      applyBorderGlow(ctx, node);
    }
    if (radius > 0 && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      if (drawStroke) ctx.stroke();
    } else {
      ctx.fillRect(x, y, w, h);
      if (drawStroke) ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    if (drawStroke) clearBorderGlow(ctx);
  }

  function applyModalThemeStyles(node, container) {
    if (!container) return;
    const config = getConfig(node);
    const theme = getThemeColors(node);
    const isFlat = config.theme === "flat";
    const isMinimal = config.theme === "minimal";
    const isNeon = config.theme === "neon";
    const themeSettings = config.theme_settings || defaultConfig.theme_settings;
    const radius = getThemeCornerRadius(node);
    const useBorders = !isFlat && !isMinimal;
    const applyButtonStyle = (btn, variant) => {
      const isGlass = config.theme === "glass";
      const isActive = btn.dataset.tnActive === "true";
      const isHover = variant === "hover";
      const isTab = btn.dataset.tnTab === "true";
      if (isTab) {
        const bg = isActive ? theme.button_hover : theme.button_bg;
        btn.style.setProperty("background", bg, "important");
        btn.style.setProperty(
          "border",
          useBorders ? `1px solid ${theme.panel_border}` : "none",
          "important",
        );
        if (useBorders) {
          btn.style.setProperty("border-bottom-color", theme.panel_bg, "important");
        }
        btn.style.setProperty(
          "box-shadow",
          isNeon ? `0 0 ${themeSettings.neon_glow ?? 8}px ${theme.panel_border}` : "none",
          "important",
        );
        btn.style.setProperty("color", theme.text, "important");
        btn.style.setProperty("webkit-text-fill-color", theme.text, "important");
        const radiusValue = `${radius}px ${radius}px 0 0`;
        btn.style.setProperty("border-radius", radiusValue, "important");
        btn.style.setProperty("display", "inline-flex", "important");
        btn.style.setProperty("align-items", "center", "important");
        btn.style.setProperty("justify-content", "center", "important");
        btn.style.setProperty("gap", "6px", "important");
        btn.style.setProperty("height", "26px", "important");
        btn.style.setProperty("padding", "0 12px", "important");
        btn.style.setProperty("font-size", "11px", "important");
        btn.style.setProperty("line-height", "1", "important");
        btn.style.setProperty("cursor", "pointer", "important");
        btn.style.setProperty("opacity", "1", "important");
        btn.style.setProperty("margin-bottom", isActive ? "-1px" : "0", "important");
        return;
      }
      if (isGlass) {
        const gradBase =
          "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.08) 100%)";
        const gradHover =
          "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.12) 100%)";
        const gradActive =
          "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.16) 100%)";
        const gradient = isActive ? gradActive : isHover ? gradHover : gradBase;
        const border = isActive ? "1px solid rgba(255,255,255,0.7)" : "1px solid rgba(255,255,255,0.45)";
        const glow = isActive ? "0 0 8px rgba(255,255,255,0.35)" : "0 2px 6px rgba(0,0,0,0.25)";
        btn.style.setProperty("background", gradient, "important");
        btn.style.setProperty("border", border, "important");
        btn.style.setProperty(
          "box-shadow",
          `inset 0 1px 0 rgba(255,255,255,0.65), ${glow}`,
          "important",
        );
        btn.style.setProperty("background-clip", "padding-box", "important");
      } else {
        const bg = isActive ? theme.button_hover : isHover ? theme.button_hover : theme.button_bg;
        btn.style.setProperty("background", bg, "important");
        btn.style.setProperty(
          "border",
          useBorders ? `1px solid ${theme.panel_border}` : "none",
          "important",
        );
        btn.style.setProperty(
          "box-shadow",
          isNeon ? `0 0 ${themeSettings.neon_glow ?? 8}px ${theme.panel_border}` : "none",
          "important",
        );
      }
      btn.style.setProperty("color", theme.text, "important");
      btn.style.setProperty("webkit-text-fill-color", theme.text, "important");
      btn.style.setProperty("border-radius", `${radius}px`, "important");
      btn.style.setProperty("display", "inline-flex", "important");
      btn.style.setProperty("align-items", "center", "important");
      btn.style.setProperty("justify-content", "center", "important");
      btn.style.setProperty("gap", "6px", "important");
      btn.style.setProperty("height", "24px", "important");
      btn.style.setProperty("padding", "0 10px", "important");
      btn.style.setProperty("font-size", "11px", "important");
      btn.style.setProperty("line-height", "1", "important");
      btn.style.setProperty("cursor", "pointer", "important");
      btn.style.setProperty("opacity", "1", "important");
    };
    container.querySelectorAll("button").forEach((btn) => {
      if (btn.dataset.tnSwatch === "true") return;
      applyButtonStyle(btn, "base");
      if (!btn.dataset.tnHoverBound) {
        btn.dataset.tnHoverBound = "true";
        btn.addEventListener("mouseenter", () => {
          if (btn.dataset.tnActive === "true") return;
          applyButtonStyle(btn, "hover");
        });
        btn.addEventListener("mouseleave", () => {
          applyButtonStyle(btn, "base");
        });
      }
    });
    container.querySelectorAll("input, select, textarea").forEach((input) => {
      input.style.background = theme.button_bg;
      input.style.color = theme.text;
      input.style.border = useBorders ? `1px solid ${theme.panel_border}` : "none";
      input.style.borderRadius = "6px";
      if (input.tagName === "SELECT") {
        input.style.background = toOpaqueColor(theme.panel_bg);
        input.querySelectorAll("option").forEach((option) => {
          option.style.background = toOpaqueColor(theme.panel_bg);
          option.style.color = theme.text;
        });
      }
    });
  }

  return {
    getThemeCornerRadius,
    drawPanelBox,
    applyModalThemeStyles,
    applyBorderGlow,
    clearBorderGlow,
  };
}
