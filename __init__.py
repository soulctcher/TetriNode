from .tetris_node import TetriNode, TetriNodeOptions

NODE_CLASS_MAPPINGS = {
    "TetriNode": TetriNode,
    "TetriNodeOptions": TetriNodeOptions,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TetriNode": "TetriNode",
    "TetriNodeOptions": "TetriNode Options",
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
