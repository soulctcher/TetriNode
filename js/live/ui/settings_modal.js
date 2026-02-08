import { cloneDeep } from "../config/store.js";
import { CONTROL_ACTION_LABELS, CONTROL_ACTIONS } from "../data/controls.js";
import { DEFAULT_CONFIG } from "../data/defaults.js";
import { findBindingConflict, formatKeyLabel, normalizeBindingValue } from "../input/bindings.js";

export function openSettingsModal(node, deps) {
  const { createModalBase, ensureUiState } = deps;
  const { body } = createModalBase(node, "Settings");
  const ui = ensureUiState(node);
  if (ui.modal) {
    ui.modal.kind = "settings";
    ui.modal.activeTab = "settings";
  }
  renderSettingsModal(node, body, "settings", deps);
}

export function renderSettingsModal(node, body, activeTab = "settings", deps) {
  const {
    ensureUiState,
    getThemeColors,
    renderAnimationModal,
    renderMusicModal,
    renderBlockStyleModal,
    renderColorsModal,
    renderThemeModal,
    renderGameplayModal,
    applyModalThemeStyles,
  } = deps;

  body.innerHTML = "";
  const ui = ensureUiState(node);
  if (ui.modal) {
    ui.modal.kind = "settings";
    ui.modal.activeTab = activeTab;
  }
  const tabs = [
    { id: "settings", label: "Settings" },
    { id: "controls", label: "Controls" },
    { id: "block_style", label: "Block Style" },
    { id: "colors", label: "Colors" },
    { id: "theme", label: "UI Themes" },
    { id: "animation", label: "Animation" },
    { id: "music", label: "Music" },
  ];
  const tabRow = document.createElement("div");
  tabRow.style.display = "flex";
  tabRow.style.flexWrap = "wrap";
  tabRow.style.gap = "8px";
  tabRow.style.borderBottom = `1px solid ${getThemeColors(node).panel_border}`;
  tabRow.style.borderBottomColor = getThemeColors(node).panel_border;
  tabRow.style.paddingBottom = "0";
  tabRow.style.marginBottom = "0";
  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    let underlineIndex = 0;
    if (tab.id === "colors") {
      underlineIndex = tab.label.indexOf("o");
    }
    if (underlineIndex < 0) {
      underlineIndex = 0;
    }
    const before = tab.label.slice(0, underlineIndex);
    const under = tab.label.slice(underlineIndex, underlineIndex + 1);
    const after = tab.label.slice(underlineIndex + 1);
    const label = document.createElement("span");
    const firstSpan = document.createElement("span");
    firstSpan.textContent = under;
    firstSpan.style.textDecoration = "underline";
    if (before) {
      const beforeSpan = document.createElement("span");
      beforeSpan.textContent = before;
      label.appendChild(beforeSpan);
    }
    label.appendChild(firstSpan);
    if (after) {
      const afterSpan = document.createElement("span");
      afterSpan.textContent = after;
      label.appendChild(afterSpan);
    }
    btn.appendChild(label);
    btn.dataset.tnTab = "true";
    btn.dataset.tnActive = tab.id === activeTab ? "true" : "false";
    btn.addEventListener("click", () => {
      renderSettingsModal(node, body, tab.id, deps);
    });
    tabRow.appendChild(btn);
  });
  const panel = document.createElement("div");
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.gap = "8px";
  body.append(tabRow, panel);
  if (activeTab === "controls") {
    renderControlsModal(node, panel, deps);
  } else if (activeTab === "animation") {
    renderAnimationModal(node, panel);
  } else if (activeTab === "music") {
    renderMusicModal(node, panel);
  } else if (activeTab === "block_style") {
    renderBlockStyleModal(node, panel);
  } else if (activeTab === "colors") {
    renderColorsModal(node, panel);
  } else if (activeTab === "theme") {
    renderThemeModal(node, panel);
  } else {
    renderGameplayModal(node, panel);
  }
  const modalEl = body.parentElement || body;
  if (modalEl) {
    if (activeTab === "block_style") {
      modalEl.style.minWidth = "720px";
      modalEl.style.maxWidth = "80vw";
      modalEl.style.width = "";
    } else {
      modalEl.style.minWidth = "360px";
      modalEl.style.maxWidth = "70vw";
      modalEl.style.width = "";
    }
  }
  applyModalThemeStyles(node, modalEl);
}

