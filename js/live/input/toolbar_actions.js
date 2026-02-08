export function createToolbarInteractionHandlers(deps) {
  const {
    ensureUiState,
    buildToolbarButtons,
    headerHeight,
    toolbarHeight,
    unlockMusic,
    resetNode,
    togglePause,
    openLoadStateModal,
    openSaveStateModal,
    openSettingsModal,
    toggleMusicMute,
    setMusicVolume,
    syncMusicFromConfig,
  } = deps;

  function hitToolbarButton(node, pos, boardY = null) {
    const ui = ensureUiState(node);
    if (!ui.toolbarButtons?.length) {
      const fallbackY = boardY ?? node.__tetrisLastLayout?.boardY ?? (headerHeight + toolbarHeight + 10);
      const barY = Math.max(headerHeight + 2, fallbackY - toolbarHeight - 10);
      const metrics = buildToolbarButtons(node, barY, toolbarHeight - 6);
      ui.toolbarButtons = metrics.buttons;
    }
    const [x, y] = pos;
    return ui.toolbarButtons.find(
      (btn) => x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h,
    );
  }

  function handleToolbarClick(node, pos) {
    unlockMusic(node);
    const btn = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
    if (!btn) return false;
    if (btn.id === "reset") {
      resetNode(node);
      return true;
    }
    if (btn.id === "pause") {
      togglePause(node);
      return true;
    }
    if (btn.id === "load") {
      openLoadStateModal(node);
      return true;
    }
    if (btn.id === "save") {
      openSaveStateModal(node);
      return true;
    }
    if (btn.id === "settings") {
      openSettingsModal(node);
      return true;
    }
    if (btn.id === "music_mute") {
      toggleMusicMute(node);
      return true;
    }
    if (btn.id === "music_volume") {
      const rel = Math.max(0, Math.min(1, (pos[0] - btn.x) / Math.max(1, btn.w)));
      setMusicVolume(node, Math.round(rel * 100));
      return true;
    }
    return false;
  }

  function handleToolbarMouseDown(node, pos) {
    const ui = ensureUiState(node);
    const hit = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
    if (hit?.id === "music_volume") {
      unlockMusic(node);
      ui.dragVolume = true;
      const rel = Math.max(0, Math.min(1, (pos[0] - hit.x) / Math.max(1, hit.w)));
      setMusicVolume(node, Math.round(rel * 100));
      syncMusicFromConfig(node, true);
      node.setDirtyCanvas(true, true);
      return true;
    }
    if (handleToolbarClick(node, pos)) {
      node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  function handleToolbarMouseMove(node, pos) {
    const ui = ensureUiState(node);
    if (ui.dragVolume) {
      const hit = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
      if (hit?.id === "music_volume") {
        const rel = Math.max(0, Math.min(1, (pos[0] - hit.x) / Math.max(1, hit.w)));
        setMusicVolume(node, Math.round(rel * 100));
        syncMusicFromConfig(node, true);
        node.setDirtyCanvas(true, true);
        return true;
      }
    }
    const hovered = hitToolbarButton(node, pos, node.__tetrisLastLayout?.boardY);
    const next = hovered ? hovered.id : null;
    if (next !== (ui.hoverButton?.id || null)) {
      ui.hoverButton = hovered;
      node.setDirtyCanvas(true, true);
    }
    return false;
  }

  function handleToolbarMouseUp(node) {
    const ui = ensureUiState(node);
    if (ui.dragVolume) {
      ui.dragVolume = false;
      node.setDirtyCanvas(true, true);
      return true;
    }
    return false;
  }

  return {
    hitToolbarButton,
    handleToolbarClick,
    handleToolbarMouseDown,
    handleToolbarMouseMove,
    handleToolbarMouseUp,
  };
}
