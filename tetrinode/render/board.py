import base64
import hashlib
import io
import math
import os
import random

import folder_paths
import numpy as np
import torch
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from ..assets.textures import _load_texture_image
from ..constants import (
    BOARD_HEIGHT,
    BOARD_WIDTH,
    COLORS,
    DEFAULT_BLOCK_STYLE,
    EXTRA_VISIBLE_ROWS,
    HIDDEN_ROWS,
    PIXELATED_TEXTURE_SAMPLE_RATIO,
    RANDOM_TEXTURE_IDS,
    TEXTURE_SAMPLE_PX,
    VISIBLE_HEIGHT,
)
from ..game.pieces import _collides, _ghost_piece, _move, _piece_cells
from .colors import _adjust_color_by_factor, _adjust_color_hsl, _clamp, _mix_colors
from .style import _texture_transform

def _prepare_background(background_image, width, height):
    if background_image is None:
        return None
    try:
        img = background_image[0].detach().cpu().numpy()
    except Exception:
        return None
    if img.ndim != 3 or img.shape[-1] < 3:
        return None
    img = np.clip(img[..., :3] * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img, "RGB")
    src_w, src_h = pil.size
    if src_w <= 0 or src_h <= 0:
        return None
    scale = max(width / src_w, height / src_h)
    new_w = max(1, int(round(src_w * scale)))
    new_h = max(1, int(round(src_h * scale)))
    pil = pil.resize((new_w, new_h), Image.BICUBIC)
    left = max(0, (new_w - width) // 2)
    top = max(0, (new_h - height) // 2)
    return pil.crop((left, top, left + width, top + height))


def _save_temp_background(background_image, prefix="TetriNode_bg"):
    if background_image is None:
        return []
    try:
        img = background_image[0].detach().cpu().numpy()
    except Exception:
        return []
    if img.ndim != 3 or img.shape[-1] < 3:
        return []
    img = np.clip(img[..., :3] * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img, "RGB")
    width, height = pil.size
    temp_dir = folder_paths.get_temp_directory()
    suffix = "".join(random.choice("abcdefghijklmnopqrstupvxyz") for _ in range(5))
    filename_prefix = f"{prefix}_{suffix}"
    full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
        filename_prefix, temp_dir, width, height
    )
    file = f"{filename}_{counter:05}_.png"
    os.makedirs(full_output_folder, exist_ok=True)
    pil.save(os.path.join(full_output_folder, file), compress_level=1)
    return [{"filename": file, "subfolder": subfolder, "type": "temp"}]


def _wrap_result(result, background_image):
    ui_images = _save_temp_background(background_image)
    if not ui_images:
        return result
    return {"ui": {"tetrinode_background": ui_images}, "result": result}


def _render_from_capture(data_url):
    if not data_url:
        return None
    raw = data_url
    if isinstance(data_url, dict) and "data" in data_url:
        raw = data_url.get("data")
    if not isinstance(raw, str) or not raw:
        return None
    try:
        if raw.startswith("data:"):
            _, encoded = raw.split(",", 1)
        else:
            encoded = raw
        payload = base64.b64decode(encoded)
        pil = Image.open(io.BytesIO(payload)).convert("RGB")
    except Exception:
        return None
    arr = np.array(pil).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]



def _draw_grid(img, block_size, width, height, color, extra_px):
    if not color:
        return img
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(1, BOARD_WIDTH):
        xpos = x * block_size - 1
        draw.line([xpos, -1, xpos, height + 1], fill=color, width=1)
    for y in range(0, VISIBLE_HEIGHT):
        ypos = y * block_size - 1 + extra_px
        draw.line([-1, ypos, width + 1, ypos], fill=color, width=1)
    return Image.alpha_composite(img, overlay)


def _draw_ghost(img, board, piece, block_size, color, extra_px):
    if not color:
        return img
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    ghost = _ghost_piece(board, piece)
    fill = (*color, 84)
    outline = (200, 200, 200, 171)
    for x, y in _piece_cells(ghost):
        if HIDDEN_ROWS - 1 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size + extra_px
            draw.rectangle(
                [x0, y0, x0 + block_size - 2, y0 + block_size - 2],
                fill=fill,
            )
            draw.rectangle(
                [x0 + 1, y0 + 1, x0 + block_size - 2, y0 + block_size - 2],
                outline=outline,
            )
    return Image.alpha_composite(img, overlay)


