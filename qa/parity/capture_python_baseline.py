import hashlib
import json
from pathlib import Path

from _runtime import ensure_folder_paths_stub, ensure_repo_path

ensure_repo_path()
ensure_folder_paths_stub()

import tetris_node as tn

BASELINE_PATH = Path(__file__).resolve().parents[1] / "baseline" / "python_baseline.json"

SCENARIOS = [
    {
        "name": "new_then_sync",
        "seed": 123,
        "block_size": 20,
        "actions": ["new", "sync"],
    },
    {
        "name": "movement_and_rotate",
        "seed": 987654321,
        "block_size": 16,
        "actions": ["new", "left", "left", "rotate_cw", "right", "soft_drop", "sync"],
    },
    {
        "name": "hold_and_drop",
        "seed": 42,
        "block_size": 12,
        "actions": ["new", "hold", "hard_drop", "hard_drop", "sync"],
    },
    {
        "name": "mixed_actions",
        "seed": 2026,
        "block_size": 24,
        "actions": [
            "new",
            "rotate_ccw",
            "soft_drop",
            "left",
            "hard_drop",
            "right",
            "down",
            "hard_drop",
            "sync",
        ],
    },
]


def unwrap(result):
    return result["result"][0] if isinstance(result, dict) else result[0]


def tensor_hash(tensor):
    return hashlib.sha256(tensor.detach().cpu().numpy().tobytes()).hexdigest()


def compact_json(payload):
    return json.dumps(payload, separators=(",", ":"))


def run():
    BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    node = tn.TetriNode()
    payload = {
        "meta": {
            "state_version": tn.STATE_VERSION,
            "board_width": tn.BOARD_WIDTH,
            "board_height": tn.BOARD_HEIGHT,
            "visible_height": tn.VISIBLE_HEIGHT,
            "supported_actions": list(tn.TetriNode.INPUT_TYPES()["required"]["action"][0]),
        },
        "scenarios": [],
    }

    for scenario in SCENARIOS:
        state_json = ""
        state_obj = None
        steps = []
        for action in scenario["actions"]:
            result = node.step(
                action=action,
                state=state_json,
                seed=scenario["seed"],
                block_size=scenario["block_size"],
            )
            matrix = unwrap(result)

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

            steps.append(
                {
                    "action": action,
                    "matrix_sha256": tensor_hash(matrix),
                    "matrix_shape": list(matrix.shape),
                    "state_sha256": hashlib.sha256(state_json.encode("utf-8")).hexdigest(),
                    "state_summary": {
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
                    },
                }
            )

        payload["scenarios"].append(
            {
                "name": scenario["name"],
                "seed": scenario["seed"],
                "block_size": scenario["block_size"],
                "actions": scenario["actions"],
                "steps": steps,
            }
        )

    BASELINE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote baseline: {BASELINE_PATH}")


if __name__ == "__main__":
    run()
