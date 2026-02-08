export function createComfyHooks(deps) {
  const {
    nodeClass,
    applyWidgetHiding,
    ensureSeedControlWidget,
    ensureUiState,
    getConfig,
    getSeedValue,
    getStartLevel,
    getLevelProgression,
    createState,
    getLayout,
    padding,
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
  } = deps;

  async function nodeCreated(node) {
    if (node?.comfyClass !== nodeClass) return;
    applyWidgetHiding(node);
    ensureSeedControlWidget(node);
    ensureUiState(node);
    getConfig(node);
    const seed = getSeedValue(node, { allowRandomize: true });
    const startLevel = getStartLevel(node);
    const progression = getLevelProgression(node);
    node.__tetrisLive = { state: createState(seed ?? 0, startLevel, progression) };

    if (!node.__tetrisSizeInitialized) {
      node.size = [750, 950];
      const layout = getLayout(node);
      const targetHeight = Math.ceil(layout.boardY + layout.boardH + padding);
      node.size = [node.size[0], Math.max(targetHeight, 400)];
      node.__tetrisSizeInitialized = true;
    }

    const originalDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      const result = originalDraw?.apply(this, arguments);
      ensureWidgetDrawCapture(node);
      drawNode(node, ctx);
      return result;
    };

    const originalMouseDown = node.onMouseDown;
    node.onMouseDown = function (_event, pos, _graphcanvas) {
      if (handleToolbarMouseDown(node, pos)) return true;
      return originalMouseDown?.apply(this, arguments);
    };

    const originalMouseMove = node.onMouseMove;
    node.onMouseMove = function (_event, pos, _graphcanvas) {
      if (handleToolbarMouseMove(node, pos)) return true;
      return originalMouseMove?.apply(this, arguments);
    };

    const originalMouseUp = node.onMouseUp;
    node.onMouseUp = function () {
      if (handleToolbarMouseUp(node)) return true;
      return originalMouseUp?.apply(this, arguments);
    };

    const originalRemoved = node.onRemoved;
    node.onRemoved = function () {
      closeModal(node);
      stopTimer(node);
      return originalRemoved?.apply(this, arguments);
    };
    const originalExecuted = node.onExecuted;
    node.onExecuted = function () {
      const result = originalExecuted?.apply(this, arguments);
      applySeedAfterGenerate(node);
      return result;
    };

    syncSeed(node.__tetrisLive.state, node);
    node.__tetrisLive.state.running = false;
    updateBackendState(node);
    ensureTimer(node);
    ensureBackgroundUpdater(node);
    if (!node.__tetrisLive.api) {
      node.__tetrisLive.api = {
        rotateCw: () => {
          rotate(node.__tetrisLive.state, 1);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
        rotateCcw: () => {
          rotate(node.__tetrisLive.state, -1);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
        hardDrop: () => {
          hardDrop(node.__tetrisLive.state);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
        },
      };
    }
  }

  async function setup() {
    window.addEventListener("keydown", handleKey, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("mouseup", () => {
      const node = getSelectedLiveNode(false);
      if (node?.__tetrisUi?.dragVolume) {
        node.__tetrisUi.dragVolume = false;
        node.setDirtyCanvas(true, true);
      }
    });
  }

  return {
    nodeCreated,
    setup,
  };
}
