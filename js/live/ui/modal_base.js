import { DEFAULT_CONFIG } from "../data/defaults.js";
import { serializeState } from "../core/gameplay.js";

export function closeModal(node, ensureUiState, syncMusicFromConfig) {
  const ui = ensureUiState(node);
  if (ui.modal?.el) {
    ui.modal.el.remove();
  }
  ui.modal = null;
  ui.captureAction = null;
  ui.confirmPrompt = null;
  syncMusicFromConfig(node, true);
}

export function pauseForModal(node, syncMusicFromConfig) {
  const live = node.__tetrisLive;
  if (!live) return;
  live.state.running = false;
  live.state.showBoardWhilePaused = true;
  node.setDirtyCanvas(true, true);
  syncMusicFromConfig(node, true);
}

export function createModalBase(node, title, keepExisting = false, deps) {
  const {
    closeModal,
    pauseForModal,
    getConfig,
    getThemeColors,
    toOpaqueColor,
    getThemeCornerRadius,
    ensureUiState,
  } = deps;

  if (!keepExisting) {
    closeModal(node);
  }
  pauseForModal(node);
  const config = getConfig(node);
  const theme = getThemeColors(node);
  const themeSettings = config.theme_settings || DEFAULT_CONFIG.theme_settings;
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.left = "50%";
  modal.style.top = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.minWidth = "360px";
  modal.style.maxWidth = "70vw";
  modal.style.maxHeight = "70vh";
  const modalBg = toOpaqueColor(theme.panel_bg);
  modal.style.background = modalBg;
  const showBorder = title === "Theme" || (config.theme !== "flat" && config.theme !== "minimal");
  modal.style.border = showBorder ? `1px solid ${theme.panel_border}` : "none";
  if (config.theme === "neon") {
    const glow = themeSettings.neon_glow || 8;
    modal.style.boxShadow = `0 0 ${glow}px ${theme.panel_border}, 0 10px 30px ${theme.panel_shadow}`;
  } else {
    modal.style.boxShadow = `0 10px 30px ${theme.panel_shadow}`;
  }
  modal.style.color = theme.text;
  modal.style.backdropFilter = "none";
  modal.style.padding = "12px";
  modal.style.borderRadius = `${getThemeCornerRadius(node)}px`;
  modal.style.zIndex = "9999";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.gap = "10px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.cursor = "move";
  header.style.fontWeight = "600";
  header.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "X";
  closeBtn.style.marginLeft = "12px";
  closeBtn.style.border = "none";
  closeBtn.style.background = "transparent";
  closeBtn.style.color = theme.text;
  closeBtn.style.cursor = "pointer";
  closeBtn.addEventListener("click", () => {
    if (keepExisting) {
      modal.remove();
    } else {
      closeModal(node);
    }
  });
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  body.style.overflow = "auto";
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "8px";

  modal.appendChild(header);
  modal.appendChild(body);
  document.body.appendChild(modal);

  let drag = null;
  header.addEventListener("mousedown", (event) => {
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      rect: modal.getBoundingClientRect(),
    };
    event.preventDefault();
  });
  window.addEventListener("mousemove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    modal.style.left = `${drag.rect.left + dx}px`;
    modal.style.top = `${drag.rect.top + dy}px`;
    modal.style.transform = "translate(0, 0)";
  });
  window.addEventListener("mouseup", () => {
    drag = null;
  });

  if (!keepExisting) {
    ensureUiState(node).modal = {
      el: modal,
      body,
      title,
      kind: "generic",
      activeTab: null,
    };
  }
  return { modal, body };
}

export function openLoadStateModal(node, deps) {
  const { createModalBase, loadStateFromText, closeModal } = deps;
  const { body } = createModalBase(node, "Load State");
  const textarea = document.createElement("textarea");
  textarea.style.width = "100%";
  textarea.style.minHeight = "140px";
  textarea.placeholder = "Paste state JSON here...";
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.addEventListener("click", () => {
    loadStateFromText(node, textarea.value);
  });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => closeModal(node));
  actions.append(loadBtn, closeBtn);
  body.append(textarea, actions);
}

export function openSaveStateModal(node, deps) {
  const { createModalBase, closeModal } = deps;
  const { body } = createModalBase(node, "Save State");
  const live = node.__tetrisLive;
  const state = live?.state;
  const textarea = document.createElement("textarea");
  textarea.style.width = "100%";
  textarea.style.minHeight = "180px";
  textarea.value = state ? serializeState(state) : "";
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.justifyContent = "flex-end";
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textarea.value).catch(() => {});
    }
  });
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => closeModal(node));
  actions.append(copyBtn, closeBtn);
  body.append(textarea, actions);
}
