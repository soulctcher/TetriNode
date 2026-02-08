from typing import Any, TypedDict


class PieceState(TypedDict):
    shape: str
    rot: int
    x: int
    y: int


class GameState(TypedDict, total=False):
    version: int
    board: list[list[Any]]
    bag: list[str]
    bag_count: int
    seed: int
    start_level: int
    level_progression: str
    level: int
    piece: PieceState
    next_piece_shape: str
    hold_piece_shape: str | None
    hold_used: bool
    score: int
    lines_cleared_total: int
    tetrises: int
    tspins: int
    combo_streak: int
    combo_total: int
    goal_lines_total: float
    b2b_active: bool
    game_over: bool
    last_action: str | None
    last_rotate_kick: int | None
    tspin: str
    options: dict[str, Any]
