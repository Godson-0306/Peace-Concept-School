"""Build zip archives for DirectAdmin Python + Node app uploads."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist-directadmin"

BACKEND_SKIP_DIRS = {
    ".venv",
    "venv",
    "__pycache__",
    ".git",
    "staticfiles",
    "media",
    "school-magazine",
}
BACKEND_SKIP_FILES = {"db.sqlite3", ".env"}
FRONTEND_SKIP_DIRS = {"node_modules", ".next", "out"}
FRONTEND_SKIP_FILES = {".env.local", ".env.production.local", ".env"}


def should_skip(path: Path, skip_dirs: set[str]) -> bool:
    return any(part in skip_dirs for part in path.parts)


def add_tree(zf: zipfile.ZipFile, source: Path, skip_dirs: set[str], skip_files: set[str]) -> int:
    count = 0
    for file_path in source.rglob("*"):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(source)
        if should_skip(rel, skip_dirs):
            continue
        if file_path.name in skip_files:
            continue
        if file_path.suffix in {".pyc", ".pyo"}:
            continue
        zf.write(file_path, rel.as_posix())
        count += 1
    return count


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    backend_zip = OUT / "pcs-api-backend.zip"
    frontend_zip = OUT / "pcs-web-frontend.zip"

    with zipfile.ZipFile(backend_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        n = add_tree(zf, ROOT / "backend", BACKEND_SKIP_DIRS, BACKEND_SKIP_FILES)
    print(f"Wrote {backend_zip} ({n} files)")

    with zipfile.ZipFile(frontend_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        n = add_tree(zf, ROOT / "frontend", FRONTEND_SKIP_DIRS, FRONTEND_SKIP_FILES)
    print(f"Wrote {frontend_zip} ({n} files)")

    setup_src = ROOT / "deploy" / "directadmin" / "SETUP.txt"
    setup_dst = OUT / "SETUP.txt"
    setup_dst.write_bytes(setup_src.read_bytes())
    print(f"Copied {setup_dst}")
    print("Upload backend zip into the Python app root; frontend zip into the Node app root.")
    print("See deploy/directadmin/SETUP.txt")


if __name__ == "__main__":
    main()
