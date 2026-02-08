export function createRuntimeLoopHelpers(deps) {
  const {
    applyPendingClear,
    getConfig,
    getBackgroundSource,
    getLockMode,
    updateAutoRepeat,
    settlePiece,
    stepDown,
    updateBackendState,
    isNodeSelected,
  } = deps;

  function ensureTimer(node) {
    const live = node.__tetrisLive;
    if (!live || live.state.timer) return;
    live.state.timer = setInterval(() => {
      if (live.state.running && live.state.started && !live.state.gameOver && !isNodeSelected(node)) {
        live.state.running = false;
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
        return;
      }
      if (!live.state.running || live.state.gameOver) return;
      if (live.state.lockFlash) {
        if (getConfig(node).anim_lock_flash === false) {
          live.state.lockFlash = null;
          live.state.boardDirty = true;
        } else {
          const now = typeof performance !== "undefined" ? performance.now() : Date.now();
          const start = live.state.lockFlash.start ?? now;
          if (live.state.lockFlash.start == null) {
            live.state.lockFlash.start = start;
          }
          live.state.lockFlash.elapsed = Math.max(0, now - start);
          if (now >= live.state.lockFlash.until || live.state.lockFlash.elapsed >= live.state.lockFlash.duration) {
            live.state.lockFlash = null;
          }
          live.state.boardDirty = true;
        }
      }
      if (live.state.hardDropTrail) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - live.state.hardDropTrail.start >= live.state.hardDropTrail.duration) {
          live.state.hardDropTrail = null;
        } else {
          live.state.boardDirty = true;
        }
      }
      if (live.state.actionToast) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now >= live.state.actionToast.until) {
          live.state.actionToast = null;
        } else {
          live.state.boardDirty = true;
        }
      }
      if (live.state.clearing) {
        const { lineClear } = live.state;
        if (lineClear) {
          lineClear.elapsed += 50;
          live.state.boardDirty = true;
          if (lineClear.elapsed >= lineClear.duration) {
            const pending = live.state.pendingClear;
            if (pending) {
              applyPendingClear(live.state, pending);
            }
            live.state.pendingClear = null;
            live.state.clearing = false;
            live.state.lineClear = null;
            live.state.boardDirty = true;
          } else {
            live.state.boardDirty = true;
          }
        }
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
        return;
      }
      const lockMode = getLockMode(node);
      updateAutoRepeat(live.state, node, 50);
      live.state.elapsed += 50;
      live.state.timeMs += 50;
      if (live.state.locking) {
        if (lockMode === "extended" && live.state.lockMoves >= 15) {
          settlePiece(live.state);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
          return;
        }
        live.state.lockElapsed += 50;
        if (live.state.lockElapsed >= live.state.lockDelayMs) {
          settlePiece(live.state);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
          return;
        }
      }
      if (live.state.elapsed >= live.state.dropMs) {
        live.state.elapsed = 0;
        stepDown(live.state);
        if (lockMode === "extended" && live.state.lockMoves >= 15 && live.state.locking) {
          settlePiece(live.state);
          updateBackendState(node);
          node.setDirtyCanvas(true, true);
          return;
        }
        updateBackendState(node);
        node.setDirtyCanvas(true, true);
      }
    }, 50);
  }

  function stopTimer(node) {
    const live = node.__tetrisLive;
    if (live?.state?.timer) {
      clearInterval(live.state.timer);
      live.state.timer = null;
    }
    if (live?.bgTimer) {
      clearInterval(live.bgTimer);
      live.bgTimer = null;
    }
  }

  function ensureBackgroundUpdater(node) {
    const live = node.__tetrisLive;
    if (!live || live.bgTimer) return;
    live.bgTimer = setInterval(() => {
      const bg = getBackgroundSource(node);
      if (bg && live.bgSource !== bg) {
        live.bgSource = bg;
        node.setDirtyCanvas(true, true);
      }
    }, 250);
  }

  return {
    ensureTimer,
    stopTimer,
    ensureBackgroundUpdater,
  };
}
