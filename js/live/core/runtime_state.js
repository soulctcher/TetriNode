export function createRuntimeStateHelpers(deps) {
  const {
    gridHeightTotal,
    gridWidth,
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
  } = deps;

  function validateStatePayload(payload) {
    if (!payload || typeof payload !== "object") return "Invalid state payload.";
    if (!Array.isArray(payload.board)) return "State missing board.";
    if (payload.board.length !== gridHeightTotal) return "Board must be 40 rows.";
    for (const row of payload.board) {
      if (!Array.isArray(row) || row.length !== gridWidth) return "Board rows must be 10 columns.";
    }
    const piece = payload.piece;
    if (!piece || typeof piece !== "object") return "State missing piece.";
    if (typeof piece.shape !== "string") return "Piece shape missing.";
    if (!Number.isInteger(piece.rot)) return "Piece rotation invalid.";
    if (!Number.isInteger(piece.x) || !Number.isInteger(piece.y)) return "Piece position invalid.";
    return null;
  }

  function setStatusMessage(node, text, kind = "info") {
    node.__tetrisStatusMessage = {
      text,
      kind,
      until: performance.now() + 2500,
    };
    node.setDirtyCanvas(true, true);
  }

  function resetInputState(state) {
    state.moveDir = null;
    state.moveHeldLeft = false;
    state.moveHeldRight = false;
    state.moveDasElapsed = 0;
    state.moveArrElapsed = 0;
    state.softDrop = false;
    state.dropMs = state.baseDropMs;
  }

  function getStartLevel(node) {
    const defaultValue = 1;
    const parsed = Number.parseInt(`${getConfig(node).start_level}`, 10);
    if (!Number.isFinite(parsed)) return defaultValue;
    return clampLevel(parsed);
  }

  function getLevelProgression(node) {
    const raw = `${getConfig(node).level_progression || ""}`.trim().toLowerCase();
    if (raw === "variable") return "variable";
    return "fixed";
  }

  function syncSeed(state, node) {
    const nextSeed = getSeedValue(node, { allowRandomize: false });
    if (Number.isInteger(nextSeed)) {
      if (nextSeed !== state.seed) {
        if (state.started) {
          return;
        }
        stopTimer(node);
        const nextState = createState(nextSeed, state.startLevel);
        nextState.running = false;
        nextState.started = false;
        node.__tetrisLive.state = nextState;
        updateBackendState(node);
        ensureTimer(node);
        node.setDirtyCanvas(true, true);
        return;
      }
      state.seed = nextSeed;
    }
  }

  function syncStartLevel(state, node) {
    const startLevel = getStartLevel(node);
    const progression = getLevelProgression(node);
    if (startLevel !== state.startLevel || progression !== state.levelProgression) {
      if (state.started) {
        return;
      }
      stopTimer(node);
      const nextState = createState(state.seed, startLevel, progression);
      nextState.running = false;
      nextState.started = false;
      node.__tetrisLive.state = nextState;
      updateBackendState(node);
      ensureTimer(node);
      node.setDirtyCanvas(true, true);
    } else {
      state.levelProgression = progression;
      updateLevel(state);
    }
  }

  function resetNode(node) {
    const live = node.__tetrisLive;
    if (!live) return;
    unlockMusic(node);
    const seed = getSeedValue(node, { allowRandomize: true });
    const startLevel = getStartLevel(node);
    const progression = getLevelProgression(node);
    live.state = createState(seed ?? live.state.seed, startLevel, progression);
    live.state.boardDirty = true;
    node.size = [750, 950];
    node.__tetrisSizeInitialized = true;
    live.state.started = true;
    live.state.running = true;
    live.state.hasStartedGame = true;
    live.state.showBoardWhilePaused = false;
    updateBackendState(node);
    node.setDirtyCanvas(true, true);
  }

  function togglePause(node) {
    const live = node.__tetrisLive;
    if (!live) return;
    if (!live.state.started && !live.state.gameOver) {
      unlockMusic(node);
      live.state.started = true;
      live.state.running = true;
      live.state.hasStartedGame = true;
    } else {
      live.state.running = !live.state.running;
    }
    live.state.showBoardWhilePaused = false;
    updateBackendState(node);
    node.setDirtyCanvas(true, true);
    syncMusicFromConfig(node, true);
  }

  return {
    validateStatePayload,
    setStatusMessage,
    resetInputState,
    getStartLevel,
    getLevelProgression,
    syncSeed,
    syncStartLevel,
    resetNode,
    togglePause,
  };
}
