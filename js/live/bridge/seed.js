function isValidLinkId(link) {
  return Number.isInteger(link) && link >= 0;
}

export function getInputLink(node, name) {
  const input = node?.inputs?.find((inp) => inp?.name === name);
  if (!input || !isValidLinkId(input.link)) return null;
  let linkId = input.link;
  let link = null;
  let origin = null;
  for (let hop = 0; hop < 8; hop += 1) {
    link = node.graph?.links?.[linkId];
    if (!link) return null;
    origin = node.graph?._nodes_by_id?.[link.origin_id];
    if (!origin) return null;
    const isReroute = origin?.type === "Reroute" || origin?.comfyClass === "Reroute";
    if (!isReroute) {
      return { link, origin };
    }
    const rerouteInput = origin.inputs?.[0];
    if (!rerouteInput || !isValidLinkId(rerouteInput.link)) {
      return { link, origin };
    }
    linkId = rerouteInput.link;
  }
  return null;
}

function getInputValue(node, name) {
  const idx = node?.inputs?.findIndex((inp) => inp?.name === name);
  if (idx == null || idx < 0) return null;
  const input = node.inputs[idx];
  if (!isValidLinkId(input?.link)) return null;
  if (typeof node.getInputData !== "function") return null;
  const value = node.getInputData(idx);
  let candidate = value;
  if (value && typeof value === "object") {
    if ("value" in value) {
      candidate = value.value;
    } else if ("seed" in value) {
      candidate = value.seed;
    }
  }
  const coerced = coerceInt(candidate);
  return coerced != null ? coerced : null;
}

export function coerceInt(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  return null;
}

function getLinkedInputValue(node, name) {
  const resolved = getInputLink(node, name);
  if (!resolved) return null;
  const { link, origin } = resolved;
  const output = origin.outputs?.[link.origin_slot];
  if (output && output.value !== undefined) {
    const coerced = coerceInt(output.value);
    if (coerced != null) return coerced;
  }
  const outputName = output?.name;
  if (outputName && origin.widgets) {
    const widgetIndex = origin.widgets.findIndex((w) => w.name === outputName);
    if (widgetIndex >= 0) {
      const widgetValue = origin.widgets[widgetIndex]?.value;
      const coerced = coerceInt(widgetValue);
      if (coerced != null) return coerced;
      if (origin.widgets_values && origin.widgets_values.length > widgetIndex) {
        const coercedStored = coerceInt(origin.widgets_values[widgetIndex]);
        if (coercedStored != null) return coercedStored;
      }
    }
  }
  if (origin.widgets_values && origin.widgets_values.length) {
    const coerced = coerceInt(origin.widgets_values[0]);
    if (coerced != null) return coerced;
  }
  if (origin.widgets && origin.widgets.length) {
    const coerced = coerceInt(origin.widgets[0]?.value);
    if (coerced != null) return coerced;
  }
  return null;
}

export function isSeedLinked(node) {
  return !!getInputLink(node, "seed");
}

function resolveSeed(value, allowRandomize) {
  const coerced = coerceInt(value);
  if (coerced == null) return null;
  if (coerced < 0) {
    if (!allowRandomize) return null;
    const max = 0xffffffff;
    return Math.floor(Math.random() * (max + 1));
  }
  return coerced;
}

export function getSeedValue(node, options = {}) {
  const allowRandomize = options.allowRandomize === true;
  // When the seed input is linked, linked node values are the source of truth.
  // getInputData can carry stale cached values (for example 0 before upstream execution),
  // which can incorrectly override the linked seed widget value.
  if (isSeedLinked(node)) {
    const linkedPreferred = getLinkedInputValue(node, "seed");
    const linkedPreferredResolved = resolveSeed(linkedPreferred, allowRandomize);
    if (linkedPreferredResolved != null) return linkedPreferredResolved;
  }
  const liveInput = getInputValue(node, "seed");
  const liveResolved = resolveSeed(liveInput, allowRandomize);
  if (liveResolved != null) return liveResolved;
  const linked = getLinkedInputValue(node, "seed");
  const linkedResolved = resolveSeed(linked, allowRandomize);
  if (linkedResolved != null) return linkedResolved;
  const seedWidget = node.widgets?.find((w) => w.name === "seed");
  const fallback = resolveSeed(seedWidget?.value, allowRandomize);
  return fallback != null ? fallback : 0;
}

export function ensureSeedControlWidget(node) {
  if (!node?.widgets) return;
  const existing = node.widgets.find((w) => w.name === "control_after_generate");
  if (existing) return;
  const seedIndex = node.widgets.findIndex((w) => w.name === "seed");
  if (seedIndex < 0) return;
  const widget = node.addWidget(
    "combo",
    "control_after_generate",
    "randomize",
    () => {},
    { values: ["randomize", "increment", "decrement", "fixed"] }
  );
  const currentIndex = node.widgets.indexOf(widget);
  if (currentIndex >= 0) {
    node.widgets.splice(currentIndex, 1);
    node.widgets.splice(seedIndex + 1, 0, widget);
  }
}

export function applySeedAfterGenerate(node) {
  if (isSeedLinked(node)) return;
  if (!node?.widgets) return;
  const seedWidget = node.widgets.find((w) => w.name === "seed");
  const controlWidget = node.widgets.find((w) => w.name === "control_after_generate");
  if (!seedWidget || !controlWidget) return;
  let mode = controlWidget.value;
  const controlIndex = node.widgets.indexOf(controlWidget);
  if (!mode && controlIndex >= 0 && node.widgets_values) {
    mode = node.widgets_values[controlIndex];
  }
  mode = `${mode || ""}`.toLowerCase();
  if (mode === "fixed") return;
  const min = coerceInt(seedWidget.options?.min) ?? 0;
  const maxOption = seedWidget.options?.max;
  if (maxOption != null && !Number.isSafeInteger(maxOption)) {
    return;
  }
  const max =
    Number.isFinite(maxOption) && Number.isSafeInteger(maxOption)
      ? maxOption
      : 0x7fffffff;
  const current = coerceInt(seedWidget.value) ?? min;
  let next = current;
  if (mode === "increment") {
    next = current >= max ? min : current + 1;
  } else if (mode === "decrement") {
    next = current <= min ? max : current - 1;
  } else if (mode === "randomize") {
    next = Math.floor(Math.random() * (max - min + 1)) + min;
  }
  seedWidget.value = next;
  const seedIndex = node.widgets.indexOf(seedWidget);
  if (!node.widgets_values) node.widgets_values = [];
  if (seedIndex >= 0) node.widgets_values[seedIndex] = next;
}
