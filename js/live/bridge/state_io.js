export function createStateIoHelpers(deps) {
  const {
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
  } = deps;

  function loadStateFromText(node, text) {
    const live = node.__tetrisLive;
    if (!live) return;
    if (!text || !text.trim()) {
      setStatusMessage(node, "No state input found.", "error");
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      setStatusMessage(node, "Invalid state JSON.", "error");
      return;
    }
    const validationError = validateStatePayload(parsed);
    if (validationError) {
      setStatusMessage(node, validationError, "error");
      return;
    }
    const seed = getSeedValue(node, { allowRandomize: false });
    const startLevel = getStartLevel(node);
    const progression = getLevelProgression(node);
    const hydrated = hydrateState(text, seed ?? 0, startLevel, progression);
    if (!hydrated) {
      setStatusMessage(node, "Failed to load state.", "error");
      return;
    }
    node.__tetrisLive.state = hydrated;
    node.__tetrisLive.state.boardDirty = true;
    node.__tetrisLive.state.started = true;
    node.__tetrisLive.state.running = false;
    node.__tetrisLive.state.showBoardWhilePaused = true;
    resetInputState(node.__tetrisLive.state);
    stopTimer(node);
    ensureTimer(node);
    updateBackendState(node);
    node.setDirtyCanvas(true, true);
    setStatusMessage(node, "State loaded.", "success");
  }

  return {
    loadStateFromText,
  };
}
