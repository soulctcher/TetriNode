from ..constants import SHAPES
from .pieces import (
    _clear_lines,
    _collides,
    _lock_piece,
    _move,
    _rotate_with_kick,
    _tspin_type,
)
from .rng import _pop_shape, _spawn_piece
from .scoring import _awarded_goal_lines, _calc_level, _score_action, _update_stats


def _lock_and_advance_state(state_obj, board, piece, next_shape):
    _lock_piece(board, piece)
    state_obj["tspin"] = _tspin_type(
        board, piece, state_obj["last_action"], state_obj["last_rotate_kick"]
    )
    board, cleared = _clear_lines(board)
    _update_stats(state_obj, cleared)
    level_before = state_obj.get("level", 1)
    prev_b2b = state_obj.get("b2b_active", False)
    gained, next_b2b = _score_action(level_before, cleared, state_obj["tspin"], prev_b2b)
    state_obj["score"] += gained
    state_obj["b2b_active"] = next_b2b
    state_obj["lines_cleared_total"] += cleared
    progression = state_obj.get("level_progression", "fixed")
    if progression == "variable":
        state_obj["goal_lines_total"] += _awarded_goal_lines(
            cleared,
            state_obj["tspin"],
            prev_b2b,
        )
    else:
        state_obj["goal_lines_total"] = float(state_obj["lines_cleared_total"])
    state_obj["level"] = _calc_level(
        state_obj.get("start_level", 1),
        state_obj["goal_lines_total"],
        progression,
    )
    piece = _spawn_piece(next_shape)
    next_shape = _pop_shape(state_obj)
    state_obj["hold_used"] = False
    if _collides(board, piece):
        state_obj["game_over"] = True
    return board, piece, next_shape


def _apply_action_step(state_obj, action):
    board = state_obj["board"]
    piece = state_obj["piece"]
    next_shape = state_obj["next_piece_shape"]
    if action == "left":
        moved = _move(piece, -1, 0)
        if not _collides(board, moved):
            piece = moved
            state_obj["last_action"] = "move"
            state_obj["last_rotate_kick"] = None
    elif action == "right":
        moved = _move(piece, 1, 0)
        if not _collides(board, moved):
            piece = moved
            state_obj["last_action"] = "move"
            state_obj["last_rotate_kick"] = None
    elif action in {"down", "soft_drop"}:
        moved = _move(piece, 0, 1)
        if not _collides(board, moved):
            piece = moved
            state_obj["last_action"] = "move"
            state_obj["last_rotate_kick"] = None
            if action == "soft_drop":
                state_obj["score"] += 1
    elif action == "rotate_cw":
        piece, kick = _rotate_with_kick(board, piece, 1)
        if piece["rot"] != state_obj["piece"]["rot"] or kick is not None:
            state_obj["last_action"] = "rotate"
            state_obj["last_rotate_kick"] = kick
    elif action == "rotate_ccw":
        piece, kick = _rotate_with_kick(board, piece, -1)
        if piece["rot"] != state_obj["piece"]["rot"] or kick is not None:
            state_obj["last_action"] = "rotate"
            state_obj["last_rotate_kick"] = kick
    elif action == "hard_drop":
        drop_distance = 0
        moved = _move(piece, 0, 1)
        while not _collides(board, moved):
            piece = moved
            drop_distance += 1
            moved = _move(piece, 0, 1)
        if drop_distance:
            state_obj["score"] += 2 * drop_distance
    elif action == "hold":
        if not state_obj.get("hold_used", False):
            hold_shape = state_obj.get("hold_piece_shape")
            state_obj["hold_used"] = True
            state_obj["last_action"] = "hold"
            state_obj["last_rotate_kick"] = None
            state_obj["tspin"] = "none"
            if hold_shape in SHAPES:
                state_obj["hold_piece_shape"] = piece["shape"]
                piece = _spawn_piece(hold_shape)
            else:
                state_obj["hold_piece_shape"] = piece["shape"]
                piece = _spawn_piece(next_shape)
                next_shape = _pop_shape(state_obj)
            if _collides(board, piece):
                state_obj["game_over"] = True

    if action not in {"hard_drop", "down", "soft_drop"}:
        moved = _move(piece, 0, 1)
        if not _collides(board, moved):
            piece = moved
        else:
            board, piece, next_shape = _lock_and_advance_state(state_obj, board, piece, next_shape)
    elif action in {"hard_drop", "down", "soft_drop"}:
        moved = _move(piece, 0, 1)
        if _collides(board, moved):
            board, piece, next_shape = _lock_and_advance_state(state_obj, board, piece, next_shape)

    state_obj["board"] = board
    state_obj["piece"] = piece
    state_obj["next_piece_shape"] = next_shape
    return state_obj
