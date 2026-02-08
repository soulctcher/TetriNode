export function createNodeRuntimeHelpers(deps) {
  const { updateStoredConfig, syncMusicFromConfig } = deps;

  function applyWidgetHiding(node) {
    const hideWidgets = new Set([
      "action",
      "state",
      "block_size",
    ]);
    if (!node.widgets) return;
    let touched = false;
    for (const widget of node.widgets) {
      if (hideWidgets.has(widget?.name)) {
        widget.hidden = true;
        widget.computeSize = () => [0, 0];
        widget.draw = () => {};
        touched = true;
      }
    }
    if (touched) {
      node.__tetrisWidgetsHidden = true;
      node.setDirtyCanvas(true, true);
    }
  }

  function updateConfig(node, updater) {
    return updateStoredConfig(node, updater, (targetNode) => {
      if (targetNode) {
        syncMusicFromConfig(targetNode);
      }
    });
  }

  return {
    applyWidgetHiding,
    updateConfig,
  };
}
