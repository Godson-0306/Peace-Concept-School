"""Hit live health URLs so Passenger is warm after deploy."""

from __future__ import annotations

import sys
import urllib.request

URLS = (
    "https://api.pcism.com.ng/api/health/",
    "https://pcism.com.ng/",
    "https://pcism.com.ng/api/health/",
)


def main() -> int:
    ok = True
    for url in URLS:
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                print(f"{response.status} {url}")
        except Exception as exc:  # noqa: BLE001
            ok = False
            print(f"FAIL {url}: {exc}", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
