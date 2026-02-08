export function createMusicController(deps) {
  const {
    ensureUiState,
    getConfig,
    updateStoredConfig,
    musicTracks,
  } = deps;

  function getExtensionBasePath() {
    if (window.__tetrinodeBasePath) return window.__tetrinodeBasePath;
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const script = scripts.find((item) => item.src && item.src.includes("/js/tetris_live.js"));
    if (script?.src) {
      const base = script.src.replace(/\/js\/tetris_live\.js.*$/, "");
      window.__tetrinodeBasePath = base;
      return base;
    }
    return "";
  }

  function ensureMusicState(node) {
    const ui = ensureUiState(node);
    if (!ui.music) {
      const audio = new Audio();
      audio.loop = true;
      audio.addEventListener("error", () => {
        const err = audio.error;
        ui.music.lastError = err ? `${err.code}` : "unknown";
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ui.music = {
        audio,
        customUrl: null,
        lastTrack: null,
        lastVolume: null,
        lastMuted: null,
        lastCustomPath: null,
        previewing: false,
        unlocked: false,
        lastError: null,
        lastPlayError: null,
        lastUrlStatus: null,
        lastCheckedUrl: null,
        useWebAudio: !!AudioCtx,
        ctx: null,
        gain: null,
        source: null,
        buffer: null,
        loading: null,
      };
    }
    return ui.music;
  }

  function clampMusicVolume(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 100;
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  function updateConfig(node, updater) {
    return updateStoredConfig(node, updater, (targetNode) => {
      if (targetNode) {
        syncMusicFromConfig(targetNode);
      }
    });
  }

  function setMusicVolume(node, value) {
    updateConfig(node, (next) => {
      const volume = clampMusicVolume(value);
      next.music_volume = volume;
      if (volume > 0) {
        next.music_muted = false;
        next.music_prev_volume = volume;
      } else {
        next.music_muted = true;
      }
      return next;
    });
  }

  function toggleMusicMute(node) {
    const config = getConfig(node);
    const volume = clampMusicVolume(config.music_volume ?? 100);
    const isMuted = !!config.music_muted || volume <= 0;
    updateConfig(node, (next) => {
      if (isMuted) {
        const restore = clampMusicVolume(next.music_prev_volume ?? 100) || 100;
        next.music_muted = false;
        next.music_volume = restore;
        next.music_prev_volume = restore;
      } else {
        next.music_prev_volume = volume > 0 ? volume : (next.music_prev_volume ?? 100);
        next.music_muted = true;
        next.music_volume = 0;
      }
      return next;
    });
  }

  function setMusicTrack(node, trackId) {
    updateConfig(node, (next) => {
      next.music_track = trackId;
      return next;
    });
  }

  function setCustomMusicFile(node, file) {
    if (!file) return;
    const music = ensureMusicState(node);
    if (music.customUrl) {
      URL.revokeObjectURL(music.customUrl);
    }
    music.customUrl = URL.createObjectURL(file);
    updateConfig(node, (next) => {
      next.music_custom_path = file.name || "";
      next.music_track = "custom";
      return next;
    });
  }

  function unlockMusic(node) {
    const music = ensureMusicState(node);
    if (music.unlocked) return;
    if (music.useWebAudio) {
      try {
        if (!music.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          music.ctx = AudioCtx ? new AudioCtx() : null;
        }
        if (music.ctx) {
          music.ctx.resume().then(() => {
            music.unlocked = true;
            syncMusicFromConfig(node, true);
          }).catch(() => {
            music.lastPlayError = "unlock_failed";
          });
          return;
        }
      } catch {
        // fallback to HTMLAudio
      }
    }
    const audio = music.audio;
    const prevMuted = audio.muted;
    const prevVolume = audio.volume;
    audio.muted = true;
    audio.volume = 0;
    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = prevMuted;
        audio.volume = prevVolume;
        music.unlocked = true;
        syncMusicFromConfig(node, true);
      })
      .catch(() => {
        audio.muted = prevMuted;
        audio.volume = prevVolume;
        music.lastPlayError = "unlock_failed";
      });
  }

  function toggleMusicPreview(node) {
    unlockMusic(node);
    const music = ensureMusicState(node);
    music.previewing = !music.previewing;
    syncMusicFromConfig(node, true);
  }

  function resolveFallbackTrack(node) {
    const fallbackId = musicTracks[0]?.id || null;
    if (!fallbackId) return { track: "none", url: null };
    return { track: fallbackId, url: resolveMusicTrackUrl(node, fallbackId) };
  }

  function resolveMusicTrackUrl(node, trackId) {
    if (!trackId || trackId === "none") return null;
    if (trackId === "custom") {
      const music = ensureMusicState(node);
      return music.customUrl;
    }
    const entry = musicTracks.find((track) => track.id === trackId);
    if (!entry) return null;
    let base = getExtensionBasePath() || "/extensions/TetriNode";
    if (base && !base.startsWith("http")) {
      base = `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
    }
    const url = `${base}/music/${entry.file}`;
    return url;
  }

  function syncMusicFromConfig(node, force = false) {
    const config = getConfig(node);
    const music = ensureMusicState(node);
    const state = node.__tetrisLive?.state;
    const running = !!(state && state.running && state.started && !state.gameOver && state.hasStartedGame);
    const ui = ensureUiState(node);
    const modalOpen = !!ui?.modal?.el;
    const level = Math.max(1, Number.isFinite(state?.level) ? state.level : 1);
    const progressive = config.music_speed_progressive !== false;
    const rateBase = Math.pow(1.01, Math.max(0, Math.min(level, 10) - 1));
    const rateBonus = (level >= 13 ? 1.03 : 1) * (level >= 15 ? 1.03 : 1);
    const rate = progressive ? rateBase * rateBonus : 1;
    const volumeRaw = Number(config.music_volume ?? 100);
    const volume = Math.max(0, Math.min(100, Number.isFinite(volumeRaw) ? volumeRaw : 100));
    const muted = !!config.music_muted || volume <= 0;
    let track = config.music_track || "none";
    const customPath = config.music_custom_path || "";
    let url = resolveMusicTrackUrl(node, track);
    if (!running && music.previewing && !modalOpen) {
      music.previewing = false;
    }
    const playbackRequested = running || music.previewing;
    if (playbackRequested && !url) {
      const fallback = resolveFallbackTrack(node);
      if (fallback.url) {
        track = fallback.track;
        url = fallback.url;
        if ((config.music_track || "none") !== fallback.track) {
          updateConfig(node, (next) => {
            next.music_track = fallback.track;
            return next;
          });
        }
      }
    }
    const shouldPlay = playbackRequested && !muted && !!url;
    const trackChanged = music.lastTrack !== track || music.lastCustomPath !== customPath;
    if (url && music.lastCheckedUrl !== url) {
      music.lastCheckedUrl = url;
      music.lastUrlStatus = "checking";
      fetch(url, { method: "HEAD" })
        .then((res) => {
          music.lastUrlStatus = res.ok ? `ok:${res.status}` : `err:${res.status}`;
        })
        .catch(() => {
          music.lastUrlStatus = "fetch_failed";
        });
    }
    const desiredVolume = muted ? 0 : volume / 100;
    if (music.useWebAudio) {
      if (!music.ctx) {
        // create context lazily on unlock
      } else if (!music.gain) {
        music.gain = music.ctx.createGain();
        music.gain.connect(music.ctx.destination);
      }
      if (music.gain) {
        music.gain.gain.value = desiredVolume;
        music.lastVolume = desiredVolume;
      }
      if (music.source && music.lastRate !== rate) {
        try {
          music.source.playbackRate.value = rate;
        } catch {}
        music.lastRate = rate;
      }
      if (!shouldPlay || !music.unlocked) {
        if (music.source) {
          try {
            music.source.stop();
          } catch {}
          try {
            music.source.disconnect();
          } catch {}
          music.source = null;
        }
        music.lastMuted = muted;
        return;
      }
      if (trackChanged) {
        music.loading = (async () => {
          try {
            if (!music.ctx) return;
            const response = await fetch(url);
            if (!response.ok) {
              music.lastPlayError = `fetch:${response.status}`;
              return;
            }
            const data = await response.arrayBuffer();
            const buffer = await music.ctx.decodeAudioData(data.slice(0));
            music.buffer = buffer;
            if (music.source) {
              try {
                music.source.stop();
              } catch {}
              try {
                music.source.disconnect();
              } catch {}
            }
            const source = music.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.loopStart = 0;
            source.loopEnd = buffer.duration;
            source.playbackRate.value = rate;
            if (music.gain) {
              source.connect(music.gain);
            } else {
              source.connect(music.ctx.destination);
            }
            source.start(0);
            music.source = source;
            music.lastTrack = track;
            music.lastCustomPath = customPath;
            music.lastRate = rate;
          } catch (err) {
            music.lastPlayError = err ? String(err.message || err) : "decode_failed";
          }
        })();
      } else if (!music.source && music.buffer) {
        try {
          const source = music.ctx.createBufferSource();
          source.buffer = music.buffer;
          source.loop = true;
          source.loopStart = 0;
          source.loopEnd = music.buffer.duration;
          source.playbackRate.value = rate;
          if (music.gain) {
            source.connect(music.gain);
          } else {
            source.connect(music.ctx.destination);
          }
          source.start(0);
          music.source = source;
          music.lastRate = rate;
        } catch (err) {
          music.lastPlayError = err ? String(err.message || err) : "play_failed";
        }
      }
      music.lastMuted = muted;
      return;
    }
    if (trackChanged) {
      if (url) {
        if (music.audio.src !== url) {
          music.audio.src = url;
        }
        music.audio.loop = true;
        music.audio.playbackRate = rate;
        if (shouldPlay && music.unlocked) {
          music.audio.play().catch((err) => {
            music.lastPlayError = err ? String(err.message || err) : "play_failed";
          });
        }
      } else {
        music.audio.pause();
        music.audio.removeAttribute("src");
        music.audio.load();
      }
      music.lastTrack = track;
      music.lastCustomPath = customPath;
    }
    if (force || music.lastVolume !== desiredVolume) {
      music.audio.volume = desiredVolume;
      music.lastVolume = desiredVolume;
    }
    if (force || music.lastRate !== rate) {
      music.audio.playbackRate = rate;
      music.lastRate = rate;
    }
    if (!shouldPlay || !music.unlocked) {
      music.audio.pause();
      music.lastMuted = muted;
      return;
    }
    if (force || music.lastMuted !== muted || music.lastTrack !== track || music.previewing) {
      music.audio.play().catch((err) => {
        music.lastPlayError = err ? String(err.message || err) : "play_failed";
      });
      music.lastMuted = muted;
    }
  }

  return {
    ensureMusicState,
    clampMusicVolume,
    setMusicVolume,
    toggleMusicMute,
    setMusicTrack,
    setCustomMusicFile,
    unlockMusic,
    toggleMusicPreview,
    resolveMusicTrackUrl,
    syncMusicFromConfig,
  };
}
