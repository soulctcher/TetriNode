import sys
import tempfile
import types
from pathlib import Path


def ensure_repo_path() -> None:
    repo = Path(__file__).resolve().parents[2]
    repo_str = str(repo)
    if repo_str not in sys.path:
        sys.path.insert(0, repo_str)


def ensure_folder_paths_stub() -> None:
    if "folder_paths" in sys.modules:
        return
    module = types.ModuleType("folder_paths")
    module.get_temp_directory = lambda: tempfile.gettempdir()
    module.get_save_image_path = lambda prefix, temp_dir, width, height: (
        temp_dir,
        prefix,
        0,
        "",
        "",
    )
    sys.modules["folder_paths"] = module
