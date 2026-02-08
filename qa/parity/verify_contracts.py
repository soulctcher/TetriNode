import re
from pathlib import Path

from _runtime import ensure_folder_paths_stub, ensure_repo_path

ensure_repo_path()
ensure_folder_paths_stub()

import tetris_node as tn


def assert_equal(actual, expected, message):
    if actual != expected:
        raise AssertionError(f"{message}\nactual:   {actual}\nexpected: {expected}")


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def run():
    assert_true(hasattr(tn, "TetriNode"), "TetriNode export missing")

    input_types = tn.TetriNode.INPUT_TYPES()
    expected_actions = [
        "none",
        "sync",
        "left",
        "right",
        "down",
        "rotate_cw",
        "rotate_ccw",
        "soft_drop",
        "hard_drop",
        "hold",
        "new",
    ]
    assert_equal(
        list(input_types["required"]["action"][0]),
        expected_actions,
        "action contract changed",
    )
    assert_equal(tn.TetriNode.RETURN_TYPES, ("IMAGE",), "RETURN_TYPES contract changed")
    assert_equal(tn.TetriNode.RETURN_NAMES, ("matrix",), "RETURN_NAMES contract changed")
    assert_equal(tn.TetriNode.FUNCTION, "step", "FUNCTION contract changed")
    assert_equal(tn.TetriNode.CATEGORY, "games", "CATEGORY contract changed")

    init_text = Path("__init__.py").read_text(encoding="utf-8")
    assert_true("NODE_CLASS_MAPPINGS" in init_text, "NODE_CLASS_MAPPINGS missing")
    assert_true("NODE_DISPLAY_NAME_MAPPINGS" in init_text, "NODE_DISPLAY_NAME_MAPPINGS missing")
    assert_true('"TetriNode": TetriNode' in init_text, "TetriNode mapping missing")
    assert_true('WEB_DIRECTORY = "./js"' in init_text, "WEB_DIRECTORY contract changed")

    js_text = Path("js/tetris_live.js").read_text(encoding="utf-8")
    assert_true(
        re.search(r'const\s+EXT_NAME\s*=\s*"tetrinode\.live";', js_text) is not None,
        "JS extension name contract changed",
    )
    assert_true(
        re.search(r"app\.registerExtension\s*\(", js_text) is not None,
        "registerExtension hook missing",
    )
    print("contracts OK")


if __name__ == "__main__":
    run()
