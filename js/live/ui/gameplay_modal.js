export function renderGameplayModal(node, body, deps) {
  const {
    getConfig,
    updateConfig,
    updateBackendState,
    version,
  } = deps;

  body.innerHTML = "";
  const config = getConfig(node);
  const checkbox = (labelText, key, attach = true) => {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.alignItems = "center";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!config[key];
    input.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = input.checked;
        return next;
      });
      if (key === "anim_lock_flash" && input.checked === false) {
        if (node.__tetrisLive?.state) {
          node.__tetrisLive.state.lockFlash = null;
        }
      }
      updateBackendState(node);
      node.setDirtyCanvas(true, true);
    });
    row.append(input, document.createTextNode(labelText));
    if (attach) {
      body.appendChild(row);
    }
    return row;
  };
  const showControlsRow = checkbox("Show Controls", "show_controls", false);
  const versionLabel = document.createElement("div");
  versionLabel.textContent = `v${version}`;
  versionLabel.style.marginLeft = "auto";
  versionLabel.style.fontSize = "12px";
  versionLabel.style.opacity = "0.8";
  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.alignItems = "center";
  topRow.style.justifyContent = "space-between";
  topRow.append(showControlsRow, versionLabel);
  body.appendChild(topRow);
  checkbox("Ghost Piece", "ghost_piece");
  checkbox("Next Piece", "next_piece");
  checkbox("Hold Queue", "hold_queue");
  checkbox("Grid", "grid_enabled");

  const selectRow = (labelText, key, options) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr";
    row.style.gap = "8px";
    const label = document.createElement("div");
    label.textContent = labelText;
    const select = document.createElement("select");
    options.forEach((value) => {
      const opt = document.createElement("option");
      const optionValue = typeof value === "string" ? value : value.value;
      const optionLabel = typeof value === "string" ? value : value.label;
      opt.value = optionValue;
      opt.textContent = optionLabel;
      if (`${config[key]}` === optionValue) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = select.value;
        return next;
      });
      updateBackendState(node);
    });
    row.append(label, select);
    body.appendChild(row);
  };

  selectRow("Lock Down", "lock_down_mode", [
    { value: "extended", label: "Extended" },
    { value: "infinite", label: "Infinite" },
    { value: "classic", label: "Classic" },
  ]);
  selectRow("Level Progression", "level_progression", [
    { value: "fixed", label: "Fixed" },
    { value: "variable", label: "Variable" },
  ]);

  const numberRow = (labelText, key, min, max) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "140px 1fr";
    row.style.gap = "8px";
    const label = document.createElement("div");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.value = config[key];
    input.addEventListener("change", () => {
      updateConfig(node, (next) => {
        next[key] = Number.parseInt(input.value, 10);
        return next;
      });
      updateBackendState(node);
    });
    row.append(label, input);
    body.appendChild(row);
  };

  numberRow("Start Level", "start_level", 1, 15);
  numberRow("Queue Size", "queue_size", 0, 6);
}
