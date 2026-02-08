import subprocess
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VENV_PY = ROOT / ".comfyui_test" / "venv" / "bin" / "python"
COMFY_NODE_DIR = ROOT / ".comfyui_test" / "ComfyUI" / "custom_nodes" / "TetriNode"


def run_step(name, cmd):
    print(f"[standard] start: {name}")
    subprocess.check_call(cmd, cwd=str(ROOT))
    print(f"[standard] ok: {name}")


def sync_workspace_node():
    if not COMFY_NODE_DIR.exists():
        raise RuntimeError(f"Expected ComfyUI custom node dir at {COMFY_NODE_DIR}")
    for file_name in ("__init__.py", "tetris_node.py"):
        shutil.copy2(ROOT / file_name, COMFY_NODE_DIR / file_name)
    for dir_name in ("js", "tetrinode", "music"):
        src = ROOT / dir_name
        dst = COMFY_NODE_DIR / dir_name
        if dst.exists():
            shutil.rmtree(dst)
        shutil.copytree(src, dst)


def main():
    if not VENV_PY.exists():
        raise RuntimeError(f"Expected venv python at {VENV_PY}")
    print("[standard] start: sync_workspace_node")
    sync_workspace_node()
    print("[standard] ok: sync_workspace_node")

    run_step("python_smoke", [str(VENV_PY), str(ROOT / "tests" / "run_tetris_tests.py")])
    run_step("ui_movement_smoke", [str(VENV_PY), str(ROOT / "tests" / "run_tetris_ui_tests.py")])
    run_step("ui_artifact_smoke", [str(VENV_PY), str(ROOT / "qa" / "standard" / "ui_artifact_smoke.py")])
    run_step(
        "ui_regression_music_queue",
        [str(VENV_PY), str(ROOT / "qa" / "standard" / "ui_regression_music_queue.py")],
    )
    print("standard_suite_ok")


if __name__ == "__main__":
    main()
