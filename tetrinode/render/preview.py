import numpy as np
import torch
from PIL import Image, ImageDraw

from ..constants import COLORS, PREVIEW_GRID, SHAPES
from ..game.rng import _new_bag

def _render_next_piece(shape, block_size, colors=None):
    palette = colors or COLORS
    grid = PREVIEW_GRID
    size = grid * block_size
    img = Image.new("RGB", (size, size), palette["X"])
    draw = ImageDraw.Draw(img)

    cells = SHAPES[shape][0]
    min_x = min(x for x, _ in cells)
    min_y = min(y for _, y in cells)
    max_x = max(x for x, _ in cells)
    max_y = max(y for _, y in cells)
    shape_w = max_x - min_x + 1
    shape_h = max_y - min_y + 1
    offset_x = (grid - shape_w) // 2 - min_x
    offset_y = (grid - shape_h) // 2 - min_y

    for x, y in cells:
        gx = x + offset_x
        gy = y + offset_y
        if 0 <= gx < grid and 0 <= gy < grid:
            x0 = gx * block_size
            y0 = gy * block_size
            draw.rectangle([x0, y0, x0 + block_size - 2, y0 + block_size - 2], fill=palette[shape])

    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]


def _get_upcoming_shapes(state, count):
    if count <= 0:
        return []
    upcoming = [state.get("next_piece_shape")] + list(state.get("bag", []))
    bag_count = state.get("bag_count", 0)
    seed = state.get("seed", 0)
    while len(upcoming) < count:
        bag = _new_bag(seed, bag_count)
        bag_count += 1
        upcoming.extend(bag)
    return upcoming[:count]


def _render_queue(shapes, block_size, colors=None):
    palette = colors or COLORS
    if not shapes:
        size = PREVIEW_GRID * block_size
        img = Image.new("RGB", (size, size), palette["X"])
        arr = np.array(img).astype(np.float32) / 255.0
        return torch.from_numpy(arr)[None, ...]
    gap = block_size
    width = PREVIEW_GRID * block_size
    height = len(shapes) * PREVIEW_GRID * block_size + max(0, len(shapes) - 1) * gap
    img = Image.new("RGB", (width, height), palette["X"])
    draw = ImageDraw.Draw(img)
    for idx, shape in enumerate(shapes):
        if shape not in SHAPES:
            continue
        offset_y = idx * (PREVIEW_GRID * block_size + gap)
        cells = SHAPES[shape][0]
        min_x = min(x for x, _ in cells)
        min_y = min(y for _, y in cells)
        max_x = max(x for x, _ in cells)
        max_y = max(y for _, y in cells)
        shape_w = max_x - min_x + 1
        shape_h = max_y - min_y + 1
        offset_x = (PREVIEW_GRID - shape_w) // 2 - min_x
        offset_cell_y = (PREVIEW_GRID - shape_h) // 2 - min_y
        for x, y in cells:
            gx = x + offset_x
            gy = y + offset_cell_y
            if 0 <= gx < PREVIEW_GRID and 0 <= gy < PREVIEW_GRID:
                x0 = gx * block_size
                y0 = offset_y + gy * block_size
                draw.rectangle(
                    [x0, y0, x0 + block_size - 2, y0 + block_size - 2],
                    fill=palette[shape],
                )
    arr = np.array(img).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]

