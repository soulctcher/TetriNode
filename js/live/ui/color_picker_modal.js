export function openColorPicker(node, value, allowAlpha, defaultValue, onApply, deps) {
  const {
    getThemeColors,
    toOpaqueColor,
    parseColorComponents,
    rgbToHsl,
    rgbToHsv,
    rgbaString,
    applyModalThemeStyles,
    parseHexToRgba,
    clamp01,
    hslToRgb,
    hsvToRgb,
    clamp255,
    rgbToHex8,
    rgbToHex6,
  } = deps;
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,0.4)";
  overlay.style.zIndex = "10000";
  const dialog = document.createElement("div");
  dialog.style.position = "fixed";
  dialog.style.left = "50%";
  dialog.style.top = "50%";
  dialog.style.transform = "translate(-50%, -50%)";
  dialog.style.padding = "12px";
  dialog.style.borderRadius = "10px";
  const theme = getThemeColors(node);
  dialog.style.background = toOpaqueColor(theme.panel_bg);
  dialog.style.border = `1px solid ${theme.panel_border}`;
  dialog.style.color = theme.text;
  dialog.style.display = "flex";
  dialog.style.flexDirection = "column";
  dialog.style.gap = "8px";
  dialog.style.width = "max-content";
  dialog.style.maxWidth = "360px";
  const components = parseColorComponents(value);
  const defaultColor = defaultValue ?? value;
  const hsl = rgbToHsl(components.r, components.g, components.b);
  let hsv = rgbToHsv(components.r, components.g, components.b);
  const preview = document.createElement("div");
  preview.style.width = "100%";
  preview.style.height = "24px";
  preview.style.border = "1px solid rgba(255,255,255,0.2)";
  const checkerboardBg =
    "linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%)," +
    "linear-gradient(-45deg, rgba(255,255,255,0.25) 25%, transparent 25%)," +
    "linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.25) 75%)," +
    "linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.25) 75%)";
  preview.style.backgroundSize = "12px 12px";
  preview.style.backgroundPosition = "0 0, 0 6px, 6px -6px, -6px 0px";
  preview.style.backgroundImage = allowAlpha && components.a < 1 ? checkerboardBg : "none";
  preview.style.backgroundColor = rgbaString(components, allowAlpha);

  const pickerWrap = document.createElement("div");
  pickerWrap.style.display = "flex";
  pickerWrap.style.flexDirection = "column";
  pickerWrap.style.gap = "6px";
  pickerWrap.style.alignItems = "center";

  const svCanvas = document.createElement("canvas");
  svCanvas.width = 200;
  svCanvas.height = 120;
  svCanvas.style.width = "200px";
  svCanvas.style.height = "120px";
  svCanvas.style.border = "1px solid rgba(255,255,255,0.18)";
  svCanvas.style.borderRadius = "6px";
  svCanvas.style.cursor = "crosshair";

  const hueRow = document.createElement("div");
  hueRow.style.display = "flex";
  hueRow.style.gap = "8px";
  hueRow.style.alignItems = "center";
  hueRow.style.width = "100%";
  hueRow.style.justifyContent = "center";

  const hueCanvas = document.createElement("canvas");
  hueCanvas.width = 200;
  hueCanvas.height = 14;
  hueCanvas.style.width = "200px";
  hueCanvas.style.height = "14px";
  hueCanvas.style.border = "1px solid rgba(255,255,255,0.18)";
  hueCanvas.style.borderRadius = "8px";
  hueCanvas.style.cursor = "pointer";

  hueRow.append(hueCanvas);
  pickerWrap.append(svCanvas, hueRow);

  const rgbaRow = document.createElement("div");
  rgbaRow.style.display = "grid";
  rgbaRow.style.gridTemplateColumns = allowAlpha
    ? "60px repeat(4, 1fr)"
    : "60px repeat(3, 1fr)";
  rgbaRow.style.gap = "6px";
  const rgbaLabel = document.createElement("div");
  rgbaLabel.textContent = "RGBA";
  const rgbaKeys = allowAlpha ? ["r", "g", "b", "a"] : ["r", "g", "b"];
  const rgbaInputs = rgbaKeys.map((key) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = key === "a" ? "1" : "255";
    input.step = key === "a" ? "0.01" : "1";
    input.style.width = key === "a" ? "calc(7ch + 2px)" : "calc(6ch + 4px)";
    input.value = key === "a" ? `${components.a}` : `${components[key]}`;
    input.dataset.key = key;
    return input;
  });
  rgbaRow.append(rgbaLabel, ...rgbaInputs);

  const hslaRow = document.createElement("div");
  hslaRow.style.display = "grid";
  hslaRow.style.gridTemplateColumns = allowAlpha
    ? "60px repeat(4, 1fr)"
    : "60px repeat(3, 1fr)";
  hslaRow.style.gap = "6px";
  const hslaLabel = document.createElement("div");
  hslaLabel.textContent = "HSLA";
  const hslaInputs = [
    { key: "h", min: 0, max: 360, step: 1, value: Math.round(hsl.h) },
    { key: "s", min: 0, max: 100, step: 1, value: Math.round(hsl.s) },
    { key: "l", min: 0, max: 100, step: 1, value: Math.round(hsl.l) },
    ...(allowAlpha ? [{ key: "a", min: 0, max: 1, step: 0.01, value: components.a }] : []),
  ].map((meta) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = `${meta.min}`;
    input.max = `${meta.max}`;
    input.step = `${meta.step}`;
    input.style.width = meta.key === "a" ? "calc(7ch + 2px)" : "calc(6ch + 4px)";
    input.value = `${meta.value}`;
    input.dataset.key = meta.key;
    return input;
  });
  hslaRow.append(hslaLabel, ...hslaInputs);

  const hexRow = document.createElement("div");
  hexRow.style.display = "grid";
  hexRow.style.gridTemplateColumns = "60px 1fr";
  hexRow.style.gap = "6px";
  const hexLabel = document.createElement("div");
  hexLabel.textContent = "HEX";
  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.style.width = "10ch";
  hexInput.value = allowAlpha
    ? rgbToHex8(components.r, components.g, components.b, components.a)
    : rgbToHex6(components.r, components.g, components.b);
  hexRow.append(hexLabel, hexInput);

  const alphaRow = document.createElement("div");
  alphaRow.style.display = "grid";
  alphaRow.style.gridTemplateColumns = "60px 1fr";
  alphaRow.style.gap = "6px";
  const alphaLabel = document.createElement("div");
  alphaLabel.textContent = "Alpha";
  const alphaInput = document.createElement("input");
  alphaInput.type = "range";
  alphaInput.min = "0";
  alphaInput.max = "1";
  alphaInput.step = "0.01";
  alphaInput.value = `${components.a}`;
  alphaRow.append(alphaLabel, alphaInput);
  if (!allowAlpha) {
    alphaRow.style.display = "none";
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  const reset = document.createElement("button");
  reset.textContent = "Reset";
  const apply = document.createElement("button");
  apply.textContent = "Apply";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";
  actions.append(reset, apply, cancel);

  dialog.append(preview, pickerWrap, rgbaRow, hslaRow, hexRow, alphaRow, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  applyModalThemeStyles(node, dialog);

  const readRgbaInputs = () => {
    const values = {};
    rgbaInputs.forEach((input) => {
      values[input.dataset.key] = Number.parseFloat(input.value);
    });
    if ([values.r, values.g, values.b].some((v) => !Number.isFinite(v))) return null;
    const a = allowAlpha ? clamp01(values.a ?? components.a) : 1;
    return { r: clamp255(values.r), g: clamp255(values.g), b: clamp255(values.b), a };
  };

  const readHslaInputs = () => {
    const values = {};
    hslaInputs.forEach((input) => {
      values[input.dataset.key] = Number.parseFloat(input.value);
    });
    if ([values.h, values.s, values.l].some((v) => !Number.isFinite(v))) return null;
    const a = allowAlpha ? clamp01(values.a ?? components.a) : 1;
    const rgb = hslToRgb(values.h, values.s, values.l);
    return { r: rgb.r, g: rgb.g, b: rgb.b, a };
  };

  const readHexInput = () => {
    const parsed = parseHexToRgba(hexInput.value);
    if (!parsed) return null;
    if (!allowAlpha) parsed.a = 1;
    return parsed;
  };

  const drawSvPicker = () => {
    const ctx = svCanvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = svCanvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(0, 0, width, height);
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, "rgba(255,255,255,1)");
    whiteGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, "rgba(0,0,0,0)");
    blackGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
    const x = hsv.s * width;
    const y = (1 - hsv.v) * height;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawHuePicker = () => {
    const ctx = hueCanvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = hueCanvas;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 360; i += 60) {
      grad.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    const x = (hsv.h / 360) * width;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, height / 2, 6, 0, Math.PI * 2);
    ctx.stroke();
  };

  const updateFromRgba = (rgba) => {
    const next = {
      r: clamp255(rgba.r),
      g: clamp255(rgba.g),
      b: clamp255(rgba.b),
      a: allowAlpha ? clamp01(rgba.a) : 1,
    };
    rgbaInputs.find((input) => input.dataset.key === "r").value = `${next.r}`;
    rgbaInputs.find((input) => input.dataset.key === "g").value = `${next.g}`;
    rgbaInputs.find((input) => input.dataset.key === "b").value = `${next.b}`;
    if (allowAlpha) {
      rgbaInputs.find((input) => input.dataset.key === "a").value = `${next.a}`;
    }
    const nextHsl = rgbToHsl(next.r, next.g, next.b);
    hslaInputs.find((input) => input.dataset.key === "h").value = `${Math.round(nextHsl.h)}`;
    hslaInputs.find((input) => input.dataset.key === "s").value = `${Math.round(nextHsl.s)}`;
    hslaInputs.find((input) => input.dataset.key === "l").value = `${Math.round(nextHsl.l)}`;
    if (allowAlpha) {
      hslaInputs.find((input) => input.dataset.key === "a").value = `${next.a}`;
    }
    hexInput.value = allowAlpha
      ? rgbToHex8(next.r, next.g, next.b, next.a)
      : rgbToHex6(next.r, next.g, next.b);
    preview.style.backgroundColor = rgbaString(next, allowAlpha);
    preview.style.backgroundImage =
      allowAlpha && next.a < 1 ? checkerboardBg : "none";
    preview.style.backgroundImage =
      allowAlpha && next.a < 1 ? checkerboardBg : "none";
    if (allowAlpha) {
      alphaInput.value = `${next.a}`;
    }
    hsv = rgbToHsv(next.r, next.g, next.b);
    drawSvPicker();
    drawHuePicker();
  };

  const updatePreview = () => {
    const rgba = readRgbaInputs() || readHslaInputs() || readHexInput();
    if (!rgba) return;
    updateFromRgba(rgba);
  };

  [...rgbaInputs, ...hslaInputs, hexInput].forEach((input) => {
    input.addEventListener("input", updatePreview);
  });
  alphaInput.addEventListener("input", () => {
    if (!allowAlpha) return;
    const val = clamp01(Number.parseFloat(alphaInput.value));
    rgbaInputs.find((input) => input.dataset.key === "a").value = `${val}`;
    hslaInputs.find((input) => input.dataset.key === "a").value = `${val}`;
    updatePreview();
  });
  const handleSvPointer = (event) => {
    const rect = svCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    hsv.s = rect.width ? x / rect.width : 0;
    hsv.v = rect.height ? 1 - y / rect.height : 0;
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const alpha = allowAlpha ? clamp01(Number.parseFloat(alphaInput.value)) : 1;
    updateFromRgba({ r: rgb.r, g: rgb.g, b: rgb.b, a: alpha });
  };
  const handleHuePointer = (event) => {
    const rect = hueCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    hsv.h = rect.width ? (x / rect.width) * 360 : 0;
    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const alpha = allowAlpha ? clamp01(Number.parseFloat(alphaInput.value)) : 1;
    updateFromRgba({ r: rgb.r, g: rgb.g, b: rgb.b, a: alpha });
  };
  const bindDrag = (element, handler) => {
    let active = false;
    const onMove = (event) => {
      if (!active) return;
      handler(event);
    };
    const onUp = () => {
      active = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    element.addEventListener("mousedown", (event) => {
      active = true;
      handler(event);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
  };
  bindDrag(svCanvas, handleSvPointer);
  bindDrag(hueCanvas, handleHuePointer);
  updatePreview();
  reset.addEventListener("click", () => {
    const parsed = parseColorComponents(defaultColor);
    updateFromRgba(parsed);
  });
  cancel.addEventListener("click", () => overlay.remove());
  apply.addEventListener("click", () => {
    const rgba = readRgbaInputs() || readHslaInputs() || readHexInput();
    if (!rgba) {
      overlay.remove();
      return;
    }
    const next = allowAlpha
      ? rgbToHex8(rgba.r, rgba.g, rgba.b, rgba.a)
      : rgbToHex6(rgba.r, rgba.g, rgba.b);
    onApply(next);
    overlay.remove();
  });

}