export function renderControlsModal(node, body, deps) {
  const {
    ensureUiState,
    getConfig,
    getThemeColors,
    updateConfig,
    updateBackendState,
    applyModalThemeStyles,
  } = deps;

  body.innerHTML = "";
  const ui = ensureUiState(node);
  const config = getConfig(node);
  const theme = getThemeColors(node);
  const showBorders = config.theme !== "flat" && config.theme !== "minimal";
  const actions = CONTROL_ACTIONS;
  const renderConfirmPrompt = () => {
    const prompt = ui.confirmPrompt;
    if (!prompt) return;
    const panel = document.createElement("div");
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "8px";
    panel.style.padding = "10px";
    panel.style.borderRadius = "8px";
    panel.style.background = theme.panel_bg;
    panel.style.border = `1px solid ${theme.panel_border}`;
    panel.style.boxShadow = `0 6px 14px ${theme.panel_shadow}`;
    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.textContent = prompt.title || "Confirm";
    const message = document.createElement("div");
    message.style.whiteSpace = "pre-line";
    message.textContent = Array.isArray(prompt.lines)
      ? prompt.lines.join("\n")
      : `${prompt.lines || ""}`;
    const actionsRow = document.createElement("div");
    actionsRow.style.display = "flex";
    actionsRow.style.gap = "8px";
    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = prompt.confirmLabel || "Confirm";
    confirmBtn.addEventListener("click", () => {
      const onConfirm = prompt.onConfirm;
      ui.confirmPrompt = null;
      if (onConfirm) onConfirm();
      renderControlsModal(node, body, deps);
    });
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = prompt.cancelLabel || "Cancel";
    cancelBtn.addEventListener("click", () => {
      const onCancel = prompt.onCancel;
      ui.confirmPrompt = null;
      if (onCancel) onCancel();
      renderControlsModal(node, body, deps);
    });
    actionsRow.append(confirmBtn, cancelBtn);
    panel.append(title, message, actionsRow);
    body.appendChild(panel);
  };
  const hint = document.createElement("div");
  hint.style.fontSize = "12px";
  hint.style.opacity = "0.8";
  hint.textContent = ui.captureAction
    ? `Press a key for ${actions.find((action) => action.id === ui.captureAction)?.label || ""} (Esc to cancel)`
    : "Click Add to capture a key binding.";
  body.appendChild(hint);
  renderConfirmPrompt();
  if (ui.captureAction) {
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel Capture";
    cancel.addEventListener("click", () => {
      ui.captureAction = null;
      renderControlsModal(node, body, deps);
    });
    body.appendChild(cancel);
  }

  actions.forEach((action) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "120px 1fr auto auto";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const label = document.createElement("div");
    label.textContent = action.label;
    const keys = document.createElement("div");
    keys.style.display = "flex";
    keys.style.gap = "6px";
    keys.style.flexWrap = "wrap";
    const values = Array.isArray(config.bindings[action.id]) ? config.bindings[action.id] : [];
    values.forEach((value) => {
      const chip = document.createElement("div");
      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.gap = "4px";
      chip.style.padding = "2px 6px";
      chip.style.borderRadius = "10px";
      chip.style.background = "rgba(255,255,255,0.08)";
      if (showBorders) {
        chip.style.border = `1px solid ${theme.panel_border}`;
      } else {
        chip.style.border = "none";
      }
      const text = document.createElement("span");
      text.textContent = formatKeyLabel(value);
      const remove = document.createElement("button");
      remove.textContent = "X";
      remove.style.border = "none";
      remove.style.background = "transparent";
      remove.style.cursor = "pointer";
      remove.addEventListener("click", () => {
        updateConfig(node, (next) => {
          next.bindings[action.id] = next.bindings[action.id].filter((binding) => binding !== value);
          return next;
        });
        updateBackendState(node);
        renderControlsModal(node, body, deps);
      });
      chip.append(text, remove);
      keys.appendChild(chip);
    });
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.addEventListener("click", () => {
      ui.confirmPrompt = null;
      ui.captureAction = action.id;
      renderControlsModal(node, body, deps);
    });
    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", () => {
      const defaults = cloneDeep(DEFAULT_CONFIG.bindings[action.id] || []);
      const latestConfig = getConfig(node);
      const conflicts = [];
      defaults.forEach((value) => {
        const conflictId = findBindingConflict(latestConfig.bindings, action.id, value);
        if (conflictId) {
          conflicts.push({ key: value, action: conflictId });
        }
      });
      const applyReset = () => {
        updateConfig(node, (next) => {
          next.bindings[action.id] = defaults;
          if (conflicts.length) {
            conflicts.forEach((conflict) => {
              const list = Array.isArray(next.bindings[conflict.action])
                ? next.bindings[conflict.action]
                : [];
              next.bindings[conflict.action] = list.filter(
                (value) => normalizeBindingValue(value) !== normalizeBindingValue(conflict.key),
              );
            });
          }
          return next;
        });
        updateBackendState(node);
      };
      if (conflicts.length) {
        const lines = conflicts.map((conflict) =>
          `• ${formatKeyLabel(conflict.key)} is assigned to ${CONTROL_ACTION_LABELS[conflict.action] || conflict.action}`,
        );
        ui.confirmPrompt = {
          title: "Reset keys?",
          lines: [
            "Resetting will remove keys from other controls:",
            ...lines,
          ],
          confirmLabel: "Reset",
          cancelLabel: "Cancel",
          onConfirm: () => {
            applyReset();
          },
          onCancel: null,
        };
        renderControlsModal(node, body, deps);
        return;
      }
      applyReset();
      renderControlsModal(node, body, deps);
    });
    row.append(label, keys, addBtn, resetBtn);
    body.appendChild(row);
    const divider = document.createElement("div");
    divider.style.height = "1px";
    divider.style.margin = "6px 0";
    divider.style.background = theme.panel_border;
    divider.style.opacity = "0.3";
    body.appendChild(divider);
  });
  const modalEl = body.parentElement || body;
  applyModalThemeStyles(node, modalEl);
}
