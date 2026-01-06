from .tetris_node import TetriNode

NODE_CLASS_MAPPINGS = {
    "TetriNode": TetriNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TetriNode": "TetriNode",
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
