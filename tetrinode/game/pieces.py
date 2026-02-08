from ..constants import BOARD_HEIGHT, BOARD_WIDTH, SHAPES

def _piece_cells(piece):
    shape = SHAPES[piece["shape"]][piece["rot"] % 4]
    return [(piece["x"] + dx, piece["y"] + dy) for dx, dy in shape]


def _collides(board, piece):
    for x, y in _piece_cells(piece):
        if x < 0 or x >= BOARD_WIDTH or y < 0 or y >= BOARD_HEIGHT:
            return True
        if board[y][x]:
            return True
    return False


def _lock_piece(board, piece):
    for x, y in _piece_cells(piece):
        if 0 <= y < BOARD_HEIGHT and 0 <= x < BOARD_WIDTH:
            board[y][x] = piece["shape"]


def _clear_lines(board):
    remaining = [row for row in board if any(cell == 0 for cell in row)]
    cleared = BOARD_HEIGHT - len(remaining)
    for _ in range(cleared):
        remaining.insert(0, [0 for _ in range(BOARD_WIDTH)])
    return remaining, cleared


def _move(piece, dx, dy):
    return {"shape": piece["shape"], "rot": piece["rot"], "x": piece["x"] + dx, "y": piece["y"] + dy}


def _rotate(piece, delta):
    return {"shape": piece["shape"], "rot": (piece["rot"] + delta) % 4, "x": piece["x"], "y": piece["y"]}


def _kick_table(shape, rot_from, rot_to):
    if shape == "O":
        return [(0, 0)]
    if shape == "I":
        table = {
            (0, 1): [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)],
            (1, 0): [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)],
            (1, 2): [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)],
            (2, 1): [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)],
            (2, 3): [(0, 0), (2, 0), (-1, 0), (2, -1), (-1, 2)],
            (3, 2): [(0, 0), (-2, 0), (1, 0), (-2, 1), (1, -2)],
            (3, 0): [(0, 0), (1, 0), (-2, 0), (1, 2), (-2, -1)],
            (0, 3): [(0, 0), (-1, 0), (2, 0), (-1, -2), (2, 1)],
        }
        return table.get((rot_from, rot_to), [(0, 0)])
    table = {
        (0, 1): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (1, 0): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        (1, 2): [(0, 0), (1, 0), (1, 1), (0, -2), (1, -2)],
        (2, 1): [(0, 0), (-1, 0), (-1, -1), (0, 2), (-1, 2)],
        (2, 3): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
        (3, 2): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (3, 0): [(0, 0), (-1, 0), (-1, 1), (0, -2), (-1, -2)],
        (0, 3): [(0, 0), (1, 0), (1, -1), (0, 2), (1, 2)],
    }
    return table.get((rot_from, rot_to), [(0, 0)])


def _rotate_with_kick(board, piece, delta):
    rot_from = piece["rot"] % 4
    rot_to = (rot_from + delta) % 4
    kicks = _kick_table(piece["shape"], rot_from, rot_to)
    for idx, (dx, dy) in enumerate(kicks):
        candidate = {"shape": piece["shape"], "rot": rot_to, "x": piece["x"] + dx, "y": piece["y"] + dy}
        if not _collides(board, candidate):
            return candidate, idx
    return piece, None


def _corner_occupied(board, x, y):
    if x < 0 or x >= BOARD_WIDTH or y < 0 or y >= BOARD_HEIGHT:
        return True
    return board[y][x] != 0


def _tspin_type_from_corners(board, piece):
    if piece["shape"] != "T":
        return "none"
    cx = piece["x"] + 1
    cy = piece["y"] + 1
    corners = {
        "A": (cx - 1, cy - 1),
        "B": (cx + 1, cy - 1),
        "C": (cx - 1, cy + 1),
        "D": (cx + 1, cy + 1),
    }
    rot = piece["rot"] % 4
    if rot == 0:
        front = ("A", "B")
        back = ("C", "D")
    elif rot == 1:
        front = ("B", "D")
        back = ("A", "C")
    elif rot == 2:
        front = ("C", "D")
        back = ("A", "B")
    else:
        front = ("A", "C")
        back = ("B", "D")
    front_hits = sum(_corner_occupied(board, *corners[k]) for k in front)
    back_hits = sum(_corner_occupied(board, *corners[k]) for k in back)
    total_hits = front_hits + back_hits
    if total_hits < 3:
        return "none"
    if front_hits == 2 and back_hits == 2:
        return "tspin"
    if front_hits == 2 and back_hits >= 1:
        return "tspin"
    if back_hits == 2 and front_hits >= 1:
        return "mini"
    return "none"


def _tspin_type(board, piece, last_action, last_rotate_kick):
    if piece["shape"] != "T" or last_action != "rotate":
        return "none"
    corners = _tspin_type_from_corners(board, piece)
    if corners == "none":
        return "none"
    if last_rotate_kick == 4:
        return "tspin"
    return corners

def _ghost_piece(board, piece):
    ghost = dict(piece)
    moved = _move(ghost, 0, 1)
    while not _collides(board, moved):
        ghost = moved
        moved = _move(ghost, 0, 1)
    return ghost
