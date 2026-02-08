import json

from ..constants import BOARD_HEIGHT, BOARD_WIDTH, SHAPES, STATE_VERSION
from ..game.pieces import _collides
from ..game.rng import _empty_board, _pop_shape, _spawn_piece

def _default_state(seed):
    state = {
        "version": STATE_VERSION,
        "board": _empty_board(),
        "bag": [],
        "bag_count": 0,
        "seed": seed,
        "start_level": 1,
        "level_progression": "fixed",
        "level": 1,
        "piece": None,
        "next_piece_shape": None,
        "hold_piece_shape": None,
        "hold_used": False,
        "score": 0,
        "lines_cleared_total": 0,
        "tetrises": 0,
        "tspins": 0,
        "combo_streak": 0,
        "combo_total": 0,
        "goal_lines_total": 0.0,
        "b2b_active": False,
        "game_over": False,
        "last_action": None,
        "last_rotate_kick": None,
        "tspin": "none",
        "options": {},
    }
    state["piece"] = _spawn_piece(_pop_shape(state))
    state["next_piece_shape"] = _pop_shape(state)
    if _collides(state["board"], state["piece"]):
        state["game_over"] = True
    return state


def _deserialize_state(state_json, seed, enforce_seed=True):
    if not state_json:
        return _default_state(seed)
    try:
        state = json.loads(state_json)
    except json.JSONDecodeError:
        return _default_state(seed)
    if not isinstance(state, dict):
        return _default_state(seed)
    if state.get("version") != STATE_VERSION:
        return _default_state(seed)
    board = state.get("board")
    piece = state.get("piece")
    if not _valid_board(board) or not _valid_piece(piece):
        return _default_state(seed)
    if enforce_seed and state.get("seed") != seed:
        return _default_state(seed)
    if "bag" not in state or "bag_count" not in state:
        state["bag"] = []
        state["bag_count"] = 0
    next_shape = state.get("next_piece_shape")
    if next_shape not in SHAPES:
        state["next_piece_shape"] = _pop_shape(state)
    if "score" not in state:
        state["score"] = 0
    if "lines_cleared_total" not in state:
        state["lines_cleared_total"] = 0
    if "tetrises" not in state:
        state["tetrises"] = 0
    if "tspins" not in state:
        state["tspins"] = 0
    if "combo_streak" not in state:
        state["combo_streak"] = 0
    if "combo_total" not in state:
        state["combo_total"] = 0
    if "goal_lines_total" not in state:
        state["goal_lines_total"] = float(state.get("lines_cleared_total", 0))
    if "b2b_active" not in state:
        state["b2b_active"] = False
    if "game_over" not in state:
        state["game_over"] = False
    if "start_level" not in state:
        state["start_level"] = 1
    if "level_progression" not in state:
        state["level_progression"] = "fixed"
    if "level" not in state:
        state["level"] = state.get("start_level", 1)
    if "last_action" not in state:
        state["last_action"] = None
    if "last_rotate_kick" not in state:
        state["last_rotate_kick"] = None
    if "tspin" not in state:
        state["tspin"] = "none"
    if "options" not in state:
        state["options"] = {}
    if "hold_piece_shape" not in state:
        state["hold_piece_shape"] = None
    if state.get("hold_piece_shape") not in SHAPES:
        state["hold_piece_shape"] = None
    if "hold_used" not in state:
        state["hold_used"] = False
    return state


def _valid_board(board):
    if not isinstance(board, list) or len(board) != BOARD_HEIGHT:
        return False
    for row in board:
        if not isinstance(row, list) or len(row) != BOARD_WIDTH:
            return False
        for cell in row:
            if cell != 0 and cell not in SHAPES:
                return False
    return True


def _valid_piece(piece):
    if not isinstance(piece, dict):
        return False
    shape = piece.get("shape")
    if shape not in SHAPES:
        return False
    for key in ("rot", "x", "y"):
        if not isinstance(piece.get(key), int):
            return False
    return True
