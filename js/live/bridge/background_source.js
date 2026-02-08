export function createBackgroundImageHelpers(deps) {
  const { app, getInputLink, imageCache } = deps;

  function getInputDataByName(node, name) {
    const idx = node?.inputs?.findIndex((inp) => inp?.name === name);
    if (idx == null || idx < 0) return null;
    if (typeof node.getInputData !== "function") return null;
    return node.getInputData(idx);
  }

  function coerceImageSource(value) {
    if (!value) return null;
    if (
      value instanceof HTMLImageElement ||
      value instanceof HTMLCanvasElement ||
      value instanceof ImageBitmap ||
      value instanceof OffscreenCanvas ||
      value instanceof HTMLVideoElement
    ) {
      return value;
    }
    if (value.image) {
      const img = value.image;
      if (
        img instanceof HTMLImageElement ||
        img instanceof HTMLCanvasElement ||
        img instanceof ImageBitmap ||
        img instanceof OffscreenCanvas
      ) {
        return img;
      }
    }
    return null;
  }

  function toByteArray(data) {
    if (!data) return null;
    if (data instanceof Uint8ClampedArray) return data;
    let array = data;
    if (data instanceof Uint8Array) {
      return new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof Float32Array || data instanceof Float64Array) {
      array = Array.from(data);
    }
    if (Array.isArray(array)) {
      let max = 0;
      for (let i = 0; i < array.length; i += 1) {
        const v = array[i];
        if (Number.isFinite(v) && v > max) max = v;
      }
      const scale = max <= 1 ? 255 : 1;
      const out = new Uint8ClampedArray(array.length);
      for (let i = 0; i < array.length; i += 1) {
        const v = array[i];
        const value = Number.isFinite(v) ? v * scale : 0;
        out[i] = Math.max(0, Math.min(255, Math.round(value)));
      }
      return out;
    }
    return null;
  }

  function buildCanvasFromData(value) {
    if (!value || !value.data || !value.width || !value.height) return null;
    const width = Math.max(1, Math.floor(value.width));
    const height = Math.max(1, Math.floor(value.height));
    const bytes = toByteArray(value.data);
    if (!bytes) return null;
    const expected3 = width * height * 3;
    const expected4 = width * height * 4;
    let pixels = bytes;
    if (bytes.length === expected3) {
      pixels = new Uint8ClampedArray(expected4);
      for (let i = 0; i < width * height; i += 1) {
        const src = i * 3;
        const dst = i * 4;
        pixels[dst] = bytes[src];
        pixels[dst + 1] = bytes[src + 1];
        pixels[dst + 2] = bytes[src + 2];
        pixels[dst + 3] = 255;
      }
    } else if (bytes.length !== expected4) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imgData = new ImageData(pixels, width, height);
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  function buildCanvasFromTensor(value) {
    if (!value || !value.data || !value.shape) return null;
    const shape = Array.isArray(value.shape) ? value.shape : null;
    if (!shape || shape.length < 2) return null;
    let height = null;
    let width = null;
    let channels = null;
    if (shape.length >= 4) {
      channels = shape[shape.length - 1];
      width = shape[shape.length - 2];
      height = shape[shape.length - 3];
    } else if (shape.length === 3) {
      channels = shape[2];
      width = shape[1];
      height = shape[0];
    }
    if (!width || !height || !channels) return null;
    if (channels !== 3 && channels !== 4) return null;
    const frameSize = width * height * channels;
    let data = value.data;
    if (Array.isArray(data)) {
      data = data.slice(0, frameSize);
    } else if (data && typeof data.subarray === "function" && data.length > frameSize) {
      data = data.subarray(0, frameSize);
    }
    return buildCanvasFromData({ data, width, height });
  }

  function getImageInfo(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value[0] || null;
    if (Array.isArray(value.tetrinode_background)) return value.tetrinode_background[0] || null;
    if (Array.isArray(value.ui?.tetrinode_background)) return value.ui.tetrinode_background[0] || null;
    if (Array.isArray(value.images)) return value.images[0] || null;
    if (Array.isArray(value.image)) return value.image[0] || null;
    if (Array.isArray(value.result)) return value.result[0] || null;
    return value;
  }

  function imageInfoUrl(info) {
    if (!info) return null;
    if (typeof info === "string") return info;
    if (info.url) return info.url;
    const filename = info.filename || info.name;
    if (!filename) return null;
    const type = info.type || "temp";
    const subfolder = info.subfolder || "";
    return `./view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`;
  }

  function getImageFromInfo(node, info) {
    const url = imageInfoUrl(info);
    if (!url) return null;
    if (imageCache.has(url)) {
      return imageCache.get(url);
    }
    const img = new Image();
    img.src = url;
    img.addEventListener("load", () => {
      node?.setDirtyCanvas(true, true);
    });
    imageCache.set(url, img);
    return img;
  }

  function getLinkedImageInfo(node, name) {
    const resolved = getInputLink(node, name);
    if (!resolved) return null;
    const { origin, link } = resolved;
    if (!origin) return null;
    const slot = link?.origin_slot ?? 0;
    const outputKey = origin.outputs?.[slot]?.name;
    const outputs = app?.nodeOutputs?.[origin.id] || app?.nodeOutputs?.[`${origin.id}`];
    if (outputs) {
      const candidates = [
        outputKey ? outputs[outputKey] : null,
        outputs.tetrinode_background,
        outputs.ui?.tetrinode_background,
        outputs.images,
        outputs.image,
        outputs.result,
        outputs.output,
      ];
      for (const candidate of candidates) {
        const info = getImageInfo(candidate);
        if (info) return info;
      }
    }
    const linked = origin.outputs?.[slot]?.links || [];
    for (const linkId of linked) {
      const linkInfo = node?.graph?.links?.[linkId];
      if (!linkInfo) continue;
      const targetId = linkInfo.target_id;
      const targetOutputs = app?.nodeOutputs?.[targetId] || app?.nodeOutputs?.[`${targetId}`];
      if (!targetOutputs) continue;
      const previewCandidates = [
        targetOutputs.images,
        targetOutputs.image,
        targetOutputs.result,
        targetOutputs.output,
      ];
      for (const candidate of previewCandidates) {
        const info = getImageInfo(candidate);
        if (info) return info;
      }
    }
    return null;
  }

  function getLinkedImageSource(node, name) {
    const resolved = getInputLink(node, name);
    if (!resolved) return null;
    const { origin, link } = resolved;
    const slot = link?.origin_slot ?? 0;
    if (!origin) return null;
    if (Array.isArray(origin.imgs)) {
      const candidate = origin.imgs[slot] || origin.imgs[0];
      const source = coerceImageSource(candidate);
      if (source) return source;
    }
    if (Array.isArray(origin.images)) {
      const candidate = origin.images[slot] || origin.images[0];
      const source = coerceImageSource(candidate);
      if (source) return source;
    }
    const direct = coerceImageSource(origin.image || origin.img || origin._img || origin._image);
    if (direct) return direct;
    return null;
  }

  function getBackgroundSource(node) {
    const raw = getInputDataByName(node, "background_image");
    let value = Array.isArray(raw) ? raw[0] : raw;
    let source = null;
    let info = null;
    if (!value) {
      source = getLinkedImageSource(node, "background_image");
      value = source;
    }
    if (!value && !source) {
      info = getLinkedImageInfo(node, "background_image");
      if (!info) {
        const selfOutputs = app?.nodeOutputs?.[node?.id] || app?.nodeOutputs?.[`${node?.id}`];
        info = getImageInfo(
          selfOutputs?.tetrinode_background
          || selfOutputs?.ui?.tetrinode_background
          || selfOutputs?.images
          || selfOutputs?.image
          || selfOutputs?.result,
        );
      }
      if (!info) return null;
      value = info;
    }
    if (!node.__tetrisBg) node.__tetrisBg = {};
    if (node.__tetrisBg.value === value && node.__tetrisBg.source) {
      return node.__tetrisBg.source;
    }
    if (!source) {
      source = coerceImageSource(value);
    }
    if (!source) {
      info = info || getImageInfo(value) || getLinkedImageInfo(node, "background_image");
      if (info) value = info;
      source = getImageFromInfo(node, info);
    }
    if (!source) {
      source = buildCanvasFromData(value);
    }
    if (!source) {
      source = buildCanvasFromTensor(value);
    }
    node.__tetrisBg = { value, source };
    return source || null;
  }

  return {
    getBackgroundSource,
  };
}
