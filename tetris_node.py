import sys
from pathlib import Path

_THIS_DIR = Path(__file__).resolve().parent
if str(_THIS_DIR) not in sys.path:
    # Keep local package imports working when ComfyUI loads this as a custom node.
    sys.path.insert(0, str(_THIS_DIR))

from tetrinode import node_api as _node_api

for _name in dir(_node_api):
    if _name.startswith("__"):
        continue
    globals()[_name] = getattr(_node_api, _name)

del _name

del _node_api
