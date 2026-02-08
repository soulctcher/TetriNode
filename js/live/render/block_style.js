export function createBlockStyleHelpers(deps) {
  const {
    getConfig,
    defaultConfig,
    adjustColorHsl,
    mixColors,
    parseColorComponents,
    rgbaString,
    adjustColorByFactor,
    textures,
  } = deps;

  const blockStyleTextures = new Map();
  const pixelatedTextureSampleRatio = 0.25;
  const textureSamplePx = 200;
  const randomTextureIds = new Set(["pixelated", "wooden", "concrete", "brushed_metal", "toxic_slime"]);

  function getBlockStyle(node) {
    const config = getConfig(node);
    const style = config.block_style || defaultConfig.block_style;
    return {
      border: Math.max(0, Math.min(4, Number(style.border) || 0)),
      border_blur: Math.max(0, Math.min(6, Number(style.border_blur) || 0)),
      gradient: Math.max(0, Math.min(2, Number(style.gradient) || 0)),
      gradient_angle: Number.isFinite(Number(style.gradient_angle)) ? Number(style.gradient_angle) : 0,
      fill_blur: Math.max(0, Math.min(6, Number(style.fill_blur ?? style.blur) || 0)),
      alpha: Math.max(0, Math.min(1, Number(style.alpha ?? 1))),
      clearcoat: Math.max(0, Math.min(1, Number(style.clearcoat) || 0)),
      clearcoat_size: Math.max(0, Math.min(1, Number(style.clearcoat_size) || 0)),
      rim_light: Math.max(0, Math.min(1, Number(style.rim_light) || 0)),
      roughness: Math.max(0, Math.min(1, Number(style.roughness) || 0)),
      metallic: Math.max(0, Math.min(2, Number(style.metallic) || 0)),
      scanlines: Math.max(0, Math.min(1, Number(style.scanlines) || 0)),
      shadow: Math.max(0, Math.min(3, Number(style.shadow) || 0)),
      shadow_angle: Number.isFinite(Number(style.shadow_angle)) ? Number(style.shadow_angle) : 0,
      corner_radius: Math.max(0, Math.min(10, Number(style.corner_radius) || 0)),
      bevel: Math.max(0, Math.min(1, Number(style.bevel) || 0)),
      specular_size: Math.max(0, Math.min(1, Number(style.specular_size) || 0)),
      specular_strength: Math.max(0, Math.min(1, Number(style.specular_strength) || 0)),
      inner_shadow: Math.max(0, Math.min(8, Number(style.inner_shadow) || 0)),
      inner_shadow_strength: Math.max(0, Math.min(1, Number(style.inner_shadow_strength) || 0)),
      outline_opacity: Math.max(0, Math.min(1, Number(style.outline_opacity) || 0)),
      gradient_contrast: Math.max(0, Math.min(1, Number(style.gradient_contrast) || 0)),
      saturation_shift: Math.max(-1, Math.min(1, Number(style.saturation_shift) || 0)),
      brightness_shift: Math.max(-0.3, Math.min(0.3, Number(style.brightness_shift) || 0)),
      noise: Math.max(0, Math.min(1, Number(style.noise) || 0)),
      glow: Math.max(0, Math.min(10, Number(style.glow) || 0)),
      glow_opacity: Math.max(0, Math.min(1, Number(style.glow_opacity) || 0)),
      pixel_snap: Math.max(0, Math.min(1, Number(style.pixel_snap) || 0)),
      texture_id: typeof style.texture_id === "string" ? style.texture_id : "",
      texture_opacity: Math.max(0, Math.min(1, Number(style.texture_opacity) || 0)),
      texture_scale: Math.max(0.1, Math.min(4, Number(style.texture_scale) || 1)),
      texture_angle: Number.isFinite(Number(style.texture_angle)) ? Number(style.texture_angle) : 0,
    };
  }

  function getBlockStyleTexturePattern(ctx, textureId, node) {
    if (!textureId) return null;
    if (!blockStyleTextures.has(textureId)) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      if (textureId === "brushed_metal") {
        image.src = textures.brushedMetalTextureData;
      } else if (textureId === "wooden") {
        image.src = textures.woodenTextureData;
      } else if (textureId === "concrete") {
        image.src = textures.concreteTextureData;
      } else if (textureId === "pixelated") {
        image.src = textures.pixelatedTextureData;
      } else if (textureId === "toxic_slime") {
        image.src = textures.toxicSlimeTextureData;
      }
      const entry = { image, ready: false, patterns: new WeakMap() };
      image.onload = () => {
        entry.ready = true;
        if (node?.__tetrisLive) {
          node.__tetrisLive.boardDirty = true;
          node.__tetrisLive.boardCacheKey = null;
        }
        if (node?.__tetrisUi?.blockStylePreviewDraw) {
          node.__tetrisUi.blockStylePreviewDraw();
        }
        if (window.app?.canvas?.setDirty) {
          window.app.canvas.setDirty(true);
        } else if (node?.setDirtyCanvas) {
          node.setDirtyCanvas(true, true);
        }
      };
      blockStyleTextures.set(textureId, entry);
    }
    const entry = blockStyleTextures.get(textureId);
    if (!entry || !entry.ready) return null;
    if (entry.patterns.has(ctx)) {
      return { pattern: entry.patterns.get(ctx), image: entry.image };
    }
    const pattern = ctx.createPattern(entry.image, "repeat");
    entry.patterns.set(ctx, pattern);
    return { pattern, image: entry.image };
  }

  function drawBlockSized(ctx, x, y, size, color, node, textureTransform = null) {
    const style = node ? getBlockStyle(node) : defaultConfig.block_style;
    const borderSize = style.border;
    const gradientStrength = style.gradient;
    const angle = ((style.gradient_angle % 360) + 360) % 360;
    const fillBlur = style.fill_blur;
    const alpha = style.alpha ?? 1;
    const clearcoat = style.clearcoat;
    const clearcoatSize = style.clearcoat_size;
    const rimLight = style.rim_light;
    const roughness = style.roughness;
    const metallic = style.metallic;
    const scanlines = style.scanlines;
    const shadowStrength = style.shadow;
    const shadowAngle = ((style.shadow_angle % 360) + 360) % 360;
    const cornerRadius = style.corner_radius;
    const bevel = style.bevel;
    const specularSize = style.specular_size;
    const specularStrength = style.specular_strength;
    const innerShadow = style.inner_shadow;
    const innerShadowStrength = style.inner_shadow_strength;
    const outlineOpacity = style.outline_opacity;
    const gradientContrast = style.gradient_contrast;
    const saturationShift = style.saturation_shift;
    const brightnessShift = style.brightness_shift;
    const noise = style.noise;
    const glow = style.glow;
    const glowOpacity = style.glow_opacity;
    const pixelSnap = style.pixel_snap;
    const textureId = style.texture_id;
    const textureOpacity = style.texture_opacity;
    const textureScale = style.texture_scale;
    const textureAngle = ((style.texture_angle % 360) + 360) % 360;
    const shrink = pixelSnap >= 0.5 ? 1 : 0;
    const innerSize = size - 1 - shrink;
    const drawX = x + shrink / 2;
    const drawY = y + shrink / 2;
    let baseColor = adjustColorHsl(color, saturationShift, brightnessShift);
    const metallicStrength = Math.min(1, metallic);
    const metallicBoost = Math.max(0, metallic - 1);
    const specularColor = mixColors(baseColor, "rgba(255,255,255,1)", 1 - metallicStrength);
    if (metallic > 0) {
      baseColor = adjustColorByFactor(baseColor, -0.2 * metallicStrength - 0.2 * metallicBoost);
    }
    const baseParsed = parseColorComponents(baseColor);
    baseColor = rgbaString(
      {
        r: baseParsed.r,
        g: baseParsed.g,
        b: baseParsed.b,
        a: (baseParsed.a ?? 1) * alpha,
      },
      true,
    );
    const borderBase = rgbaString(
      {
        r: baseParsed.r,
        g: baseParsed.g,
        b: baseParsed.b,
        a: 1,
      },
      true,
    );
    const darkerEdge = adjustColorByFactor(borderBase, -0.4);
    const effectiveSpecStrength = specularStrength * (1 - roughness);
    const effectiveSpecSize = Math.min(1, specularSize + roughness * 0.35);
    const effectiveGradient = gradientStrength * (1 - roughness * 0.35);
    ctx.save();
    if (glow > 0 && glowOpacity > 0) {
      const glowParsed = parseColorComponents(adjustColorByFactor(baseColor, 0.25));
      const glowAlpha = Math.min(1, Math.max(0, glowOpacity)) * (glowParsed.a ?? 1);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = rgbaString(
        { r: glowParsed.r, g: glowParsed.g, b: glowParsed.b, a: glowAlpha },
        true,
      );
      ctx.shadowBlur = glow * 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = rgbaString(
        {
          r: glowParsed.r,
          g: glowParsed.g,
          b: glowParsed.b,
          a: Math.min(0.6, glowAlpha * 0.4),
        },
        true,
      );
      if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
        ctx.fill();
      } else {
        ctx.fillRect(drawX, drawY, innerSize, innerSize);
      }
      ctx.restore();
    }
    if (shadowStrength > 0) {
      const rad = (shadowAngle * Math.PI) / 180;
      const offset = shadowStrength * 4;
      ctx.shadowColor = `rgba(0,0,0,${Math.min(0.6, 0.2 + shadowStrength * 0.6)})`;
      ctx.shadowBlur = shadowStrength * 8;
      ctx.shadowOffsetX = Math.cos(rad) * offset;
      ctx.shadowOffsetY = Math.sin(rad) * offset;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.filter = fillBlur > 0 ? `blur(${fillBlur}px)` : "none";
    if (effectiveGradient > 0) {
      const rad = (angle * Math.PI) / 180;
      const half = innerSize / 2;
      const dx = Math.cos(rad) * half;
      const dy = Math.sin(rad) * half;
      const gradient = ctx.createLinearGradient(
        drawX + half - dx,
        drawY + half - dy,
        drawX + half + dx,
        drawY + half + dy,
      );
      const contrast = effectiveGradient * Math.max(0.2, gradientContrast);
      gradient.addColorStop(0, adjustColorByFactor(baseColor, contrast * 0.4));
      gradient.addColorStop(1, adjustColorByFactor(baseColor, -contrast * 0.4));
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = baseColor;
    }
    if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
      ctx.fill();
    } else {
      ctx.fillRect(drawX, drawY, innerSize, innerSize);
    }
    if (bevel > 0) {
      const bevelGrad = ctx.createLinearGradient(drawX, drawY, drawX + innerSize, drawY + innerSize);
      bevelGrad.addColorStop(0, `rgba(255,255,255,${bevel * 0.35})`);
      bevelGrad.addColorStop(1, `rgba(0,0,0,${bevel * 0.3})`);
      ctx.fillStyle = bevelGrad;
      if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
        ctx.fill();
      } else {
        ctx.fillRect(drawX, drawY, innerSize, innerSize);
      }
    }
    if (effectiveSpecStrength > 0 && effectiveSpecSize > 0) {
      const radius = Math.max(4, innerSize * effectiveSpecSize);
      const grad = ctx.createRadialGradient(drawX + radius * 0.6, drawY + radius * 0.6, 0, drawX + radius * 0.6, drawY + radius * 0.6, radius);
      const spec = parseColorComponents(specularColor);
      grad.addColorStop(0, `rgba(${spec.r},${spec.g},${spec.b},${effectiveSpecStrength * 0.6})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
        ctx.fill();
      } else {
        ctx.fillRect(drawX, drawY, innerSize, innerSize);
      }
    }
    if (clearcoat > 0 && clearcoatSize > 0) {
      const radius = Math.max(3, innerSize * clearcoatSize * 0.6);
      const grad = ctx.createRadialGradient(drawX + radius * 0.55, drawY + radius * 0.5, 0, drawX + radius * 0.55, drawY + radius * 0.5, radius);
      grad.addColorStop(0, `rgba(255,255,255,${clearcoat * 0.7})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
        ctx.fill();
      } else {
        ctx.fillRect(drawX, drawY, innerSize, innerSize);
      }
    }
    if (rimLight > 0) {
      const rad = ctx.createRadialGradient(
        drawX + innerSize / 2,
        drawY + innerSize / 2,
        innerSize * 0.2,
        drawX + innerSize / 2,
        drawY + innerSize / 2,
        innerSize * 0.65,
      );
      rad.addColorStop(0, "rgba(255,255,255,0)");
      rad.addColorStop(1, `rgba(255,255,255,${rimLight * 0.45})`);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = rad;
      if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
        ctx.fill();
      } else {
        ctx.fillRect(drawX, drawY, innerSize, innerSize);
      }
      ctx.restore();
    }
    if (innerShadow > 0 && innerShadowStrength > 0) {
      ctx.strokeStyle = `rgba(0,0,0,${innerShadowStrength * 0.6})`;
      ctx.lineWidth = innerShadow;
      const inset = innerShadow / 2;
      ctx.strokeRect(drawX + inset, drawY + inset, innerSize - innerShadow, innerSize - innerShadow);
    }
    if (scanlines > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.4, scanlines * 0.6);
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      const step = Math.max(2, Math.floor(innerSize / 6));
      for (let yy = Math.floor(drawY) + step; yy < drawY + innerSize; yy += step) {
        ctx.beginPath();
        ctx.moveTo(drawX, yy);
        ctx.lineTo(drawX + innerSize, yy);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (textureId && textureOpacity > 0) {
      if (!blockStyleTextures.has(textureId)) {
        getBlockStyleTexturePattern(ctx, textureId, node);
      }
      const texture = getBlockStyleTexturePattern(ctx, textureId, node);
      if (texture?.image?.width) {
        const img = texture.image;
        let srcX = 0;
        let srcY = 0;
        let srcW = img.width;
        let srcH = img.height;
        let extraRotation = 0;
        let flipX = false;
        let flipY = false;
        if (textureTransform && randomTextureIds.has(textureId)) {
          if (textureId === "pixelated") {
            const ratio = Math.max(0.01, Math.min(1, textureTransform.size ?? pixelatedTextureSampleRatio));
            srcW = Math.max(1, Math.round(img.width * ratio));
            srcH = Math.max(1, Math.round(img.height * ratio));
          } else {
            srcW = Math.max(1, Math.min(textureSamplePx, img.width));
            srcH = Math.max(1, Math.min(textureSamplePx, img.height));
          }
          const maxX = Math.max(0, img.width - srcW);
          const maxY = Math.max(0, img.height - srcH);
          srcX = Math.floor(maxX * (textureTransform.u ?? 0));
          srcY = Math.floor(maxY * (textureTransform.v ?? 0));
          extraRotation = textureTransform.rotation ?? 0;
          flipX = !!textureTransform.flipX;
          flipY = !!textureTransform.flipY;
        }
        const scaleBase = Math.max(innerSize / srcW, innerSize / srcH);
        const drawW = srcW * scaleBase * textureScale;
        const drawH = srcH * scaleBase * textureScale;
        ctx.save();
        if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, innerSize, innerSize, Math.min(cornerRadius, innerSize / 2));
          ctx.clip();
        } else {
          ctx.beginPath();
          ctx.rect(drawX, drawY, innerSize, innerSize);
          ctx.clip();
        }
        ctx.globalAlpha = Math.min(1, textureOpacity);
        ctx.globalCompositeOperation = "multiply";
        ctx.translate(drawX + innerSize / 2, drawY + innerSize / 2);
        ctx.rotate(((textureAngle + extraRotation) * Math.PI) / 180);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(img, srcX, srcY, srcW, srcH, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }
    }
    ctx.restore();
    if (borderSize > 0) {
      const edgeParsed = parseColorComponents(darkerEdge);
      const borderColor = rgbaString(
        {
          r: edgeParsed.r,
          g: edgeParsed.g,
          b: edgeParsed.b,
          a: outlineOpacity,
        },
        true,
      );
      const inset = borderSize / 2;
      const strokeBorder = () => {
        if (cornerRadius > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(
            drawX + inset,
            drawY + inset,
            innerSize - borderSize,
            innerSize - borderSize,
            Math.max(0, Math.min(cornerRadius - inset, innerSize / 2)),
          );
          ctx.stroke();
        } else {
          ctx.strokeRect(drawX + inset, drawY + inset, innerSize - borderSize, innerSize - borderSize);
        }
      };
      ctx.save();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderSize;
      if (glow > 0 && glowOpacity > 0) {
        const glowParsed = parseColorComponents(adjustColorByFactor(borderBase, 0.25));
        const glowAlpha = Math.min(1, Math.max(0, glowOpacity)) * (glowParsed.a ?? 1);
        ctx.shadowColor = rgbaString(
          { r: glowParsed.r, g: glowParsed.g, b: glowParsed.b, a: glowAlpha },
          true,
        );
        ctx.shadowBlur = glow * 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalCompositeOperation = "lighter";
        strokeBorder();
      }
      if (style.border_blur > 0) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
        ctx.filter = `blur(${style.border_blur}px)`;
        strokeBorder();
      } else if (glow <= 0 || glowOpacity <= 0) {
        strokeBorder();
      }
      ctx.restore();
    }
    if (noise > 0) {
      ctx.save();
      const count = Math.max(4, Math.ceil(40 * noise));
      ctx.globalAlpha = Math.min(1, 0.3 + noise * 0.7);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < count; i += 1) {
        const nxSeed = Math.sin((drawX + drawY + i * 13) * 12.9898) * 43758.5453;
        const nySeed = Math.cos((drawX + drawY + i * 7) * 78.233) * 43758.5453;
        const nx = drawX + Math.abs(nxSeed % 1) * innerSize;
        const ny = drawY + Math.abs(nySeed % 1) * innerSize;
        ctx.fillRect(nx, ny, 1, 1);
      }
      ctx.globalAlpha = Math.min(1, noise * 0.5);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      for (let i = 0; i < Math.ceil(count / 2); i += 1) {
        const nxSeed = Math.sin((drawX + drawY + i * 17) * 33.333) * 12345.6789;
        const nySeed = Math.cos((drawX + drawY + i * 9) * 45.678) * 98765.4321;
        const nx = drawX + Math.abs(nxSeed % 1) * innerSize;
        const ny = drawY + Math.abs(nySeed % 1) * innerSize;
        ctx.fillRect(nx, ny, 1, 1);
      }
      ctx.restore();
    }
  }

  return {
    getBlockStyle,
    getBlockStyleTexturePattern,
    drawBlockSized,
  };
}
