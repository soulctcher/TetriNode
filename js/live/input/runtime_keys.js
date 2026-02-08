export function createRuntimeKeyHandlers(deps) {
  const {
    getCaptureNode,
    getSelectedLiveNode,
    bindingFromEvent,
    findBindingConflict,
    formatKeyLabel,
    normalizeBindingValue,
    controlActionLabels,
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
  } = deps;

  function handleKey(event) {
    if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    const node = getCaptureNode() || getSelectedLiveNode(false);
    if (!node) return;
    const live = node.__tetrisLive;
    if (!live) return;
    const ui = node.__tetrisUi;
    if (ui?.captureAction) {
      if (ui.confirmPrompt) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key && event.key.toLowerCase() === "escape") {
        ui.captureAction = null;
        if (ui.modal?.body) {
          if (ui.modal.kind === "settings") {
            renderSettingsModal(node, ui.modal.body, ui.modal.activeTab || "controls");
          } else {
            renderControlsModal(node, ui.modal.body);
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const binding = bindingFromEvent(event);
      if (!binding) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const config = getConfig(node);
      const conflictId = findBindingConflict(config.bindings, ui.captureAction, binding);
      if (conflictId) {
        const conflictLabel = controlActionLabels[conflictId] || conflictId;
        const currentLabel = controlActionLabels[ui.captureAction] || ui.captureAction;
        const actionId = ui.captureAction;
        ui.captureAction = null;
        ui.confirmPrompt = {
          title: "Key already in use",
          lines: [
            `"${formatKeyLabel(binding)}" is already assigned to ${conflictLabel}.`,
            `Switch it to ${currentLabel}?`,
          ],
          confirmLabel: "Switch",
          cancelLabel: "Cancel",
          onConfirm: () => {
            updateConfig(node, (next) => {
              const list = Array.isArray(next.bindings[actionId])
                ? next.bindings[actionId]
                : [];
              if (!list.includes(binding)) {
                list.push(binding);
              }
              next.bindings[actionId] = list.slice(0, 5);
              const conflictList = Array.isArray(next.bindings[conflictId])
                ? next.bindings[conflictId]
                : [];
              next.bindings[conflictId] = conflictList.filter(
                (value) => normalizeBindingValue(value) !== normalizeBindingValue(binding),
              );
              return next;
            });
            updateBackendState(node);
          },
          onCancel: null,
        };
        if (ui.modal?.body) {
          if (ui.modal.kind === "settings") {
            renderSettingsModal(node, ui.modal.body, ui.modal.activeTab || "controls");
          } else {
            renderControlsModal(node, ui.modal.body);
          }
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      updateConfig(node, (next) => {
        const list = Array.isArray(next.bindings[ui.captureAction])
          ? next.bindings[ui.captureAction]
          : [];
        if (!list.includes(binding)) {
          list.push(binding);
        }
        next.bindings[ui.captureAction] = list.slice(0, 5);
        if (conflictId) {
          const conflictList = Array.isArray(next.bindings[conflictId])
            ? next.bindings[conflictId]
            : [];
          next.bindings[conflictId] = conflictList.filter(
            (value) => normalizeBindingValue(value) !== normalizeBindingValue(binding),
          );
        }
        return next;
      });
      updateBackendState(node);
      ui.captureAction = null;
      if (ui.modal?.body) {
        if (ui.modal.kind === "settings") {
          renderSettingsModal(node, ui.modal.body, ui.modal.activeTab || "controls");
        } else {
          renderControlsModal(node, ui.modal.body);
        }
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (ui?.modal) {
      if (event.key && event.key.toLowerCase() === "escape") {
        closeModal(node);
        event.preventDefault();
        event.stopPropagation();
      }
      if (ui.modal.kind === "settings" && !ui.captureAction) {
        const key = event.key ? event.key.toLowerCase() : "";
        const tabMap = {
          s: "settings",
          a: "animation",
          m: "music",
          c: "controls",
          b: "block_style",
          o: "colors",
          u: "theme",
        };
        const targetTab = tabMap[key];
        if (targetTab && ui.modal.body) {
          renderSettingsModal(node, ui.modal.body, targetTab);
          event.preventDefault();
          event.stopPropagation();
        }
      }
      return;
    }

    const state = live.state;
    const bindings = getControlBindings(node);
    const matches = (binding) => keyMatches(event, binding);
    const resetPressed = matches(bindings.reset);
    const pausePressed = matches(bindings.pause);
    const settingsPressed = matches(bindings.settings);
    if (settingsPressed) {
      if (ui?.modal?.kind === "settings") {
        closeModal(node);
      } else {
        openSettingsModal(node);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (state.gameOver) {
      if (resetPressed || pausePressed) {
        resetNode(node);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (
      event.repeat
      && (matches(bindings.rotateCw)
        || matches(bindings.rotateCcw)
        || matches(bindings.moveLeft)
        || matches(bindings.moveRight)
        || matches(bindings.softDrop)
        || matches(bindings.hardDrop)
        || matches(bindings.hold)
        || matches(bindings.reset)
        || matches(bindings.pause)
        || matches(bindings.settings))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const canAct =
      state.running ||
      matches(bindings.pause) ||
      matches(bindings.reset);
    if (!canAct) return;
    if (state.clearing && !(matches(bindings.pause) || matches(bindings.reset))) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    let handled = true;
    if (matches(bindings.moveLeft)) {
      state.moveHeldLeft = true;
      setMoveDirection(state, "left");
      if (move(state, -1, 0)) applyLockModeAfterAction(state, getLockMode(node));
    } else if (matches(bindings.moveRight)) {
      state.moveHeldRight = true;
      setMoveDirection(state, "right");
      if (move(state, 1, 0)) applyLockModeAfterAction(state, getLockMode(node));
    } else if (matches(bindings.rotateCw)) {
      if (rotate(state, 1)) {
        applyLockModeAfterAction(state, getLockMode(node));
      }
    } else if (matches(bindings.rotateCcw)) {
      if (rotate(state, -1)) {
        applyLockModeAfterAction(state, getLockMode(node));
      }
    } else if (matches(bindings.softDrop)) {
      state.softDrop = true;
      state.dropMs = Math.max(1, Math.floor(state.baseDropMs / 20));
    } else if (matches(bindings.hardDrop)) {
      hardDrop(state);
    } else if (matches(bindings.hold)) {
      holdPiece(state);
    } else if (matches(bindings.reset)) {
      resetNode(node);
    } else if (matches(bindings.pause)) {
      togglePause(node);
    } else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
      syncMusicFromConfig(node, false);
    }
  }

  function handleKeyUp(event) {
    if (event.target && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
    const node = getSelectedLiveNode(false);
    if (!node) return;
    const live = node.__tetrisLive;
    if (!live || live.state.gameOver) return;
    if (node.__tetrisUi?.modal) return;
    const bindings = getControlBindings(node);
    const matches = (binding) => keyMatches(event, binding);
    if (matches(bindings.moveLeft)) {
      live.state.moveHeldLeft = false;
      if (live.state.moveHeldRight) {
        setMoveDirection(live.state, "right");
      } else {
        clearMoveDirection(live.state);
      }
    }
    if (matches(bindings.moveRight)) {
      live.state.moveHeldRight = false;
      if (live.state.moveHeldLeft) {
        setMoveDirection(live.state, "left");
      } else {
        clearMoveDirection(live.state);
      }
    }
    if (!matches(bindings.softDrop)) return;
    live.state.softDrop = false;
    live.state.dropMs = live.state.baseDropMs;
  }

  return {
    handleKey,
    handleKeyUp,
  };
}
