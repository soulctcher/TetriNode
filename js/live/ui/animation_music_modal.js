import { MUSIC_TRACKS } from "../data/music_tracks.js";

export function renderAnimationModal(node, body, deps) {
  const {
    getConfig,
    updateConfig,
    updateBackendState,
  } = deps;

  body.innerHTML = "";
  const config = getConfig(node);
  const checkbox = (labelText, key) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = config[key] !== false;
    input.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = input.checked;
        return next;
      });
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
    });
    row.append(input, document.createTextNode(labelText));
    body.appendChild(row);
  };
  checkbox("Hard Drop Trail", "anim_hard_drop_trail");
  checkbox("Lock Flash", "anim_lock_flash");
  checkbox("Line Clear", "anim_line_clear");
  checkbox("Score Toasts", "anim_score_toasts");
}

export function renderMusicModal(node, body, deps) {
  const {
    getConfig,
    clampMusicVolume,
    ensureMusicState,
    resolveMusicTrackUrl,
    unlockMusic,
    setMusicTrack,
    setCustomMusicFile,
    toggleMusicMute,
    setMusicVolume,
    syncMusicFromConfig,
    toggleMusicPreview,
    updateConfig,
  } = deps;

  body.innerHTML = "";
  const config = getConfig(node);
  const musicVolume = clampMusicVolume(config.music_volume ?? 100);
  const musicMuted = !!config.music_muted || musicVolume <= 0;
  const selectedTrack = config.music_track || "none";
  const music = ensureMusicState(node);
  const resolvedUrl = resolveMusicTrackUrl(node, selectedTrack);
  const row = (labelText) => {
    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "140px 1fr";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    const label = document.createElement("div");
    label.textContent = labelText;
    wrap.appendChild(label);
    return { wrap, label };
  };

  const trackRow = row("Track:");
  const select = document.createElement("select");
  const options = [
    { value: "none", label: "None" },
    ...MUSIC_TRACKS.map((track) => ({ value: track.id, label: track.label })),
    { value: "custom", label: "Custom" },
  ];
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    select.appendChild(option);
  });
  select.value = selectedTrack;
  select.addEventListener("change", () => {
    unlockMusic(node);
    setMusicTrack(node, select.value);
    renderMusicModal(node, body, deps);
  });
  trackRow.wrap.appendChild(select);
  body.appendChild(trackRow.wrap);

  const customRow = row("File:");
  const customWrap = document.createElement("div");
  customWrap.style.display = "flex";
  customWrap.style.gap = "8px";
  customWrap.style.alignItems = "center";
  const pathInput = document.createElement("input");
  pathInput.type = "text";
  pathInput.value = config.music_custom_path || "";
  pathInput.placeholder = "Select an .mp3 file...";
  pathInput.readOnly = true;
  pathInput.style.flex = "1";
  const selectBtn = document.createElement("button");
  selectBtn.textContent = "Select";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".mp3";
  fileInput.style.display = "none";
  selectBtn.addEventListener("click", () => {
    unlockMusic(node);
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) {
      setCustomMusicFile(node, file);
      renderMusicModal(node, body, deps);
    }
  });
  const customEnabled = selectedTrack === "custom";
  pathInput.disabled = !customEnabled;
  selectBtn.disabled = !customEnabled;
  customWrap.append(pathInput, selectBtn, fileInput);
  customRow.wrap.appendChild(customWrap);
  body.appendChild(customRow.wrap);

  const volumeRow = row("Volume:");
  const volumeWrap = document.createElement("div");
  volumeWrap.style.display = "flex";
  volumeWrap.style.alignItems = "center";
  volumeWrap.style.gap = "10px";
  const muteBtn = document.createElement("button");
  muteBtn.textContent = musicMuted ? "Muted" : "Mute";
  muteBtn.addEventListener("click", () => {
    unlockMusic(node);
    toggleMusicMute(node);
    renderMusicModal(node, body, deps);
  });
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.value = `${musicVolume}`;
  slider.style.flex = "1";
  slider.addEventListener("input", () => {
    unlockMusic(node);
    setMusicVolume(node, Number(slider.value));
    syncMusicFromConfig(node, true);
    const nextVolume = clampMusicVolume(slider.value);
    muteBtn.textContent = nextVolume <= 0 ? "Muted" : "Mute";
  });
  volumeWrap.append(muteBtn, slider);
  volumeRow.wrap.appendChild(volumeWrap);
  body.appendChild(volumeRow.wrap);

  const previewRow = row("Preview:");
  const previewWrap = document.createElement("div");
  previewWrap.style.display = "flex";
  previewWrap.style.alignItems = "center";
  previewWrap.style.gap = "10px";
  const playBtn = document.createElement("button");
  playBtn.textContent = music.previewing ? "Stop" : "Play";
  playBtn.addEventListener("click", () => {
    toggleMusicPreview(node);
    renderMusicModal(node, body, deps);
  });
  previewWrap.appendChild(playBtn);
  previewRow.wrap.appendChild(previewWrap);
  body.appendChild(previewRow.wrap);

  const speedRow = row("Speed:");
  const speedWrap = document.createElement("div");
  speedWrap.style.display = "flex";
  speedWrap.style.alignItems = "center";
  speedWrap.style.gap = "8px";
  const speedInput = document.createElement("input");
  speedInput.type = "checkbox";
  speedInput.checked = config.music_speed_progressive !== false;
  speedInput.addEventListener("change", () => {
    updateConfig(node, (next) => {
      next.music_speed_progressive = speedInput.checked;
      return next;
    });
    syncMusicFromConfig(node, true);
    renderMusicModal(node, body, deps);
  });
  const speedLabel = document.createElement("div");
  speedLabel.textContent = "Increase with level";
  speedWrap.append(speedInput, speedLabel);
  speedRow.wrap.appendChild(speedWrap);
  body.appendChild(speedRow.wrap);
}
