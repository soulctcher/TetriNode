import subprocess
import time
from pathlib import Path

import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
COMFY_DIR = ROOT / ".comfyui_test" / "ComfyUI"
VENV_PY = ROOT / ".comfyui_test" / "venv" / "bin" / "python"
ARTIFACT_DIR = ROOT / "qa" / "artifacts" / "standard"
PORT_CANDIDATES = [8340, 8341, 8342, 8343, 8344]


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
            if (window.app?.graph && typeof window.app.graph.clear === "function") {
                window.app.graph.clear();
            }
            const node = LiteGraph.createNode("TetriNode");
            if (!node) return false;
            node.pos = [120, 120];
            window.app.graph.add(node);
            window.app.canvas.selectNode(node);
            return true;
        }"""
    )
    assert_true(created, "Unable to create TetriNode in graph")
    page.wait_for_function(
        """() => {
            const node = (window.app?.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
            return !!node?.__tetrisLive?.state?.piece;
        }"""
    )


def queue_prompt(page):
    return page.evaluate(
        """async () => {
            const app = window.app;
            if (!app) throw new Error("ComfyUI app not available");
            if (typeof app.queuePrompt === "function") {
                await app.queuePrompt(1);
                return "app.queuePrompt";
            }
            if (app.api && typeof app.api.queuePrompt === "function") {
                await app.api.queuePrompt(1);
                return "app.api.queuePrompt";
            }
            if (app.api && typeof app.api.queue === "function") {
                await app.api.queue(1);
                return "app.api.queue";
            }
            throw new Error("No queue prompt function found");
        }"""
    )


def get_live_state(page):
    return page.evaluate(
        """() => {
            const node = (window.app?.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
            if (!node || !node.__tetrisLive) return null;
            const state = node.__tetrisLive.state;
            return {
                running: state.running,
                score: state.score,
                seed: state.seed,
                board: state.board,
                piece: state.piece ? { ...state.piece } : null,
            };
        }"""
    )


def filled_cells(board):
    return sum(cell != 0 for row in (board or []) for cell in row)


def latest_video_path(directory, earliest_mtime):
    candidates = [p for p in directory.glob("**/*.webm") if p.stat().st_mtime >= earliest_mtime]
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def get_rgthree_seed_name(page):
    return page.evaluate(
        """() => {
            const types = window.LiteGraph?.registered_node_types || {};
            const names = Object.keys(types);
            const exact = names.find((name) => name === "Seed (rgthree)");
            if (exact) return exact;
            const match = names.find((name) => name.toLowerCase().includes("rgthree") && name.toLowerCase().includes("seed"));
            return match || null;
        }"""
    )


def run_ui_artifact_smoke():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    proc, base_url = start_server()
    before_path = ARTIFACT_DIR / "standard_before.png"
    after_path = ARTIFACT_DIR / "standard_after.png"
    rgthree_path = ARTIFACT_DIR / "standard_after_rgthree.png"
    target_video = ARTIFACT_DIR / "standard_functionality_play.webm"
    if target_video.exists():
        target_video.unlink()
    record_started = time.time()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                record_video_dir=str(ARTIFACT_DIR),
                viewport={"width": 1280, "height": 960},
            )
            page = context.new_page()
            page.goto(base_url, wait_until="networkidle")
            ensure_tetrinode_node(page)

            state0 = get_live_state(page)
            assert_true(state0 is not None, "Missing live state before movement checks")
            assert_true(state0["running"] is False, "Game should initialize paused")
            board0 = filled_cells(state0["board"])

            page.screenshot(path=str(before_path), full_page=True)

            # Start game and verify core movement controls work.
            page.keyboard.press("Escape")
            time.sleep(0.25)
            state1 = get_live_state(page)
            assert_true(state1["running"] is True, "Escape should start game")

            page.keyboard.press("ArrowLeft")
            time.sleep(0.15)
            state2 = get_live_state(page)
            assert_true(state2["piece"]["x"] < state1["piece"]["x"], "ArrowLeft did not move piece left")

            page.keyboard.press("ArrowRight")
            time.sleep(0.15)
            state3 = get_live_state(page)
            assert_true(state3["piece"]["x"] > state2["piece"]["x"], "ArrowRight did not move piece right")

            page.keyboard.press("Space")
            time.sleep(0.5)
            state4 = get_live_state(page)
            board4 = filled_cells(state4["board"])
            score_changed = state4["score"] != state3["score"]
            piece_changed = state4["piece"] != state3["piece"]
            assert_true(
                board4 > board0 or score_changed or piece_changed,
                "Hard drop did not produce observable board/score/piece change",
            )

            queue_prompt(page)
            time.sleep(0.8)
            page.screenshot(path=str(after_path), full_page=True)

            # Optional rgthree seed integration artifact.
            try:
                page.wait_for_function(
                    """() => {
                        const names = Object.keys(window.LiteGraph?.registered_node_types || {});
                        return names.some((name) => name.toLowerCase().includes("rgthree") && name.toLowerCase().includes("seed"));
                    }""",
                    timeout=5000,
                )
                rgthree_seed_name = get_rgthree_seed_name(page)
            except PlaywrightTimeoutError:
                rgthree_seed_name = None

            if rgthree_seed_name:
                page.evaluate(
                    """(seedName) => {
                        const seedNode = LiteGraph.createNode(seedName);
                        const tetris = (app.graph?._nodes || []).find((n) => n?.comfyClass === "TetriNode");
                        if (!seedNode || !tetris) return false;
                        seedNode.pos = [20, 360];
                        app.graph.add(seedNode);
                        const seedWidget = seedNode.widgets?.find((w) => w.name === "seed");
                        if (seedWidget) {
                            seedWidget.value = 77;
                            const idx = seedNode.widgets.indexOf(seedWidget);
                            if (!seedNode.widgets_values) seedNode.widgets_values = [];
                            if (idx >= 0) seedNode.widgets_values[idx] = 77;
                        }
                        seedNode.connect(0, tetris, "seed");
                        return true;
                    }""",
                    rgthree_seed_name,
                )
                page.keyboard.press("KeyR")
                time.sleep(0.3)
                state5 = get_live_state(page)
                assert_true(state5 is not None, "Missing live state after rgthree reset")
                assert_true(state5["seed"] == 77, f"rgthree seed not applied on reset (got {state5['seed']})")
                queue_prompt(page)
                time.sleep(0.8)
                page.screenshot(path=str(rgthree_path), full_page=True)
            else:
                rgthree_path = None

            context.close()
            browser.close()
    finally:
        stop_server(proc)

    for image_path in (before_path, after_path):
        assert_true(image_path.exists(), f"Missing screenshot: {image_path}")
        assert_true(image_path.stat().st_size > 0, f"Screenshot is empty: {image_path}")
    if rgthree_path is not None:
        assert_true(rgthree_path.exists(), f"Missing rgthree screenshot: {rgthree_path}")
        assert_true(rgthree_path.stat().st_size > 0, f"rgthree screenshot is empty: {rgthree_path}")

    video_path = latest_video_path(ARTIFACT_DIR, earliest_mtime=record_started - 1)
    assert_true(video_path is not None, "No recorded video found")
    video_path.replace(target_video)
    assert_true(target_video.exists(), f"Missing recorded video: {target_video}")
    assert_true(target_video.stat().st_size > 0, f"Recorded video is empty: {target_video}")

    print(f"screenshot_before={before_path}")
    print(f"screenshot_after={after_path}")
    if rgthree_path is not None:
        print(f"screenshot_after_rgthree={rgthree_path}")
    else:
        print("screenshot_after_rgthree=skipped")
    print(f"video={target_video}")
    print("ui_artifact_smoke_ok")


if __name__ == "__main__":
    run_ui_artifact_smoke()
