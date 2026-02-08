import { app } from "../../scripts/app.js";
import {
  BRUSHED_METAL_TEXTURE_DATA,
  CONCRETE_TEXTURE_DATA,
  PIXELATED_TEXTURE_DATA,
  TOXIC_SLIME_TEXTURE_DATA,
  WOODEN_TEXTURE_DATA,
} from "./textures.js";
import { CONTROL_ACTION_LABELS } from "./live/data/controls.js";
import { COLORS } from "./live/data/colors.js";
import { DEFAULT_CONFIG } from "./live/data/defaults.js";
import {
  INFO_ICON_PATH,
  INFO_ICON_VIEWBOX,
  LOAD_ICON_PATH,
  LOAD_ICON_VIEWBOX,
  PAUSE_ICON_PATH,
  PAUSE_ICON_VIEWBOX,
  PLAY_ICON_PATH,
  PLAY_ICON_VIEWBOX,
  RESET_ICON_PATH,
  RESET_ICON_VIEWBOX,
  SETTINGS_ICON_PATH,
  SETTINGS_ICON_VIEWBOX,
} from "./live/data/icons.js";
import { MUSIC_TRACKS } from "./live/data/music_tracks.js";
import { SHAPES } from "./live/data/shapes.js";
import { THEME_PRESETS } from "./live/data/theme_presets.js";
import { THEME_USED_KEYS } from "./live/data/theme_used_keys.js";
import {
  ARR_MS,
  DAS_MS,
  GRID_H_TOTAL,
  GRID_H_VISIBLE,
  GRID_W,
  HEADER_H,
  HIDDEN_ROWS,
  PADDING,
  PREVIEW_GRID,
  PREVIEW_SCALE,
  SPAWN_Y,
  TOOLBAR_H,
} from "./live/constants.js";
import {
  cloneDeep,
  getColorPalette,
  getConfig,
  getGridColor,
  getGridEnabled,
  getOptionsForState,
  getQueueSize,
  getShowControls,
  isGhostEnabled,
  normalizeColor,
  updateConfig as updateStoredConfig,
} from "./live/config/store.js";
import {
  bindingFromEvent,
  findBindingConflict,
  formatKeyLabel,
  formatTimeMs,
  getControlBindings,
  keyMatches,
  normalizeBindingValue,
} from "./live/input/bindings.js";
import { createToolbarInteractionHandlers } from "./live/input/toolbar_actions.js";
import { createRuntimeKeyHandlers } from "./live/input/runtime_keys.js";
import {
  applySeedAfterGenerate,
  ensureSeedControlWidget,
  getInputLink,
  getSeedValue,
} from "./live/bridge/seed.js";
import { createComfyHooks } from "./live/bridge/comfy_hooks.js";
import { createBackendStateHelpers } from "./live/bridge/backend_state.js";
import { createBackgroundImageHelpers } from "./live/bridge/background_source.js";
import { createMusicController } from "./live/bridge/music_controller.js";
import { createNodeSelectionHelpers } from "./live/bridge/node_selection.js";
import { createNodeRuntimeHelpers } from "./live/bridge/node_runtime.js";
import { createStateIoHelpers } from "./live/bridge/state_io.js";
import {
  applyPendingClear,
  clampLevel,
  collides,
  createState,
  ensurePieceTextureTransforms,
  getPreviewTextureTransforms,
  getUiPreviewTextureTransforms,
  getUpcomingShapes,
  hardDrop,
  holdPiece,
  hydrateState,
  move,
  pieceCells,
  rotate,
  serializeState,
  settlePiece,
  stepDown,
  updateLevel,
} from "./live/core/gameplay.js";
import { createLockRepeatHelpers } from "./live/core/lock_repeat.js";
import { createRuntimeLoopHelpers } from "./live/core/runtime_loop.js";
import { createRuntimeStateHelpers } from "./live/core/runtime_state.js";
import {
  adjustColorByFactor,
  adjustColorHsl,
  applySwatchBackground,
  buildThemePaletteFromSwatch,
  clamp01,
  clamp255,
  colorToHex,
  colorWithAlpha,
  getContrastTextColor,
  hslToRgb,
  hsvToRgb,
  mixColors,
  parseColorComponents,
  parseHexToRgba,
  rgbToHex6,
  rgbToHex8,
  rgbToHsl,
  rgbToHsv,
  rgbaString,
  toOpaqueColor,
} from "./live/core/color_utils.js";
import { drawBoardBackground, drawBoardGrid } from "./live/render/board.js";
import { createBlockStyleHelpers } from "./live/render/block_style.js";
import { createRenderEffects } from "./live/render/effects.js";
import { getLayout } from "./live/render/layout.js";
import { createNodeCanvasHelpers } from "./live/render/node_canvas.js";
import { createStatusOverlayHelpers } from "./live/render/status_overlay.js";
import { createToolbarIconHelpers } from "./live/render/toolbar_icons.js";
import { createToolbarRenderer } from "./live/render/toolbar.js";
import {
  closeModal as closeModalUi,
  createModalBase as createModalBaseUi,
  openLoadStateModal as openLoadStateModalUi,
  openSaveStateModal as openSaveStateModalUi,
  pauseForModal as pauseForModalUi,
} from "./live/ui/modal_base.js";
import {
  openSettingsModal as openSettingsModalUi,
  renderControlsModal as renderControlsModalUi,
  renderSettingsModal as renderSettingsModalUi,
} from "./live/ui/settings_modal.js";
import { renderColorsModal as renderColorsModalUi } from "./live/ui/colors_modal.js";
import {
  renderAnimationModal as renderAnimationModalUi,
  renderMusicModal as renderMusicModalUi,
} from "./live/ui/animation_music_modal.js";
import { renderGameplayModal as renderGameplayModalUi } from "./live/ui/gameplay_modal.js";
import { renderBlockStyleModal as renderBlockStyleModalUi } from "./live/ui/block_style_modal.js";
import { renderThemeModal as renderThemeModalUi } from "./live/ui/theme_modal.js";
import { openColorPicker as openColorPickerUi } from "./live/ui/color_picker_modal.js";
import { createThemeStyleHelpers } from "./live/ui/theme_style.js";

