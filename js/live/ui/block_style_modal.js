import {
  BLOCK_STYLE_PREVIEW_SHAPES,
  BLOCK_STYLE_SLIDER_DEFS,
  BLOCK_STYLE_TEXTURE_OPTIONS,
  buildBlockStylePresets,
} from "../data/block_style_presets.js";

export function renderBlockStyleModal(node, body, deps) {
  const {
    getConfig,
    getThemeColors,
    ensureUiState,
    cloneDeep,
    defaultConfig,
    infoIconViewbox,
    infoIconPath,
    createTetrominoLabel,
    shapeMap,
    getUiPreviewTextureTransforms,
    drawBlockSized,
    applyModalThemeStyles,
    updateConfig,
  } = deps;
  body.innerHTML = "";
  const config = getConfig(node);
  const theme = getThemeColors(node);
  const ui = ensureUiState(node);
  if (!ui.blockStylePreviewShape) {
    ui.blockStylePreviewShape = "O";
  }
  const layout = document.createElement("div");
  layout.style.display = "grid";
  layout.style.gridTemplateColumns = "1fr 1px 1fr 1px 1fr";
  layout.style.gap = "12px";
  const divider = document.createElement("div");
  divider.style.background = theme.panel_border;
  divider.style.opacity = "0.6";
  const dividerRight = document.createElement("div");
  dividerRight.style.background = theme.panel_border;
  dividerRight.style.opacity = "0.6";
  const leftCol = document.createElement("div");
  leftCol.style.display = "flex";
  leftCol.style.flexDirection = "column";
  leftCol.style.gap = "10px";
  const rightCol = document.createElement("div");
  rightCol.style.display = "flex";
  rightCol.style.flexDirection = "column";
  rightCol.style.gap = "10px";
  const previewCol = document.createElement("div");
  previewCol.style.display = "flex";
  previewCol.style.flexDirection = "column";
  previewCol.style.gap = "12px";
  const presetValues = buildBlockStylePresets(defaultConfig.block_style);
  const presetNames = Object.keys(presetValues).sort((a, b) => a.localeCompare(b));
  const presetsHeader = document.createElement("div");
  presetsHeader.textContent = "Presets";
  presetsHeader.style.fontWeight = "600";
  const presetsSelect = document.createElement("select");
  const customOption = document.createElement("option");
  customOption.value = "Custom";
  customOption.textContent = "Custom";
  presetsSelect.appendChild(customOption);
  const normalizePresetLabel = (name) => {
    if (!name) return "";
    const parenIndex = name.indexOf("(");
    return (parenIndex >= 0 ? name.slice(0, parenIndex) : name).trim();
  };
  presetNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    presetsSelect.appendChild(option);
  });
  const defaultPresetName = ui.blockStylePreset || "Flat (default)";
  if (!ui.blockStylePresetBaseFull) {
    ui.blockStylePresetBaseFull = defaultPresetName;
    ui.blockStylePresetBaseLabel = normalizePresetLabel(defaultPresetName);
  }
  if (ui.blockStylePreset === "Custom" && ui.blockStylePresetBaseLabel) {
    customOption.textContent = `Custom (${ui.blockStylePresetBaseLabel})`;
  }
  presetsSelect.value = defaultPresetName;
  presetsSelect.addEventListener("change", () => {
    const name = presetsSelect.value;
    const preset = presetValues[name];
    if (!preset) return;
    ui.blockStylePreset = name;
    ui.blockStylePresetBaseFull = name;
    ui.blockStylePresetBaseLabel = normalizePresetLabel(name);
    customOption.textContent = "Custom";
    updateConfig(node, (next) => {
      next.block_style = cloneDeep(preset);
      return next;
    });
    node.setDirtyCanvas(true, true);
    if (ui.blockStylePreviewDraw) {
      ui.blockStylePreviewDraw();
    }
    renderBlockStyleModal(node, body, deps);
  });
  const markCustom = () => {
    const baseLabel = ui.blockStylePresetBaseLabel || "";
    customOption.textContent = baseLabel ? `Custom (${baseLabel})` : "Custom";
    if (ui.blockStylePreset !== "Custom") {
      ui.blockStylePreset = "Custom";
      presetsSelect.value = "Custom";
    }
  };
  ui.blockStyleMarkCustom = markCustom;
  const presetRule = document.createElement("div");
  presetRule.style.height = "1px";
  presetRule.style.background = theme.panel_border;
  presetRule.style.opacity = "0.6";
  previewCol.append(presetsHeader, presetsSelect, presetRule);
  const infoIcon = (text) => {
    const icon = document.createElement("span");
    icon.title = text;
    icon.style.display = "inline-flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.width = "18px";
    icon.style.height = "18px";
    icon.style.marginLeft = "0";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${infoIconViewbox} ${infoIconViewbox}`);
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", infoIconPath);
    path.setAttribute("fill", theme.accent);
    svg.appendChild(path);
    icon.appendChild(svg);
    return icon;
  };
  const formatSliderValue = (value, stepSize) => {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric)) return "0";
    const decimals = stepSize < 1 ? Math.min(3, `${stepSize}`.split(".")[1]?.length || 0) : 0;
    return numeric.toFixed(decimals);
  };
  const buildLabeledHint = (labelText, hint) => {
    const label = document.createElement("div");
    label.style.display = "inline";
    label.style.lineHeight = "1.1";
    label.style.fontSize = "12px";
    const words = `${labelText}`.trim().split(/\s+/);
    const lastWord = words.pop() || "";
    if (words.length) {
      const prefix = document.createElement("span");
      prefix.textContent = `${words.join(" ")} `;
      label.appendChild(prefix);
    }
    const tail = document.createElement("span");
    tail.style.whiteSpace = "nowrap";
    const lastSpan = document.createElement("span");
    lastSpan.textContent = lastWord;
    const icon = infoIcon(hint);
    icon.style.marginLeft = "6px";
    icon.style.verticalAlign = "text-bottom";
    tail.append(lastSpan, icon);
    label.appendChild(tail);
    return label;
  };
  const addSlider = (container, labelText, key, min, max, step, hint) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr 64px auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = buildLabeledHint(labelText, hint);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = `${min}`;
    slider.max = `${max}`;
    slider.step = `${step}`;
    slider.value = `${config.block_style?.[key] ?? defaultConfig.block_style[key] ?? 0}`;
    const valueBox = document.createElement("div");
    valueBox.textContent = formatSliderValue(slider.value, step);
    valueBox.style.fontFamily = "monospace";
    valueBox.style.textAlign = "right";
    valueBox.style.padding = "2px 6px";
    valueBox.style.border = `1px solid ${theme.panel_border}`;
    valueBox.style.borderRadius = "6px";
    valueBox.style.background = theme.button_bg;
    slider.addEventListener("input", () => {
      updateConfig(node, (next) => {
        if (!next.block_style) next.block_style = cloneDeep(defaultConfig.block_style);
        next.block_style[key] = Number.parseFloat(slider.value);
        return next;
      });
      valueBox.textContent = formatSliderValue(slider.value, step);
      node.setDirtyCanvas(true, true);
      if (ui.blockStylePreviewDraw) {
        ui.blockStylePreviewDraw();
      }
      if (ui.blockStyleMarkCustom) {
        ui.blockStyleMarkCustom();
      }
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      const basePreset =
        ui.blockStylePresetBaseFull && presetValues[ui.blockStylePresetBaseFull]
          ? presetValues[ui.blockStylePresetBaseFull]
          : null;
      updateConfig(node, (next) => {
        if (!next.block_style) next.block_style = cloneDeep(defaultConfig.block_style);
        if (basePreset && key in basePreset) {
          next.block_style[key] = basePreset[key];
        } else {
          next.block_style[key] = defaultConfig.block_style[key] ?? 0;
        }
        return next;
      });
      const nextValue = basePreset && key in basePreset ? basePreset[key] : defaultConfig.block_style[key] ?? 0;
      slider.value = `${nextValue}`;
      valueBox.textContent = formatSliderValue(slider.value, step);
      node.setDirtyCanvas(true, true);
      if (ui.blockStylePreviewDraw) {
        ui.blockStylePreviewDraw();
      }
      if (ui.blockStyleMarkCustom) {
        ui.blockStyleMarkCustom();
      }
    });
    row.append(label, slider, valueBox, resetBtn);
    container.appendChild(row);
  };
  const sliderDefs = BLOCK_STYLE_SLIDER_DEFS;
  const gradientIndex = sliderDefs.findIndex((def) => def.key === "gradient");
  const splitIndex = Math.max(
    Math.ceil(sliderDefs.length / 2),
    gradientIndex >= 0 ? gradientIndex + 1 : 0,
  );
  sliderDefs.slice(0, splitIndex).forEach((def) => {
    addSlider(leftCol, def.label, def.key, def.min, def.max, def.step, def.hint);
  });
  sliderDefs.slice(splitIndex).forEach((def) => {
    addSlider(rightCol, def.label, def.key, def.min, def.max, def.step, def.hint);
  });
  const textureRow = document.createElement("div");
  textureRow.style.display = "grid";
  textureRow.style.gridTemplateColumns = "140px 1fr auto";
  textureRow.style.gap = "8px";
  textureRow.style.alignItems = "center";
  textureRow.style.marginTop = "6px";
  const textureLabel = buildLabeledHint("Texture", "Overlay a texture pattern on the block fill.");
  const textureSelect = document.createElement("select");
  const textureOptions = BLOCK_STYLE_TEXTURE_OPTIONS;
  textureOptions.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    textureSelect.appendChild(item);
  });
  textureSelect.value = config.block_style?.texture_id ?? defaultConfig.block_style.texture_id ?? "";
  textureSelect.addEventListener("change", () => {
    updateConfig(node, (next) => {
      if (!next.block_style) next.block_style = cloneDeep(defaultConfig.block_style);
      next.block_style.texture_id = textureSelect.value;
      if (next.block_style.texture_id && (next.block_style.texture_opacity ?? 0) <= 0) {
        next.block_style.texture_opacity = 1;
      }
      return next;
    });
    if (ui.blockStylePreviewDraw) {
      ui.blockStylePreviewDraw();
    }
    if (ui.blockStyleMarkCustom) {
      ui.blockStyleMarkCustom();
    }
    node.setDirtyCanvas(true, true);
  });
  const textureReset = document.createElement("button");
  textureReset.textContent = "Reset";
  textureReset.addEventListener("click", () => {
    const basePreset =
      ui.blockStylePresetBaseFull && presetValues[ui.blockStylePresetBaseFull]
        ? presetValues[ui.blockStylePresetBaseFull]
        : null;
    updateConfig(node, (next) => {
      if (!next.block_style) next.block_style = cloneDeep(defaultConfig.block_style);
      if (basePreset && "texture_id" in basePreset) {
        next.block_style.texture_id = basePreset.texture_id;
      } else {
        next.block_style.texture_id = defaultConfig.block_style.texture_id;
      }
      return next;
    });
    const nextValue = basePreset && "texture_id" in basePreset
      ? basePreset.texture_id
      : defaultConfig.block_style.texture_id;
    textureSelect.value = nextValue;
    if (ui.blockStylePreviewDraw) {
      ui.blockStylePreviewDraw();
    }
    if (ui.blockStyleMarkCustom) {
      ui.blockStyleMarkCustom();
    }
    node.setDirtyCanvas(true, true);
  });
  textureRow.append(textureLabel, textureSelect, textureReset);
  rightCol.appendChild(textureRow);
  const previewHeader = document.createElement("div");
  previewHeader.textContent = "Preview";
  previewHeader.style.fontWeight = "600";
  previewCol.appendChild(previewHeader);
  const shapeRow = document.createElement("div");
  shapeRow.style.display = "flex";
  shapeRow.style.gap = "6px";
  shapeRow.style.flexWrap = "wrap";
  shapeRow.style.justifyContent = "space-between";
  const shapes = BLOCK_STYLE_PREVIEW_SHAPES;
  shapes.forEach((shape) => {
    const swatch = document.createElement("button");
    swatch.dataset.tnSwatch = "true";
    swatch.style.display = "inline-flex";
    swatch.style.alignItems = "center";
    swatch.style.justifyContent = "center";
    swatch.style.padding = "4px";
    swatch.style.borderRadius = "6px";
    swatch.style.background = theme.button_bg;
    swatch.style.border = `1px solid ${theme.panel_border}`;
    if (shape === ui.blockStylePreviewShape) {
      swatch.style.borderColor = theme.accent;
      swatch.style.boxShadow = `0 0 0 1px ${theme.accent}`;
    }
    const label = createTetrominoLabel(shape, config.colors[`color_${shape.toLowerCase()}`], 10);
    swatch.appendChild(label);
    swatch.addEventListener("click", () => {
      ui.blockStylePreviewShape = shape;
      renderBlockStyleModal(node, body, deps);
    });
    shapeRow.appendChild(swatch);
  });
  previewCol.appendChild(shapeRow);
  const previewWrap = document.createElement("div");
  previewWrap.style.display = "flex";
  previewWrap.style.alignItems = "center";
  previewWrap.style.justifyContent = "center";
  previewWrap.style.minHeight = "140px";
  const previewShape = ui.blockStylePreviewShape || "O";
  const previewColor = config.colors[`color_${previewShape.toLowerCase()}`];
  const previewCells = shapeMap[previewShape]?.[0] || [];
  const previewTransforms = getUiPreviewTextureTransforms(ui, previewShape);
  let minX = 99;
  let minY = 99;
  let maxX = -99;
  let maxY = -99;
  previewCells.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const renderPreview = () => {
    const maxW = Math.max(0, previewWrap.clientWidth - 8);
    const maxH = Math.max(0, previewWrap.clientHeight - 8);
    if (!maxW || !maxH) return;
    const cellSize = Math.max(6, Math.floor(Math.min(maxW / width, maxH / height)));
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    previewCells.forEach(([x, y], index) => {
      drawBlockSized(
        ctx,
        (x - minX) * cellSize,
        (y - minY) * cellSize,
        cellSize,
        previewColor,
        node,
        previewTransforms[index] ?? null,
      );
    });
  };
  ui.blockStylePreviewDraw = renderPreview;
  if (ui.blockStylePreviewObserver) {
    ui.blockStylePreviewObserver.disconnect();
  }
  ui.blockStylePreviewObserver = new ResizeObserver(() => {
    renderPreview();
  });
  ui.blockStylePreviewObserver.observe(previewWrap);
  previewWrap.appendChild(canvas);
  requestAnimationFrame(() => renderPreview());
  previewCol.appendChild(previewWrap);
  layout.append(leftCol, divider, rightCol, dividerRight, previewCol);
  body.appendChild(layout);
  const modalEl = body.parentElement || body;
  applyModalThemeStyles(node, modalEl);
}