def _draw_block(base, x, y, size, color, style, texture_key=None, seed=0):
    block = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shrink = 1 if style["pixel_snap"] >= 0.5 else 0
    inner_size = size - 1 - shrink
    draw_x = shrink / 2
    draw_y = shrink / 2
    rect_right = draw_x + inner_size - 1
    rect_bottom = draw_y + inner_size - 1
    corner_radius = max(0.0, style["corner_radius"])
    fill_alpha = int(round(_clamp(style["alpha"], 0, 1) * 255))
    metallic_strength = min(1.0, style["metallic"])
    metallic_boost = max(0.0, style["metallic"] - 1.0)
    base_color = _adjust_color_hsl(color, style["saturation_shift"], style["brightness_shift"])
    if style["metallic"] > 0:
        base_color = _adjust_color_by_factor(
            base_color,
            -0.2 * metallic_strength - 0.2 * metallic_boost,
        )
    specular_color = _mix_colors(base_color, (255, 255, 255), 1 - metallic_strength)

    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if corner_radius > 0:
        mask_draw.rounded_rectangle(
            [draw_x, draw_y, rect_right, rect_bottom],
            radius=min(corner_radius, inner_size / 2),
            fill=255,
        )
    else:
        mask_draw.rectangle([draw_x, draw_y, rect_right, rect_bottom], fill=255)

    fill_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask_inner = mask.crop(
        (int(draw_x), int(draw_y), int(draw_x) + inner_size, int(draw_y) + inner_size)
    )
    effective_gradient = style["gradient"] * (1 - style["roughness"] * 0.35)
    if effective_gradient > 0:
        angle = math.radians(style["gradient_angle"] % 360)
        dx = math.cos(angle)
        dy = math.sin(angle)
        half = inner_size / 2
        contrast = effective_gradient * max(0.2, style["gradient_contrast"])
        c1 = _adjust_color_by_factor(base_color, contrast * 0.4)
        c2 = _adjust_color_by_factor(base_color, -contrast * 0.4)
        xs, ys = np.meshgrid(np.arange(inner_size), np.arange(inner_size))
        tx = (xs - half) * dx + (ys - half) * dy
        t = np.clip(tx / max(1.0, half) * 0.5 + 0.5, 0, 1)
        grad = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        grad[..., 0] = (c1[0] + (c2[0] - c1[0]) * t).astype(np.uint8)
        grad[..., 1] = (c1[1] + (c2[1] - c1[1]) * t).astype(np.uint8)
        grad[..., 2] = (c1[2] + (c2[2] - c1[2]) * t).astype(np.uint8)
        grad[..., 3] = fill_alpha
        gradient_img = Image.fromarray(grad, "RGBA")
        fill_layer.paste(gradient_img, (int(draw_x), int(draw_y)), mask_inner)
    else:
        solid = Image.new("RGBA", (size, size), (*base_color, fill_alpha))
        solid.putalpha(mask)
        fill_layer = solid

    if style["shadow"] > 0:
        rad = math.radians(style["shadow_angle"] % 360)
        offset = style["shadow"] * 4
        shadow_alpha = int(round(min(0.6, 0.2 + style["shadow"] * 0.6) * 255))
        shadow = Image.new("RGBA", (size, size), (0, 0, 0, shadow_alpha))
        shadow.putalpha(mask)
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=style["shadow"] * 8))
        shadow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        shadow_layer.paste(shadow, (int(round(math.cos(rad) * offset)), int(round(math.sin(rad) * offset))), shadow)
        block = Image.alpha_composite(block, shadow_layer)

    if style["fill_blur"] > 0:
        fill_layer = fill_layer.filter(ImageFilter.GaussianBlur(radius=style["fill_blur"]))
    block = Image.alpha_composite(block, fill_layer)

    if style["bevel"] > 0:
        bevel = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        xs, ys = np.meshgrid(np.arange(inner_size), np.arange(inner_size))
        t = np.clip((xs + ys) / max(1.0, inner_size * 2), 0, 1)
        bevel_arr = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        bevel_arr[..., 0] = 255
        bevel_arr[..., 1] = 255
        bevel_arr[..., 2] = 255
        bevel_arr[..., 3] = (style["bevel"] * 0.35 * (1 - t) * 255).astype(np.uint8)
        bevel_img = Image.fromarray(bevel_arr, "RGBA")
        bevel.paste(bevel_img, (int(draw_x), int(draw_y)), mask_inner)
        dark_arr = np.zeros((inner_size, inner_size, 4), dtype=np.uint8)
        dark_arr[..., 3] = (style["bevel"] * 0.3 * t * 255).astype(np.uint8)
        dark_img = Image.fromarray(dark_arr, "RGBA")
        bevel.paste(dark_img, (int(draw_x), int(draw_y)), mask_inner)
        block = Image.alpha_composite(block, bevel)

    effective_spec_strength = style["specular_strength"] * (1 - style["roughness"])
    effective_spec_size = min(1.0, style["specular_size"] + style["roughness"] * 0.35)
    if effective_spec_strength > 0 and effective_spec_size > 0:
        radius = max(4, inner_size * effective_spec_size)
        cx = draw_x + radius * 0.6
        cy = draw_y + radius * 0.6
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        alpha = np.clip(1 - dist / max(1.0, radius), 0, 1) * (effective_spec_strength * 0.6)
        spec_arr = np.zeros((size, size, 4), dtype=np.uint8)
        spec_arr[..., 0] = specular_color[0]
        spec_arr[..., 1] = specular_color[1]
        spec_arr[..., 2] = specular_color[2]
        spec_arr[..., 3] = (alpha * 255).astype(np.uint8)
        spec_img = Image.fromarray(spec_arr, "RGBA")
        spec_img.putalpha(ImageChops.multiply(spec_img.split()[-1], mask))
        block = Image.alpha_composite(block, spec_img)

    if style["clearcoat"] > 0 and style["clearcoat_size"] > 0:
        radius = max(3, inner_size * style["clearcoat_size"] * 0.6)
        cx = draw_x + radius * 0.55
        cy = draw_y + radius * 0.5
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        alpha = np.clip(1 - dist / max(1.0, radius), 0, 1) * (style["clearcoat"] * 0.7)
        coat_arr = np.zeros((size, size, 4), dtype=np.uint8)
        coat_arr[..., 0] = 255
        coat_arr[..., 1] = 255
        coat_arr[..., 2] = 255
        coat_arr[..., 3] = (alpha * 255).astype(np.uint8)
        coat_img = Image.fromarray(coat_arr, "RGBA")
        coat_img.putalpha(ImageChops.multiply(coat_img.split()[-1], mask))
        block = Image.alpha_composite(block, coat_img)

    if style["rim_light"] > 0:
        xs, ys = np.meshgrid(np.arange(size), np.arange(size))
        cx = draw_x + inner_size / 2
        cy = draw_y + inner_size / 2
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        inner = inner_size * 0.2
        outer = inner_size * 0.65
        alpha = np.clip((dist - inner) / max(1.0, outer - inner), 0, 1)
        rim_arr = np.zeros((size, size, 4), dtype=np.uint8)
        rim_arr[..., 0] = 255
        rim_arr[..., 1] = 255
        rim_arr[..., 2] = 255
        rim_arr[..., 3] = (alpha * style["rim_light"] * 0.45 * 255).astype(np.uint8)
        rim_img = Image.fromarray(rim_arr, "RGBA")
        rim_img.putalpha(ImageChops.multiply(rim_img.split()[-1], mask))
        base_rgb = block.convert("RGB")
        rim_rgb = rim_img.convert("RGB")
        screened = ImageChops.screen(base_rgb, rim_rgb)
        block = Image.merge("RGBA", (*screened.split(), block.split()[-1]))

    if style["inner_shadow"] > 0 and style["inner_shadow_strength"] > 0:
        inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(inner)
        inset = style["inner_shadow"] / 2
        width = max(1, int(round(style["inner_shadow"])))
        alpha = int(round(style["inner_shadow_strength"] * 0.6 * 255))
        inner_span = max(0, inner_size - style["inner_shadow"])
        left = draw_x + inset
        top = draw_y + inset
        right = left + inner_span - 1
        bottom = top + inner_span - 1
        draw.rectangle(
            [left, top, right, bottom],
            outline=(0, 0, 0, alpha),
            width=width,
        )
        inner.putalpha(ImageChops.multiply(inner.split()[-1], mask))
        block = Image.alpha_composite(block, inner)

    if style["scanlines"] > 0:
        lines = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(lines)
        step = max(2, int(inner_size / 6))
        alpha = int(round(min(0.4, style["scanlines"] * 0.6) * 255))
        for yy in range(int(draw_y) + step, int(draw_y + inner_size), step):
            draw.line([draw_x, yy, draw_x + inner_size, yy], fill=(0, 0, 0, alpha), width=1)
        lines.putalpha(ImageChops.multiply(lines.split()[-1], mask))
        block = Image.alpha_composite(block, lines)

    texture_id = style["texture_id"]
    if texture_id and style["texture_opacity"] > 0:
        texture_img = _load_texture_image(texture_id)
        if texture_img:
            src_w = texture_img.width
            src_h = texture_img.height
            if texture_id in RANDOM_TEXTURE_IDS and texture_key:
                transform = _texture_transform(seed, texture_key)
                if texture_id == "pixelated":
                    ratio = PIXELATED_TEXTURE_SAMPLE_RATIO
                    src_w = max(1, int(round(texture_img.width * ratio)))
                    src_h = max(1, int(round(texture_img.height * ratio)))
                else:
                    src_w = max(1, min(TEXTURE_SAMPLE_PX, texture_img.width))
                    src_h = max(1, min(TEXTURE_SAMPLE_PX, texture_img.height))
                max_x = max(0, texture_img.width - src_w)
                max_y = max(0, texture_img.height - src_h)
                src_x = int(math.floor(max_x * transform["u"]))
                src_y = int(math.floor(max_y * transform["v"]))
                crop = texture_img.crop((src_x, src_y, src_x + src_w, src_y + src_h))
                if transform["rotation"]:
                    crop = crop.rotate(transform["rotation"], expand=True)
                if transform["flip_x"]:
                    crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
                if transform["flip_y"]:
                    crop = crop.transpose(Image.FLIP_TOP_BOTTOM)
            else:
                crop = texture_img
            scale_base = max(inner_size / crop.width, inner_size / crop.height)
            draw_w = max(1, int(round(crop.width * scale_base * style["texture_scale"])))
            draw_h = max(1, int(round(crop.height * scale_base * style["texture_scale"])))
            texture_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            resized = crop.resize((draw_w, draw_h), Image.BICUBIC)
            angle = style["texture_angle"]
            if angle:
                resized = resized.rotate(angle, expand=True)
            tx = int(round((size - resized.width) / 2))
            ty = int(round((size - resized.height) / 2))
            texture_layer.paste(resized, (tx, ty), resized)
            if corner_radius > 0:
                texture_layer.putalpha(ImageChops.multiply(texture_layer.split()[-1], mask))
            base_rgb = block.convert("RGB")
            tex_rgb = texture_layer.convert("RGB")
            tex_alpha = texture_layer.split()[-1]
            multiplied = ImageChops.multiply(base_rgb, tex_rgb)
            blended = Image.blend(base_rgb, multiplied, _clamp(style["texture_opacity"], 0, 1))
            composited = Image.composite(blended, base_rgb, tex_alpha)
            block = Image.merge("RGBA", (*composited.split(), block.split()[-1]))

    if style["glow"] > 0 and style["glow_opacity"] > 0:
        glow_color = _adjust_color_by_factor(base_color, 0.25)
        glow_alpha = int(round(_clamp(style["glow_opacity"], 0, 1) * 255))
        glow_layer = Image.new("RGBA", (size, size), (*glow_color, glow_alpha))
        glow_layer.putalpha(mask)
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=style["glow"] * 6))
        glow_rgb = Image.new("RGB", (size, size), (0, 0, 0))
        glow_rgb.paste(glow_color, mask=glow_layer.split()[-1])
        base_rgb = block.convert("RGB")
        added = ImageChops.add(base_rgb, glow_rgb, scale=1.0, offset=0)
        block = Image.merge("RGBA", (*added.split(), block.split()[-1]))

    if style["border"] > 0 and style["outline_opacity"] > 0:
        border_color = _adjust_color_by_factor(base_color, -0.4)
        outline_alpha = int(round(_clamp(style["outline_opacity"], 0, 1) * 255))
        border = max(1.0, float(style["border"]))
        outer_mask = Image.new("L", (size, size), 0)
        outer_draw = ImageDraw.Draw(outer_mask)
        outer_radius = min(corner_radius, inner_size / 2)
        if outer_radius > 0:
            outer_draw.rounded_rectangle(
                [draw_x, draw_y, rect_right, rect_bottom],
                radius=outer_radius,
                fill=255,
            )
        else:
            outer_draw.rectangle(
                [draw_x, draw_y, rect_right, rect_bottom],
                fill=255,
            )
        inner_mask = Image.new("L", (size, size), 0)
        inner_draw = ImageDraw.Draw(inner_mask)
        inset = border / 2.0
        inner_left = draw_x + border
        inner_top = draw_y + border
        inner_right = rect_right - border
        inner_bottom = rect_bottom - border
        inner_radius = max(0.0, min(corner_radius - inset, inner_size / 2))
        if inner_right > inner_left and inner_bottom > inner_top:
            if inner_radius > 0:
                inner_draw.rounded_rectangle(
                    [inner_left, inner_top, inner_right, inner_bottom],
                    radius=inner_radius,
                    fill=255,
                )
            else:
                inner_draw.rectangle(
                    [inner_left, inner_top, inner_right, inner_bottom],
                    fill=255,
                )
        ring = ImageChops.subtract(outer_mask, inner_mask)
        border_layer = Image.new("RGBA", (size, size), (*border_color, outline_alpha))
        border_layer.putalpha(ring)
        if style["border_blur"] > 0:
            border_layer = border_layer.filter(ImageFilter.GaussianBlur(radius=style["border_blur"]))
        block = Image.alpha_composite(block, border_layer)

    if style["noise"] > 0:
        noise_key = f"{seed}:{texture_key or ''}:noise"
        rng = random.Random(hashlib.md5(noise_key.encode("utf-8")).digest())
        count = max(4, int(math.ceil(40 * style["noise"])))
        noise_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(noise_layer)
        alpha_white = int(round(min(1, 0.3 + style["noise"] * 0.7) * 255))
        alpha_black = int(round(min(1, style["noise"] * 0.5) * 255))
        for _ in range(count):
            nx = draw_x + rng.random() * inner_size
            ny = draw_y + rng.random() * inner_size
            draw.rectangle([nx, ny, nx + 1, ny + 1], fill=(255, 255, 255, alpha_white))
        for _ in range(max(1, count // 2)):
            nx = draw_x + rng.random() * inner_size
            ny = draw_y + rng.random() * inner_size
            draw.rectangle([nx, ny, nx + 1, ny + 1], fill=(0, 0, 0, alpha_black))
        noise_layer.putalpha(ImageChops.multiply(noise_layer.split()[-1], mask))
        block = Image.alpha_composite(block, noise_layer)

    base.paste(block, (int(round(x)), int(round(y))), block)


def _render(
    board,
    piece,
    block_size,
    background_image=None,
    colors=None,
    ghost_enabled=False,
    grid_color=None,
    style=None,
    seed=0,
):
    width = BOARD_WIDTH * block_size
    extra_px = int(round(EXTRA_VISIBLE_ROWS * block_size))
    height = VISIBLE_HEIGHT * block_size + extra_px
    palette = colors or COLORS
    style = style or DEFAULT_BLOCK_STYLE
    bg = _prepare_background(background_image, width, height)
    if bg is not None:
        img = bg.convert("RGBA")
    else:
        img = Image.new("RGBA", (width, height), (*palette["X"], 255))
    img = _draw_grid(img, block_size, width, height, grid_color, extra_px)

    if HIDDEN_ROWS > 0:
        hidden_row = HIDDEN_ROWS - 1
        for x in range(BOARD_WIDTH):
            cell = board[hidden_row][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = -block_size + extra_px
                key = f"board:{x}:{hidden_row}:{cell}"
                _draw_block(img, x0, y0, block_size, color, style, key, seed)
    for y in range(VISIBLE_HEIGHT):
        board_y = y + HIDDEN_ROWS
        for x in range(BOARD_WIDTH):
            cell = board[board_y][x]
            if cell:
                color = palette[cell]
                x0 = x * block_size
                y0 = y * block_size + extra_px
                key = f"board:{x}:{board_y}:{cell}"
                _draw_block(img, x0, y0, block_size, color, style, key, seed)

    if ghost_enabled:
        img = _draw_ghost(img, board, piece, block_size, palette[piece["shape"]], extra_px)

    for idx, (x, y) in enumerate(_piece_cells(piece)):
        if HIDDEN_ROWS - 1 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            color = palette[piece["shape"]]
            x0 = x * block_size
            y0 = (y - HIDDEN_ROWS) * block_size + extra_px
            key = f"piece:{idx}"
            _draw_block(img, x0, y0, block_size, color, style, key, seed)

    arr = np.array(img.convert("RGB")).astype(np.float32) / 255.0
    return torch.from_numpy(arr)[None, ...]

