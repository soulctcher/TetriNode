import json
import struct

from ..constants import JS_MUSIC_DIR, MUSIC_BLOB, MUSIC_DIR, MUSIC_FILES, MUSIC_MAGIC

def _unpack_music_blob():
    if not MUSIC_BLOB.exists():
        return
    missing = [name for name in MUSIC_FILES if not (MUSIC_DIR / name).exists()]
    try:
        with MUSIC_BLOB.open("rb") as handle:
            magic = handle.read(len(MUSIC_MAGIC))
            if magic != MUSIC_MAGIC:
                return
            header_len_bytes = handle.read(4)
            if len(header_len_bytes) != 4:
                return
            header_len = struct.unpack(">I", header_len_bytes)[0]
            header_raw = handle.read(header_len)
            header = json.loads(header_raw.decode("utf-8"))
            MUSIC_DIR.mkdir(parents=True, exist_ok=True)
            JS_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
            for entry in header:
                name = entry.get("name")
                size = int(entry.get("size", 0))
                if size <= 0:
                    continue
                data = handle.read(size)
                if name in missing:
                    with (MUSIC_DIR / name).open("wb") as out_file:
                        out_file.write(data)
                js_path = JS_MUSIC_DIR / name
                if not js_path.exists():
                    try:
                        js_path.write_bytes(data)
                    except Exception:
                        pass
        _ensure_js_music()
    except Exception:
        return
def _ensure_js_music():
    try:
        JS_MUSIC_DIR.mkdir(parents=True, exist_ok=True)
        for name in MUSIC_FILES:
            target = JS_MUSIC_DIR / name
            source = MUSIC_DIR / name
            if target.exists() or not source.exists():
                continue
            try:
                target.symlink_to(source)
            except Exception:
                try:
                    target.write_bytes(source.read_bytes())
                except Exception:
                    pass
    except Exception:
        return


_unpack_music_blob()
