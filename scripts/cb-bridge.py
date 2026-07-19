#!/usr/bin/env python3
"""Chrome-TLS-impersonated HTTP bridge for Crunchbase live mode.

Cloudflare binds cf_clearance to the browser's JA3/TLS fingerprint, which Node's
fetch cannot reproduce. This bridge (curl_cffi, chrome impersonation) performs the
request with a matching fingerprint. Input JSON on stdin: {url, headers, body};
output JSON on stdout: {status, text}.
"""
import json
import sys

from curl_cffi import requests


def main() -> int:
    payload = json.loads(sys.stdin.read())
    response = requests.post(
        payload["url"],
        headers=payload["headers"],
        data=payload["body"].encode("utf-8"),
        impersonate="chrome",
        timeout=20,
    )
    json.dump({"status": response.status_code, "text": response.text}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