const EXT_NAME = "tetrinode.live";
const NODE_CLASS = "TetriNode";

const {
  getSelectedLiveNode,
  getCaptureNode,
  isNodeSelected,
} = createNodeSelectionHelpers({
  app,
  nodeClass: NODE_CLASS,
});

const IMAGE_CACHE = new Map();
const TETRINODE_VERSION = "2.3.0";
const {
  getBackgroundSource,
} = createBackgroundImageHelpers({
  app,
  getInputLink,
  imageCache: IMAGE_CACHE,
});

const {
  ensureMusicState,
  clampMusicVolume,
  setMusicVolume,
  toggleMusicMute,
  setMusicTrack,
  setCustomMusicFile,
  unlockMusic,
  toggleMusicPreview,
  resolveMusicTrackUrl,
  syncMusicFromConfig,
} = createMusicController({
  ensureUiState,
  getConfig,
  updateStoredConfig,
  musicTracks: MUSIC_TRACKS,
});

const {
  drawLoadIcon,
  drawSaveIcon,
  drawResetIcon,
  drawPauseIcon,
  drawPlayIcon,
  drawSettingsIcon,
  drawSpeakerIcon,
} = createToolbarIconHelpers({
  load: { viewbox: LOAD_ICON_VIEWBOX, path: LOAD_ICON_PATH },
  reset: { viewbox: RESET_ICON_VIEWBOX, path: RESET_ICON_PATH },
  pause: { viewbox: PAUSE_ICON_VIEWBOX, path: PAUSE_ICON_PATH },
  play: { viewbox: PLAY_ICON_VIEWBOX, path: PLAY_ICON_PATH },
  settings: { viewbox: SETTINGS_ICON_VIEWBOX, path: SETTINGS_ICON_PATH },
});

const {
  getThemeCornerRadius,
  drawPanelBox,
  applyModalThemeStyles,
  applyBorderGlow,
  clearBorderGlow,
} = createThemeStyleHelpers({
  getConfig,
  getThemeColors,
  defaultConfig: DEFAULT_CONFIG,
  toOpaqueColor,
});

const {
  buildToolbarButtons,
  drawToolbar,
} = createToolbarRenderer({
  ensureUiState,
  getConfig,
  syncMusicFromConfig,
  getThemeColors,
  defaultConfig: DEFAULT_CONFIG,
  clampMusicVolume,
  toolbarHeight: TOOLBAR_H,
  headerHeight: HEADER_H,
  padding: PADDING,
  getThemeCornerRadius,
  drawLoadIcon,
  drawSaveIcon,
  drawResetIcon,
  drawPauseIcon,
  drawPlayIcon,
  drawSettingsIcon,
  drawSpeakerIcon,
});

