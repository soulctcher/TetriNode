import hashlib
import json
from pathlib import Path

from _runtime import ensure_folder_paths_stub, ensure_repo_path

ensure_repo_path()
ensure_folder_paths_stub()

import tetris_node as tn

BASELINE_PATH = Path(__file__).resolve().parents[1] / "baseline" / "python_baseline.json"


def unwrap(result):
    return result["result"][0] if isinstance(result, dict) else result[0]


def tensor_hash(tensor):
    return hashlib.sha256(tensor.detach().cpu().numpy().tobytes()).hexdigest()


def compact_json(payload):
    return json.dumps(payload, separators=(",", ":"))


def assert_equal(actual, expected, message):
    if actual != expected:
        raise AssertionError(f"{message}\nactual:   {actual}\nexpected: {expected}")


def run():
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    node = tn.TetriNode()
    for scenario in baseline["scenarios"]:
        state_json = ""
        state_obj = None
        for expected in scenario["steps"]:
            action = expected["action"]
            result = node.step(
                action=action,
                state=state_json,
                seed=scenario["seed"],
                block_size=scenario["block_size"],
            )
            matrix = unwrap(result)
            assert_equal(
                tensor_hash(matrix),
                expected["matrix_sha256"],
                f"matrix hash mismatch: {scenario['name']}:{action}",
            )
            assert_equal(
                list(matrix.shape),
                expected["matrix_shape"],
                f"matrix shape mismatch: {scenario['name']}:{action}",
            )

            if action == "new":
                state_obj = tn._default_state(scenario["seed"])
                state_json = compact_json(state_obj)
            elif action == "sync":
                state_obj = tn._deserialize_state(state_json, scenario["seed"], enforce_seed=False)
            else:
                if state_obj is None:
                    state_obj = tn._deserialize_state(state_json, scenario["seed"], enforce_seed=True)
                tn._apply_action_step(state_obj, action)
                state_json = compact_json(state_obj)

            state_hash = hashlib.sha256(state_json.encode("utf-8")).hexdigest()
            assert_equal(
                state_hash,
                expected["state_sha256"],
                f"state hash mismatch: {scenario['name']}:{action}",
            )
            summary = {
                "score": state_obj.get("score"),
                "level": state_obj.get("level"),
                "lines_cleared_total": state_obj.get("lines_cleared_total"),
                "goal_lines_total": state_obj.get("goal_lines_total"),
                "piece": state_obj.get("piece"),
                "next_piece_shape": state_obj.get("next_piece_shape"),
                "hold_piece_shape": state_obj.get("hold_piece_shape"),
                "hold_used": state_obj.get("hold_used"),
                "b2b_active": state_obj.get("b2b_active"),
                "tspin": state_obj.get("tspin"),
                "game_over": state_obj.get("game_over"),
            }
            assert_equal(
                summary,
                expected["state_summary"],
                f"state summary mismatch: {scenario['name']}:{action}",
            )
    print("python parity OK")


if __name__ == "__main__":
    run()
