import random

from ..constants import BOARD_HEIGHT, BOARD_WIDTH, SHAPES, SPAWN_Y

def _empty_board():
    return [[0 for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]


def _new_bag(seed, bag_count):
    rng = random.Random(seed + bag_count)
    bag = list(SHAPES.keys())
    rng.shuffle(bag)
    return bag


def _pop_shape(state):
    if not state["bag"]:
        state["bag"] = _new_bag(state["seed"], state["bag_count"])
        state["bag_count"] += 1
    return state["bag"].pop(0)


def _spawn_piece(shape):
    return {"shape": shape, "rot": 0, "x": 3, "y": SPAWN_Y}