const lockRepeatHelpers = createLockRepeatHelpers({
  collides,
  move,
  dasMs: DAS_MS,
  arrMs: ARR_MS,
});

const {
  applyLockModeAfterAction,
  setMoveDirection,
  clearMoveDirection,
} = lockRepeatHelpers;

const {
  ghostLandingY,
  drawGhostPiece,
  drawTetrisGlow,
  drawHardDropTrail,
  drawActionToast,
} = createRenderEffects({
  collides,
  pieceCells,
  colorWithAlpha,
  adjustColorByFactor,
  hiddenRows: HIDDEN_ROWS,
  gridHeightTotal: GRID_H_TOTAL,
  gridWidth: GRID_W,
});

const {
  getBlockStyle,
  drawBlockSized,
} = createBlockStyleHelpers({
  getConfig,
  defaultConfig: DEFAULT_CONFIG,
  adjustColorHsl,
  mixColors,
  parseColorComponents,
  rgbaString,
  adjustColorByFactor,
  textures: {
    brushedMetalTextureData: BRUSHED_METAL_TEXTURE_DATA,
    woodenTextureData: WOODEN_TEXTURE_DATA,
    concreteTextureData: CONCRETE_TEXTURE_DATA,
    pixelatedTextureData: PIXELATED_TEXTURE_DATA,
    toxicSlimeTextureData: TOXIC_SLIME_TEXTURE_DATA,
  },
});

function getLockMode(node) {
  return lockRepeatHelpers.getLockMode(node, getConfig);
}

function updateAutoRepeat(state, node, deltaMs) {
  return lockRepeatHelpers.updateAutoRepeat(state, node, getConfig, deltaMs);
}

const {
  ensureBoardCache,
  updateBackendState,
} = createBackendStateHelpers({
  getLayout,
  getColorPalette,
  getConfig,
  getGridEnabled,
  getGridColor,
  isGhostEnabled,
  getThemeColors,
  getOptionsForState,
  getBackgroundSource,
  drawBoardBackground,
  drawBoardGrid,
  drawHardDropTrail,
  drawGhostPiece,
  drawTetrisGlow,
  drawActionToast,
  ensurePieceTextureTransforms,
  pieceCells,
  serializeState,
  drawBlockSized,
  getBlockStyle,
  adjustColorByFactor,
  colorWithAlpha,
  colors: COLORS,
  hiddenRows: HIDDEN_ROWS,
  gridWidth: GRID_W,
  gridHeightVisible: GRID_H_VISIBLE,
  gridHeightTotal: GRID_H_TOTAL,
});

const {
  ensureTimer,
  stopTimer,
  ensureBackgroundUpdater,
} = createRuntimeLoopHelpers({
  applyPendingClear,
  getConfig,
  getBackgroundSource,
  getLockMode,
  updateAutoRepeat,
  settlePiece,
  stepDown,
  updateBackendState,
  isNodeSelected,
});

const {
  validateStatePayload,
  setStatusMessage,
  resetInputState,
  getStartLevel,
  getLevelProgression,
  syncSeed,
  syncStartLevel,
  resetNode,
  togglePause,
} = createRuntimeStateHelpers({
  gridHeightTotal: GRID_H_TOTAL,
  gridWidth: GRID_W,
  getConfig,
  clampLevel,
  getSeedValue,
  createState,
  updateLevel,
  updateBackendState,
  ensureTimer,
  stopTimer,
  unlockMusic,
  syncMusicFromConfig,
});

const {
  loadStateFromText,
} = createStateIoHelpers({
  setStatusMessage,
  validateStatePayload,
  getSeedValue,
  getStartLevel,
  getLevelProgression,
  hydrateState,
  resetInputState,
  stopTimer,
  ensureTimer,
  updateBackendState,
});

const {
  applyWidgetHiding,
  updateConfig,
} = createNodeRuntimeHelpers({
  updateStoredConfig,
  syncMusicFromConfig,
});

const {
  handleKey,
  handleKeyUp,
} = createRuntimeKeyHandlers({
  getCaptureNode,
  getSelectedLiveNode,
  bindingFromEvent,
  findBindingConflict,
  formatKeyLabel,
  normalizeBindingValue,
  controlActionLabels: CONTROL_ACTION_LABELS,
  renderSettingsModal,
  renderControlsModal,
  updateConfig,
  updateBackendState,
  getConfig,
  keyMatches,
  getControlBindings,
  closeModal,
  openSettingsModal,
  resetNode,
  setMoveDirection,
  clearMoveDirection,
  move,
  applyLockModeAfterAction,
  getLockMode,
  rotate,
  hardDrop,
  holdPiece,
  togglePause,
  syncMusicFromConfig,
});

