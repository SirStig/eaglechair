"""Auth cookie Max-Age must not depend on the server's local timezone"""

import os
import time
from datetime import timedelta

import pytest
from fastapi import Response

from backend.core.security import SecurityManager, set_auth_cookies


@pytest.mark.unit
@pytest.mark.auth
@pytest.mark.skipif(not hasattr(time, "tzset"), reason="needs time.tzset")
def test_access_cookie_max_age_on_non_utc_server():
    old_tz = os.environ.get("TZ")
    os.environ["TZ"] = "America/Los_Angeles"
    time.tzset()
    try:
        access = SecurityManager.create_access_token(
            {"sub": "1", "type": "admin"}, expires_delta=timedelta(minutes=30)
        )
        refresh = SecurityManager.create_access_token(
            {"sub": "1", "type": "admin"}, expires_delta=timedelta(days=1)
        )
        response = Response()
        set_auth_cookies(response, access, refresh, is_production=True)
        cookies = [v.decode() for k, v in response.raw_headers if k == b"set-cookie"]
        access_cookie = next(c for c in cookies if c.startswith("access_token="))
        max_age = int(access_cookie.split("Max-Age=")[1].split(";")[0])
        assert 29 * 60 <= max_age <= 30 * 60
    finally:
        if old_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = old_tz
        time.tzset()
