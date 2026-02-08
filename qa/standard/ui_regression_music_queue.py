import subprocess
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
COMFY_DIR = ROOT / ".comfyui_test" / "ComfyUI"
VENV_PY = ROOT / ".comfyui_test" / "venv" / "bin" / "python"
PORT_CANDIDATES = [8364, 8365, 8366, 8367, 8368]


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def wait_for_server(base_url, timeout=60):
    for _ in range(timeout):
        try:
            requests.get(f"{base_url}/system_stats", timeout=2)
            return True
        except requests.RequestException:
            time.sleep(1)
    return False


def port_in_use(port):
    try:
        requests.get(f"http://127.0.0.1:{port}/system_stats", timeout=1)
        return True
    except requests.RequestException:
        return False


def start_server():
    for port in PORT_CANDIDATES:
        if port_in_use(port):
            continue
        base_url = f"http://127.0.0.1:{port}"
        proc = subprocess.Popen(
            [str(VENV_PY), str(COMFY_DIR / "main.py"), "--port", str(port), "--listen", "127.0.0.1", "--cpu"],
            cwd=str(COMFY_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if wait_for_server(base_url):
            return proc, base_url
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    raise RuntimeError("ComfyUI server did not start on any candidate port")


def stop_server(proc):
    proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


def ensure_tetrinode_node(page):
    page.wait_for_function("window.app && window.app.graph")
    page.wait_for_function("""() => window.LiteGraph?.registered_node_types?.["TetriNode"]""")
    created = page.evaluate(
        """() => {
            app.graph.clear();
            const node = LiteGraph.createNode("TetriNode");
            if (!node) return false;
            node.pos = [120, 120];
            app.graph.add(node);
            app.canvas.selectNode(node);
            node.setDirtyCanvas(true, true);
            return true;
        }"""
    )
    assert_true(created, "Unable to create TetriNode")
    page.wait_for_function(
        """() => {
            const node = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
            return !!node?.__tetrisLive?.state;
        }"""
    )
    page.wait_for_timeout(500)


def run_ui_regressions():
    proc, base_url = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 960})
            page.goto(base_url, wait_until="networkidle")
            ensure_tetrinode_node(page)

            # Regression 1: Play in Music modal should not be a no-op when track is "none".
            page.keyboard.press("F10")
            page.wait_for_timeout(250)
            page.keyboard.press("KeyM")
            page.wait_for_timeout(300)
            play_button = page.locator("div button", has_text="Play").first
            assert_true(play_button.count() > 0, "Music Play button not found")
            play_button.click()
            page.wait_for_timeout(1000)
            modal_music = page.evaluate(
                """() => {
                    const node = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
                    const cfg = node?.properties?.tetrinode_config || {};
                    const music = node?.__tetrisUi?.music;
                    return {
                        track: cfg.music_track || "none",
                        previewing: !!music?.previewing,
                        hasSource: !!(music?.source || music?.audio?.src),
                        lastPlayError: music?.lastPlayError || null,
                        lastUrlStatus: music?.lastUrlStatus || null,
                    };
                }"""
            )
            assert_true(modal_music["previewing"], f"Preview did not start: {modal_music}")
            assert_true(modal_music["track"] != "none", f"Track did not fall back from none: {modal_music}")
            assert_true(modal_music["hasSource"], f"No audio source after preview Play: {modal_music}")

            # Regression 2: Queue panel bottom must stay aligned to matrix bottom regardless of controls visibility.
            page.keyboard.press("Escape")
            page.wait_for_timeout(250)
            queue_on = page.evaluate(
                """() => {
                    const node = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
                    node?.setDirtyCanvas(true, true);
                    const layout = node?.__tetrisLastLayout || {};
                    return {
                        queueBottom: layout.queueBottom,
                        boardBottom: layout.boardBottom,
                    };
                }"""
            )
            page.evaluate(
                """() => {
                    const node = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
                    if (!node) return;
                    if (!node.properties) node.properties = {};
                    const cfg = node.properties.tetrinode_config || {};
                    cfg.show_controls = false;
                    node.properties.tetrinode_config = cfg;
                    node.setDirtyCanvas(true, true);
                }"""
            )
            page.wait_for_timeout(500)
            queue_off = page.evaluate(
                """() => {
                    const node = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
                    const layout = node?.__tetrisLastLayout || {};
                    return {
                        queueBottom: layout.queueBottom,
                        boardBottom: layout.boardBottom,
                    };
                }"""
            )
            assert_true(queue_on["queueBottom"] is not None, f"Missing queue metrics with controls on: {queue_on}")
            assert_true(queue_off["queueBottom"] is not None, f"Missing queue metrics with controls off: {queue_off}")
            assert_true(
                abs(queue_on["queueBottom"] - queue_on["boardBottom"]) <= 1e-6,
                f"Queue bottom misaligned with controls on: {queue_on}",
            )
            assert_true(
                abs(queue_off["queueBottom"] - queue_off["boardBottom"]) <= 1e-6,
                f"Queue bottom misaligned with controls off: {queue_off}",
            )

            browser.close()
    finally:
        stop_server(proc)

    print("ui_regression_music_queue_ok")


if __name__ == "__main__":
    run_ui_regressions()
