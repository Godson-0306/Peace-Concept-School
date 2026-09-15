"""
FTP upload of pcs-api (Django) and pcs-web (Next.js) to DirectAdmin.

Credentials come from the environment only — never commit passwords.

  PCS_FTP_HOST       default pcism.com.ng
  PCS_FTP_USER       default pcismcom
  PCS_FTP_PASSWORD   required
  PCS_FTP_API_DIR    default pcs-api
  PCS_FTP_WEB_DIR    default pcs-web
  PCS_UPLOAD_API     default 1
  PCS_UPLOAD_WEB     default 1
"""

from __future__ import annotations

import os
import posixpath
import sys
from ftplib import FTP, error_perm
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACKEND = REPO / "backend"
FRONTEND = REPO / "frontend"

SKIP_DIR_NAMES = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "media",
    "staticfiles",
    "dist-directadmin",
    "cache",
    "dev",
}
SKIP_FILE_NAMES = {
    ".env",
    "db.sqlite3",
    ".env.local",
    ".env.production.local",
}
SKIP_SUFFIXES = {".pyc", ".pyo", ".sqlite3"}


def _should_skip(path: Path, *, include_next: bool) -> bool:
    if path.name in SKIP_FILE_NAMES:
        return True
    if path.suffix in SKIP_SUFFIXES:
        return True
    skip_dirs = set(SKIP_DIR_NAMES)
    if not include_next:
        skip_dirs.add(".next")
    return bool(set(path.parts) & skip_dirs)


def _iter_files(root: Path, *, include_next: bool) -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        current = Path(dirpath)
        rel_parts = current.relative_to(root).parts
        skip_dirs = set(SKIP_DIR_NAMES)
        if not include_next:
            skip_dirs.add(".next")
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        if ".git" in rel_parts or "__pycache__" in rel_parts:
            continue
        for name in filenames:
            path = current / name
            if _should_skip(path.relative_to(root), include_next=include_next):
                continue
            if path.name in SKIP_FILE_NAMES:
                continue
            files.append(path)
    return files


def _ensure_dirs(ftp: FTP, remote_dir: str) -> None:
    parts = [p for p in remote_dir.split("/") if p]
    cursor = ""
    for part in parts:
        cursor = f"{cursor}/{part}" if cursor else part
        try:
            ftp.mkd(cursor)
        except error_perm:
            pass


def _upload_tree(ftp: FTP, local_root: Path, remote_root: str, *, include_next: bool) -> int:
    files = _iter_files(local_root, include_next=include_next)
    uploaded = 0
    for path in files:
        rel = path.relative_to(local_root).as_posix()
        remote = posixpath.join(remote_root, rel).replace("\\", "/")
        parent = posixpath.dirname(remote)
        if parent and parent != ".":
            _ensure_dirs(ftp, parent)
        with path.open("rb") as handle:
            ftp.storbinary(f"STOR {remote}", handle)
        uploaded += 1
        if uploaded == 1 or uploaded % 10 == 0:
            print(f"  uploaded {uploaded}/{len(files)} {rel}")
    return uploaded


def _touch_restart(ftp: FTP, app_dir: str) -> None:
    remote_tmp = posixpath.join(app_dir, "tmp")
    _ensure_dirs(ftp, remote_tmp)
    from io import BytesIO

    payload = BytesIO(str(os.getpid()).encode("ascii"))
    ftp.storbinary(f"STOR {posixpath.join(remote_tmp, 'restart.txt')}", payload)
    print(f"  touched {app_dir}/tmp/restart.txt")


def _connect(host: str, user: str, password: str) -> FTP:
    # Plain FTP first: TLS control works on this host, but PROT P data
    # connections hang on STOR (common on DirectAdmin CSF firewalls).
    prefer_tls = os.environ.get("PCS_FTP_TLS", "0") in {"1", "true", "yes"}
    if not prefer_tls:
        ftp = FTP(host, timeout=90)
        ftp.login(user=user, passwd=password)
        ftp.set_pasv(True)
        print("Connected with plain FTP")
        return ftp
    try:
        from ftplib import FTP_TLS

        ftp = FTP_TLS(host, timeout=90)
        ftp.login(user=user, passwd=password)
        ftp.prot_p()
        ftp.set_pasv(True)
        print("Connected with FTP TLS")
        return ftp
    except Exception as exc:  # noqa: BLE001
        print(f"TLS FTP fallback to plain FTP ({exc})")
        ftp = FTP(host, timeout=90)
        ftp.login(user=user, passwd=password)
        ftp.set_pasv(True)
        print("Connected with plain FTP")
        return ftp


def main() -> int:
    host = os.environ.get("PCS_FTP_HOST", "pcism.com.ng")
    user = os.environ.get("PCS_FTP_USER", "pcismcom")
    password = os.environ.get("PCS_FTP_PASSWORD", "")
    api_dir = os.environ.get("PCS_FTP_API_DIR", "pcs-api")
    web_dir = os.environ.get("PCS_FTP_WEB_DIR", "pcs-web")
    upload_api = os.environ.get("PCS_UPLOAD_API", "1") not in {"0", "false", "no"}
    upload_web = os.environ.get("PCS_UPLOAD_WEB", "1") not in {"0", "false", "no"}

    if not password:
        print("PCS_FTP_PASSWORD is required.", file=sys.stderr)
        return 2

    print(f"Connecting to {host} as {user}...")
    ftp = _connect(host, user, password)
    try:
        names = []
        try:
            names = ftp.nlst()
        except Exception:
            names = []
        print("Remote top-level:", ", ".join(sorted(n for n in names if n not in {".", ".."})))
        if upload_api:
            pending = _iter_files(BACKEND, include_next=False)
            print(f"Uploading Django backend -> {api_dir} ({len(pending)} files)")
            count = _upload_tree(ftp, BACKEND, api_dir, include_next=False)
            print(f"  {count} backend files uploaded (skipped .env, .venv, db.sqlite3)")
            _touch_restart(ftp, api_dir)
        if upload_web:
            print(f"Uploading Next.js frontend -> {web_dir}")
            count = _upload_tree(ftp, FRONTEND, web_dir, include_next=True)
            print(f"  {count} frontend files uploaded (includes .next if present)")
            _touch_restart(ftp, web_dir)
    finally:
        ftp.quit()
    print("FTP upload complete. Run migrate + collectstatic + restart on the server, then warm health URLs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
