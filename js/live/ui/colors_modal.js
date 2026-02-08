import { getColorPresets } from "../data/color_presets.js";
import { DEFAULT_CONFIG } from "../data/defaults.js";

export function renderColorsModal(node, body, deps) {
  const {
    getConfig,
    ensureUiState,
    createTetrominoLabel,
    applySwatchBackground,
    colorToHex,
    getContrastTextColor,
    openColorPicker,
    updateConfig,
    updateBackendState,
    getThemeColors,
    applyModalThemeStyles,
  } = deps;

  body.innerHTML = "";
  const config = getConfig(node);
  const ui = ensureUiState(node);
  const layout = document.createElement("div");
  layout.style.display = "flex";
  layout.style.flexDirection = "column";
  layout.style.gap = "8px";
  const presets = getColorPresets(DEFAULT_CONFIG.colors);
  const presetRow = document.createElement("div");
  presetRow.style.display = "grid";
  presetRow.style.gridTemplateColumns = "140px 1fr";
  presetRow.style.gap = "8px";
  presetRow.style.alignItems = "center";
  const presetLabel = document.createElement("div");
  presetLabel.textContent = "Presets";
  const presetSelect = document.createElement("select");
  const sortedPresets = presets.slice().sort((a, b) => a.name.localeCompare(b.name));
  const customOption = document.createElement("option");
  const ensureCustomLabel = () => {
    if (ui.colorPresetBase && ui.colorPresetBase !== "Custom") {
      customOption.textContent = `Custom (${ui.colorPresetBase})`;
    } else {
      customOption.textContent = "Custom";
    }
  };
  ensureCustomLabel();
  customOption.value = "Custom";
  presetSelect.appendChild(customOption);
  sortedPresets.forEach((preset) => {
    const opt = document.createElement("option");
    opt.value = preset.name;
    opt.textContent = preset.name;
    presetSelect.appendChild(opt);
  });
  const resolvePreset = (name, fallbackName) => {
    const preset = sortedPresets.find((entry) => entry.name === name);
    if (preset) return preset;
    return sortedPresets.find((entry) => entry.name === fallbackName) || sortedPresets[0];
  };
  if (!ui.colorPreset) {
    ui.colorPreset = "Classic (Default)";
    ui.colorPresetBase = ui.colorPreset;
  }
  if (!ui.colorPresetBase) {
    ui.colorPresetBase = ui.colorPreset === "Custom" ? "Classic (Default)" : ui.colorPreset;
  }
  ensureCustomLabel();
  presetSelect.value = ui.colorPreset;
  presetSelect.addEventListener("change", () => {
    const nextValue = presetSelect.value;
    if (nextValue === "Custom") {
      ui.colorPreset = "Custom";
      ui.colorPresetBase = ui.colorPresetBase || "Classic (Default)";
      ensureCustomLabel();
      renderColorsModal(node, body, deps);
      return;
    }
    const chosen = resolvePreset(nextValue, "Classic (Default)");
    ui.colorPreset = chosen.name;
    ui.colorPresetBase = chosen.name;
    ensureCustomLabel();
    updateConfig(node, (next) => {
      const nextColors = { ...(next.colors || {}) };
      Object.entries(chosen.colors).forEach(([key, value]) => {
        nextColors[key] = value;
      });
      next.colors = nextColors;
      return next;
    });
    updateBackendState(node);
    node.setDirtyCanvas(true, true);
    renderColorsModal(node, body, deps);
  });
  presetRow.append(presetLabel, presetSelect);
  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.background = getThemeColors(node).panel_border;
  divider.style.opacity = "0.6";
  layout.append(divider, presetRow, divider.cloneNode());
  const items = [
    { id: "color_i", label: "I", alpha: false },
    { id: "color_j", label: "J", alpha: false },
    { id: "color_l", label: "L", alpha: false },
    { id: "color_o", label: "O", alpha: false },
    { id: "color_s", label: "S", alpha: false },
    { id: "color_t", label: "T", alpha: false },
    { id: "color_z", label: "Z", alpha: false },
    { id: "background_color", label: "Background", alpha: false },
    { id: "grid_color", label: "Grid", alpha: true, target: "grid_color" },
  ];
  items.forEach((item) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = document.createElement("div");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.justifyContent = "center";
    const isTetromino = item.id.startsWith("color_") && item.label.length === 1;
    if (isTetromino) {
      const color = config.colors[item.id];
      label.appendChild(createTetrominoLabel(item.label, color));
    } else {
      label.textContent = item.label;
    }
    const swatch = document.createElement("div");
    const value =
      item.id === "grid_color" ? config.grid_color : config.colors[item.id];
    swatch.style.width = "100%";
    swatch.style.height = "18px";
    swatch.style.border = "1px solid rgba(255,255,255,0.2)";
    applySwatchBackground(swatch, value, true);
    swatch.style.display = "flex";
    swatch.style.alignItems = "center";
    swatch.style.justifyContent = "center";
    swatch.style.fontSize = "10px";
    swatch.style.fontFamily = "sans-serif";
    const hexText = colorToHex(value, item.alpha !== false);
    swatch.textContent = hexText || "";
    swatch.style.color = getContrastTextColor(value);
    swatch.style.cursor = "pointer";
    swatch.addEventListener("click", () => {
      const fallback =
        item.id === "grid_color" ? DEFAULT_CONFIG.grid_color : DEFAULT_CONFIG.colors[item.id];
      openColorPicker(node, value, item.alpha !== false, fallback, (nextValue) => {
        if (ui.colorPreset !== "Custom") {
          ui.colorPresetBase = ui.colorPreset || "Classic (Default)";
          ui.colorPreset = "Custom";
        }
        ensureCustomLabel();
        updateConfig(node, (next) => {
          if (item.id === "grid_color") {
            next.grid_color = nextValue;
          } else {
            next.colors[item.id] = nextValue;
          }
          return next;
        });
        updateBackendState(node);
        renderColorsModal(node, body, deps);
      });
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      const presetName =
        ui.colorPreset === "Custom"
          ? ui.colorPresetBase || "Classic (Default)"
          : ui.colorPreset || "Classic (Default)";
      const activePreset = resolvePreset(presetName, "Classic (Default)");
      updateConfig(node, (next) => {
        if (item.id === "grid_color") {
          next.grid_color = DEFAULT_CONFIG.grid_color;
        } else {
          next.colors[item.id] = activePreset.colors[item.id] ?? DEFAULT_CONFIG.colors[item.id];
        }
        return next;
      });
      updateBackendState(node);
      renderColorsModal(node, body, deps);
    });
    row.append(label, swatch, resetBtn);
    layout.appendChild(row);
  });
  body.appendChild(layout);
  const modalEl = body.parentElement || body;
  applyModalThemeStyles(node, modalEl);
}