const {
  handleToolbarMouseDown,
  handleToolbarMouseMove,
  handleToolbarMouseUp,
} = createToolbarInteractionHandlers({
  ensureUiState,
  buildToolbarButtons,
  headerHeight: HEADER_H,
  toolbarHeight: TOOLBAR_H,
  unlockMusic,
  resetNode,
  togglePause,
  openLoadStateModal,
  openSaveStateModal,
  openSettingsModal,
  toggleMusicMute,
  setMusicVolume,
  syncMusicFromConfig,
});

const {
  formatPauseHint,
  drawPauseOverlay,
  formatThemeName,
  formatThemeKeyLabel,
  drawStatusMessage,
} = createStatusOverlayHelpers({
  formatKeyLabel,
  colors: COLORS,
  getThemeColors,
});

const {
  ensureWidgetDrawCapture,
  drawNode,
} = createNodeCanvasHelpers({
  applyWidgetHiding,
  syncStartLevel,
  syncSeed,
  getLayout,
  getThemeColors,
  getColorPalette,
  isGhostEnabled,
  getShowControls,
  getGridEnabled,
  getGridColor,
  getConfig,
  getBackgroundSource,
  drawBoardBackground,
  drawBoardGrid,
  applyBorderGlow,
  clearBorderGlow,
  ensureBoardCache,
  drawHardDropTrail,
  drawGhostPiece,
  colors: COLORS,
  colorWithAlpha,
  drawActionToast,
  padding: PADDING,
  previewGrid: PREVIEW_GRID,
  previewScale: PREVIEW_SCALE,
  getControlBindings,
  formatKeyLabel,
  formatTimeMs,
  getQueueSize,
  getUpcomingShapes,
  shapes: SHAPES,
  getPreviewTextureTransforms,
  drawBlockSized,
  drawPanelBox,
  hiddenRows: HIDDEN_ROWS,
  gridHeightTotal: GRID_H_TOTAL,
  gridWidth: GRID_W,
  drawPauseOverlay,
  formatPauseHint,
  drawStatusMessage,
  drawToolbar,
  ensurePieceTextureTransforms,
  pieceCells,
});

function getThemeColors(node) {
  const config = getConfig(node);
  const theme = config.theme && config.theme_colors?.[config.theme] ? config.theme : "glass";
  return config.theme_colors?.[theme] || THEME_PRESETS[theme];
}

function ensureUiState(node) {
  if (!node.__tetrisUi) {
    node.__tetrisUi = {
      toolbarButtons: [],
      hoverButton: null,
      modal: null,
      captureAction: null,
      confirmPrompt: null,
      blockStylePreset: "Flat (default)",
      blockStylePresetBaseFull: "Flat (default)",
      blockStylePresetBaseLabel: "Flat",
      music: null,
    };
  }
  return node.__tetrisUi;
}

function closeModal(node) {
  closeModalUi(node, ensureUiState, syncMusicFromConfig);
}

function pauseForModal(node) {
  pauseForModalUi(node, syncMusicFromConfig);
}

function createModalBase(node, title, keepExisting = false) {
  return createModalBaseUi(node, title, keepExisting, {
    closeModal,
    pauseForModal,
    getConfig,
    getThemeColors,
    toOpaqueColor,
    getThemeCornerRadius,
    ensureUiState,
  });
}

function openLoadStateModal(node) {
  openLoadStateModalUi(node, {
    createModalBase,
    loadStateFromText,
    closeModal,
  });
}

function openSaveStateModal(node) {
  openSaveStateModalUi(node, {
    createModalBase,
    closeModal,
  });
}

function openSettingsModal(node) {
  openSettingsModalUi(node, getSettingsModalDeps());
}

function renderSettingsModal(node, body, activeTab = "settings") {
  renderSettingsModalUi(node, body, activeTab, getSettingsModalDeps());
}

function renderControlsModal(node, body) {
  renderControlsModalUi(node, body, getSettingsModalDeps());
}

function getSettingsModalDeps() {
  return {
    createModalBase,
    ensureUiState,
    getThemeColors,
    renderAnimationModal,
    renderMusicModal,
    renderBlockStyleModal,
    renderColorsModal,
    renderThemeModal,
    renderGameplayModal,
    applyModalThemeStyles,
    getConfig,
    updateConfig,
    updateBackendState,
  };
}

