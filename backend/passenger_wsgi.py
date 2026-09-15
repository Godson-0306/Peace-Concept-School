"""
CloudLinux / DirectAdmin Passenger WSGI entry.

Point "Setup Python App" → Startup file at this file (app root = backend/).
"""
from __future__ import annotations

import os
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

os.chdir(APP_DIR)

from dotenv import load_dotenv

load_dotenv(os.path.join(APP_DIR, ".env"))

# Pure-Python MySQL driver for DirectAdmin (no mysql_config / mysqlclient).
_db_url = (os.environ.get("DATABASE_URL") or "").lower()
if _db_url.startswith("mysql"):
    from mysql_compat import enable_pymysql

    enable_pymysql()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.wsgi import get_wsgi_application

application = get_wsgi_application()


def _migrate_on_start() -> None:
    """Apply pending migrations only after a deploy touches tmp/restart.txt.

    Idle Passenger respawns must not pay migrate cost on every cold start.
    """
    tmp = os.path.join(APP_DIR, "tmp")
    os.makedirs(tmp, exist_ok=True)
    restart_path = os.path.join(tmp, "restart.txt")
    stamp_path = os.path.join(tmp, "migrate.stamp")
    if not os.path.exists(restart_path):
        return
    if os.path.exists(stamp_path) and os.path.getmtime(stamp_path) >= os.path.getmtime(
        restart_path
    ):
        return
    lock_path = os.path.join(tmp, "migrate.lock")
    try:
        lock_f = open(lock_path, "a+")
        if os.name != "nt":
            import fcntl

            fcntl.flock(lock_f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return
    try:
        if os.path.exists(stamp_path) and os.path.getmtime(stamp_path) >= os.path.getmtime(
            restart_path
        ):
            return
        from django.core.management import call_command

        call_command("migrate", interactive=False, verbosity=1)
        with open(stamp_path, "w", encoding="utf-8") as stamp:
            stamp.write("ok\n")
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"passenger startup migrate: {exc}\n")


_migrate_on_start()
