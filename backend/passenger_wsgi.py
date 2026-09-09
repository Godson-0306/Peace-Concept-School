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
