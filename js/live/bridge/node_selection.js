export function createNodeSelectionHelpers(deps) {
  const { app, nodeClass } = deps;

  function getSelectedLiveNode(allowFallback = false) {
    const selected = app.canvas?.selected_nodes;
    let fallback = null;
    if (allowFallback) {
      const nodes = app.graph?._nodes || [];
      for (const node of nodes) {
        if (node?.comfyClass === nodeClass && node.__tetrisLive) {
          fallback = node;
          break;
        }
      }
    }
    if (!selected) return fallback;
    for (const key of Object.keys(selected)) {
      const node = selected[key];
      if (node?.comfyClass === nodeClass && node.__tetrisLive) return node;
    }
    return fallback;
  }

  function getCaptureNode() {
    const nodes = app.graph?._nodes || [];
    for (const node of nodes) {
      if (node?.comfyClass === nodeClass && node.__tetrisUi?.captureAction) {
        return node;
      }
    }
    return null;
  }

  function isNodeSelected(node) {
    const selected = app.canvas?.selected_nodes;
    if (!selected) return false;
    for (const key of Object.keys(selected)) {
      if (selected[key] === node) return true;
    }
    return false;
  }

  return {
    getSelectedLiveNode,
    getCaptureNode,
    isNodeSelected,
  };
}
