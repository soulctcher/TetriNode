export function renderThemeModal(node, body, deps) {
  const {
    getConfig,
    cloneDeep,
    defaultConfig,
    formatThemeName,
    updateConfig,
    buildThemePaletteFromSwatch,
    getThemeColors,
    formatThemeKeyLabel,
    applySwatchBackground,
    colorToHex,
    getContrastTextColor,
    openColorPicker,
    themePresets,
    themeUsedKeys,
    applyModalThemeStyles,
  } = deps;
  body.innerHTML = "";
  const config = getConfig(node);
  const ensureThemePreset = (next, theme) => {
    if (!next.theme_colors) next.theme_colors = cloneDeep(defaultConfig.theme_colors);
    if (!next.theme_colors[theme]) {
      next.theme_colors[theme] = cloneDeep(defaultConfig.theme_colors[theme]);
    }
    return next.theme_colors[theme];
  };
  const themeSwatches = [
    { name: "Red", hex: "#FF3B30" },
    { name: "Orange", hex: "#FF9500" },
    { name: "Yellow", hex: "#FFCC00" },
    { name: "Green", hex: "#34C759" },
    { name: "Teal", hex: "#00C7BE" },
    { name: "Blue", hex: "#0A84FF" },
    { name: "Indigo", hex: "#5E5CE6" },
    { name: "Purple", hex: "#BF5AF2" },
    { name: "Pink", hex: "#FF2D55" },
    { name: "Gray", hex: "#8E8E93" },
  ];
  const themeRow = document.createElement("div");
  themeRow.style.display = "flex";
  themeRow.style.gap = "8px";
  ["glass", "flat", "neon", "minimal"].forEach((theme) => {
    const btn = document.createElement("button");
    btn.textContent = formatThemeName(theme);
    btn.disabled = config.theme === theme;
    btn.dataset.tnActive = btn.disabled ? "true" : "false";
    btn.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.theme = theme;
        return next;
      });
      renderThemeModal(node, body, deps);
      node.setDirtyCanvas(true, true);
    });
    themeRow.appendChild(btn);
  });
  const swatchRow = document.createElement("div");
  swatchRow.style.display = "grid";
  swatchRow.style.gridTemplateColumns = "repeat(10, minmax(0, 1fr))";
  swatchRow.style.gap = "6px";
  swatchRow.style.width = "100%";
  themeSwatches.forEach((swatch) => {
    const btn = document.createElement("div");
    btn.title = swatch.name;
    btn.dataset.tnSwatch = "true";
    btn.style.width = "100%";
    btn.style.height = "22px";
    btn.style.borderRadius = "4px";
    btn.style.background = swatch.hex;
    btn.style.border = `1px solid ${getThemeColors(node).panel_border}`;
    btn.style.cursor = "pointer";
    btn.style.boxSizing = "border-box";
    btn.tabIndex = 0;
    btn.setAttribute("role", "button");
    const applySwatch = () => {
      updateConfig(node, (next) => {
        const preset = ensureThemePreset(next, next.theme);
        const palette = buildThemePaletteFromSwatch(swatch.hex, next.theme);
        Object.assign(preset, palette);
        return next;
      });
      renderThemeModal(node, body, deps);
      node.setDirtyCanvas(true, true);
    };
    btn.addEventListener("click", applySwatch);
    btn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        applySwatch();
        event.preventDefault();
      }
    });
    swatchRow.appendChild(btn);
  });
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset Theme Colors";
  resetBtn.addEventListener("click", () => {
    updateConfig(node, (next) => {
      next.theme_colors[config.theme] = cloneDeep(defaultConfig.theme_colors[config.theme]);
      return next;
    });
    renderThemeModal(node, body, deps);
    node.setDirtyCanvas(true, true);
  });
  body.append(themeRow, swatchRow, resetBtn);

  const settings = config.theme_settings || defaultConfig.theme_settings;
  if (config.theme === "glass") {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "150px 1fr auto";
    row.style.gap = "8px";
    const label = document.createElement("div");
    label.textContent = "Corner Radius";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "16";
    slider.step = "1";
    slider.value = `${settings.glass_radius}`;
    slider.addEventListener("input", () => {
      updateConfig(node, (next) => {
        next.theme_settings.glass_radius = Number.parseInt(slider.value, 10);
        return next;
      });
      node.setDirtyCanvas(true, true);
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.theme_settings.glass_radius = defaultConfig.theme_settings.glass_radius;
        return next;
      });
      renderThemeModal(node, body, deps);
      node.setDirtyCanvas(true, true);
    });
    row.append(label, slider, resetBtn);
    body.appendChild(row);
  }

  if (config.theme === "neon") {
    const glowRow = document.createElement("div");
    glowRow.style.display = "grid";
    glowRow.style.gridTemplateColumns = "150px 1fr auto";
    glowRow.style.gap = "8px";
    const glowLabel = document.createElement("div");
    glowLabel.textContent = "Glow Strength";
    const glowSlider = document.createElement("input");
    glowSlider.type = "range";
    glowSlider.min = "0";
    glowSlider.max = "24";
    glowSlider.step = "1";
    glowSlider.value = `${settings.neon_glow}`;
    glowSlider.addEventListener("input", () => {
      updateConfig(node, (next) => {
        next.theme_settings.neon_glow = Number.parseInt(glowSlider.value, 10);
        return next;
      });
      node.setDirtyCanvas(true, true);
    });
    const glowReset = document.createElement("button");
    glowReset.textContent = "Reset";
    glowReset.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.theme_settings.neon_glow = defaultConfig.theme_settings.neon_glow;
        return next;
      });
      renderThemeModal(node, body, deps);
      node.setDirtyCanvas(true, true);
    });
    glowRow.append(glowLabel, glowSlider, glowReset);
    body.appendChild(glowRow);

    const radiusRow = document.createElement("div");
    radiusRow.style.display = "grid";
    radiusRow.style.gridTemplateColumns = "150px 1fr auto";
    radiusRow.style.gap = "8px";
    const radiusLabel = document.createElement("div");
    radiusLabel.textContent = "Corner Radius";
    const radiusSlider = document.createElement("input");
    radiusSlider.type = "range";
    radiusSlider.min = "0";
    radiusSlider.max = "16";
    radiusSlider.step = "1";
    radiusSlider.value = `${settings.neon_radius ?? settings.glass_radius ?? 6}`;
    radiusSlider.addEventListener("input", () => {
      updateConfig(node, (next) => {
        next.theme_settings.neon_radius = Number.parseInt(radiusSlider.value, 10);
        return next;
      });
      node.setDirtyCanvas(true, true);
    });
    const radiusReset = document.createElement("button");
    radiusReset.textContent = "Reset";
    radiusReset.addEventListener("click", () => {
      updateConfig(node, (next) => {
        next.theme_settings.neon_radius = defaultConfig.theme_settings.neon_radius;
        return next;
      });
      renderThemeModal(node, body, deps);
      node.setDirtyCanvas(true, true);
    });
    radiusRow.append(radiusLabel, radiusSlider, radiusReset);
    body.appendChild(radiusRow);
  }

  const themeColors = config.theme_colors?.[config.theme] || themePresets[config.theme];
  Object.entries(themeColors)
    .filter(([key]) => themeUsedKeys.has(key))
    .forEach(([key, value]) => {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "150px 1fr auto";
      row.style.gap = "8px";
      row.style.alignItems = "center";
      const label = document.createElement("div");
      label.textContent = formatThemeKeyLabel(key);
      const swatch = document.createElement("div");
    swatch.style.width = "100%";
    swatch.style.height = "18px";
    swatch.style.border = "1px solid rgba(255,255,255,0.2)";
    applySwatchBackground(swatch, value, true);
    swatch.style.display = "flex";
    swatch.style.alignItems = "center";
    swatch.style.justifyContent = "center";
    swatch.style.fontSize = "11px";
    swatch.style.fontFamily = "sans-serif";
    swatch.style.fontWeight = "bold";
    const hexText = colorToHex(value, true);
    swatch.textContent = hexText || "";
    swatch.style.color = getContrastTextColor(value);
      swatch.style.cursor = "pointer";
      swatch.addEventListener("click", () => {
        const fallback = themePresets[config.theme][key];
        openColorPicker(node, value, true, fallback, (nextValue) => {
          updateConfig(node, (next) => {
            next.theme_colors[config.theme][key] = nextValue;
            return next;
          });
          renderThemeModal(node, body, deps);
          node.setDirtyCanvas(true, true);
        });
      });
      const resetBtn = document.createElement("button");
      resetBtn.textContent = "Reset";
      resetBtn.addEventListener("click", () => {
        updateConfig(node, (next) => {
          next.theme_colors[config.theme][key] = themePresets[config.theme][key];
          return next;
        });
        renderThemeModal(node, body, deps);
        node.setDirtyCanvas(true, true);
      });
      row.append(label, swatch, resetBtn);
      body.appendChild(row);
    });
  const modalEl = body.parentElement || body;
  applyModalThemeStyles(node, modalEl);
}
