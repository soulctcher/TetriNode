export function createLockRepeatHelpers(deps) {
  const {
    collides,
    move,
    dasMs,
    arrMs,
  } = deps;

  function getLockMode(node, getConfig) {
    const defaultMode = "extended";
    const raw = `${getConfig(node).lock_down_mode || ""}`.trim().toLowerCase();
    if (["extended", "infinite", "classic"].includes(raw)) return raw;
    return defaultMode;
  }

  function applyLockModeAfterAction(state, mode) {
    const onSurface = collides(state.board, { ...state.piece, y: state.piece.y + 1 });
    if (!onSurface) {
      state.locking = false;
      state.lockElapsed = 0;
      return;
    }
    state.locking = true;
    if (mode === "classic") {
      return;
    }
    if (mode === "infinite") {
      state.lockElapsed = 0;
      return;
    }
    if (state.lockMoves < 15) {
      state.lockMoves += 1;
      state.lockElapsed = 0;
    } else {
      state.lockElapsed = state.lockDelayMs;
    }
  }

  function setMoveDirection(state, dir) {
    if (state.moveDir === dir) return;
    state.moveDir = dir;
    state.moveDasElapsed = 0;
    state.moveArrElapsed = 0;
  }

  function clearMoveDirection(state) {
    state.moveDir = null;
    state.moveDasElapsed = 0;
    state.moveArrElapsed = 0;
  }

  function updateAutoRepeat(state, node, getConfig, deltaMs) {
    if (!state.moveDir) return;
    state.moveDasElapsed += deltaMs;
    if (state.moveDasElapsed < dasMs) return;
    state.moveArrElapsed += deltaMs;
    while (state.moveArrElapsed >= arrMs) {
      state.moveArrElapsed -= arrMs;
      const dx = state.moveDir === "left" ? -1 : 1;
      if (move(state, dx, 0)) {
        applyLockModeAfterAction(state, getLockMode(node, getConfig));
      }
    }
  }

  return {
    getLockMode,
    applyLockModeAfterAction,
    setMoveDirection,
    clearMoveDirection,
    updateAutoRepeat,
  };
}
