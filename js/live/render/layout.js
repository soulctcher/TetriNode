import {
  BLOCK,
  CONTROL_GAP,
  CONTROL_MIN,
  CONTROL_WIDGET_PADDING,
  EXTRA_VISIBLE_ROWS,
  GRID_H_VISIBLE,
  GRID_W,
  HEADER_H,
  PADDING,
  PREVIEW_GRID,
  TOOLBAR_H,
} from "../constants.js";
import { getHoldEnabled, getNextPieceEnabled } from "../config/store.js";

export function getLayout(node) {
  const pauseBottom = null;
  const minTop = HEADER_H + PADDING + TOOLBAR_H + CONTROL_GAP;
  const widgetsBottom = getWidgetsBottom(node);
  const widgetTop =
    widgetsBottom != null ? widgetsBottom + CONTROL_WIDGET_PADDING : minTop + CONTROL_MIN;
  const topY = Math.max(minTop, widgetTop);
  const bottomY = Math.max(topY, node.size[1] - PADDING);
  const innerH = Math.max(0, bottomY - topY);
  const innerW = Math.max(0, node.size[0] - PADDING * 2);

  const showHold = getHoldEnabled(node);
  const showNext = getNextPieceEnabled(node);
  const sideSlots = 2;

  let sideW = 120;
  let blockSize = BLOCK;
  const effectiveRows = GRID_H_VISIBLE + EXTRA_VISIBLE_ROWS;
  for (let i = 0; i < 2; i += 1) {
    const boardW = Math.max(0, innerW - sideW * sideSlots - PADDING * sideSlots);
    blockSize = Math.floor(Math.min(boardW / GRID_W, innerH / effectiveRows));
    blockSize = Math.max(6, blockSize);
    sideW = Math.max(PREVIEW_GRID * blockSize + PADDING * 2, 120);
  }

  const boardW = blockSize * GRID_W;
  const extraPx = Math.round(blockSize * EXTRA_VISIBLE_ROWS);
  const boardH = blockSize * GRID_H_VISIBLE + extraPx;
  const boardX = Math.max(PADDING, Math.round((node.size[0] - boardW) / 2));
  const boardY = Math.round(topY);
  const sideY = boardY;

  node.__tetrisLastLayout = {
    boardY,
    pauseBottom,
  };

  return {
    boardX,
    boardY,
    boardW,
    boardH,
    sideY,
    blockSize,
    extraPx,
    showHold,
    showNext,
  };
}

export function getWidgetsBottom(node) {
  if (!node?.widgets?.length) return null;
  const controlWidget = node.widgets.find((widget) => widget?.name === "control_after_generate");
  if (controlWidget && node.__tetrisWidgetBottom == null) {
    const index = node.widgets.indexOf(controlWidget);
    const startY =
      (Number.isFinite(node.widgets_start_y) && node.widgets_start_y) ||
      (Number.isFinite(LiteGraph?.NODE_TITLE_HEIGHT) ? LiteGraph.NODE_TITLE_HEIGHT : HEADER_H);
    const paddingTop = Number.isFinite(LiteGraph?.NODE_WIDGET_PADDING)
      ? LiteGraph.NODE_WIDGET_PADDING
      : 4;
    const rowHeight = Number.isFinite(LiteGraph?.NODE_WIDGET_HEIGHT)
      ? LiteGraph.NODE_WIDGET_HEIGHT
      : 20;
    const margin = Number.isFinite(LiteGraph?.NODE_WIDGET_MARGIN)
      ? LiteGraph.NODE_WIDGET_MARGIN
      : 4;
    return startY + paddingTop + (index + 1) * (rowHeight + margin);
  }
  if (Number.isFinite(node.__tetrisWidgetBottom)) {
    return node.__tetrisWidgetBottom;
  }
  const startY =
    (Number.isFinite(node.widgets_start_y) && node.widgets_start_y) ||
    (Number.isFinite(LiteGraph?.NODE_TITLE_HEIGHT) ? LiteGraph.NODE_TITLE_HEIGHT : HEADER_H);
  const paddingTop = Number.isFinite(LiteGraph?.NODE_WIDGET_PADDING)
    ? LiteGraph.NODE_WIDGET_PADDING
    : 4;
  const rowHeight = Number.isFinite(LiteGraph?.NODE_WIDGET_HEIGHT)
    ? LiteGraph.NODE_WIDGET_HEIGHT
    : 20;
  const margin = Number.isFinite(LiteGraph?.NODE_WIDGET_MARGIN)
    ? LiteGraph.NODE_WIDGET_MARGIN
    : 4;
  return startY + paddingTop + node.widgets.length * (rowHeight + margin);
}