function createTetrominoLabel(shape, color, cellSize = 14) {
  if (!shape || !SHAPES[shape]) {
    const label = document.createElement("div");
    label.textContent = shape || "";
    return label;
  }
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  wrapper.setAttribute("aria-label", shape);
  const cells = SHAPES[shape][0];
  let minX = 99;
  let minY = 99;
  let maxX = -99;
  let maxY = -99;
  cells.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  wrapper.style.width = `${width * cellSize}px`;
  wrapper.style.height = `${height * cellSize}px`;
  cells.forEach(([x, y]) => {
    const block = document.createElement("div");
    block.style.position = "absolute";
    block.style.left = `${(x - minX) * cellSize}px`;
    block.style.top = `${(y - minY) * cellSize}px`;
    block.style.width = `${cellSize - 1}px`;
    block.style.height = `${cellSize - 1}px`;
    block.style.background = color;
    wrapper.appendChild(block);
  });
  return wrapper;
}

function renderColorsModal(node, body) {
  renderColorsModalUi(node, body, getColorsModalDeps());
}

function getColorsModalDeps() {
  return {
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
  };
}

function renderBlockStyleModal(node, body) {
  renderBlockStyleModalUi(node, body, getBlockStyleModalDeps());
}

function getBlockStyleModalDeps() {
  return {
    getConfig,
    getThemeColors,
    ensureUiState,
    cloneDeep,
    defaultConfig: DEFAULT_CONFIG,
    infoIconViewbox: INFO_ICON_VIEWBOX,
    infoIconPath: INFO_ICON_PATH,
    createTetrominoLabel,
    shapeMap: SHAPES,
    getUiPreviewTextureTransforms,
    drawBlockSized,
    applyModalThemeStyles,
    updateConfig,
  };
}

function renderThemeModal(node, body) {
  renderThemeModalUi(node, body, getThemeModalDeps());
}

function getThemeModalDeps() {
  return {
    getConfig,
    cloneDeep,
    defaultConfig: DEFAULT_CONFIG,
    formatThemeName,
    updateConfig,
    buildThemePaletteFromSwatch,
    getThemeColors,
    formatThemeKeyLabel,
    applySwatchBackground,
    colorToHex,
    getContrastTextColor,
    openColorPicker,
    themePresets: THEME_PRESETS,
    themeUsedKeys: THEME_USED_KEYS,
    applyModalThemeStyles,
  };
}

function renderGameplayModal(node, body) {
  renderGameplayModalUi(node, body, getGameplayModalDeps());
}

function getGameplayModalDeps() {
  return {
    getConfig,
    updateConfig,
    updateBackendState,
    version: TETRINODE_VERSION,
  };
}

function renderAnimationModal(node, body) {
  renderAnimationModalUi(node, body, getAnimationMusicModalDeps());
}

function renderMusicModal(node, body) {
  renderMusicModalUi(node, body, getAnimationMusicModalDeps());
}

function getAnimationMusicModalDeps() {
  return {
    getConfig,
    updateConfig,
    updateBackendState,
    clampMusicVolume,
    ensureMusicState,
    resolveMusicTrackUrl,
    unlockMusic,
    setMusicTrack,
    setCustomMusicFile,
    toggleMusicMute,
    setMusicVolume,
    syncMusicFromConfig,
    toggleMusicPreview,
  };
}

function openColorPicker(node, value, allowAlpha, defaultValue, onApply) {
  openColorPickerUi(node, value, allowAlpha, defaultValue, onApply, getColorPickerDeps());
}

function getColorPickerDeps() {
  return {
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
  };
}

const {
  nodeCreated,
  setup,
} = createComfyHooks({
  nodeClass: NODE_CLASS,
  applyWidgetHiding,
  ensureSeedControlWidget,
  ensureUiState,
  getConfig,
  getSeedValue,
  getStartLevel,
  getLevelProgression,
  createState,
  getLayout,
  padding: PADDING,
  ensureWidgetDrawCapture,
  drawNode,
  handleToolbarMouseDown,
  handleToolbarMouseMove,
  handleToolbarMouseUp,
  closeModal,
  stopTimer,
  applySeedAfterGenerate,
  syncSeed,
  updateBackendState,
  ensureTimer,
  ensureBackgroundUpdater,
  rotate,
  hardDrop,
  handleKey,
  handleKeyUp,
  getSelectedLiveNode,
});

app.registerExtension({
  name: EXT_NAME,
  nodeCreated,
  setup,
});
