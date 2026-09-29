try:
    from collector.utility import safe_api_get
except ImportError:
    from utility import safe_api_get


def test_safe_api_get_success(httpserver):
    httpserver.expect_request("/api/test").respond_with_json(
        {"Content": {"faturas": [1, 2, 3]}}, status=200
    )

    url = httpserver.url_for("/api/test")
    res = safe_api_get(url, headers={}, default={})

    assert res == {"faturas": [1, 2, 3]}


def test_safe_api_get_http_error(httpserver):
    httpserver.expect_request("/api/error").respond_with_data("Server Error", status=500)

    url = httpserver.url_for("/api/error")
    res = safe_api_get(url, headers={}, default={"fallback": True})

    assert res == {"fallback": True}


def test_safe_api_get_timeout_error():
    # Porta inválida que não responde
    res = safe_api_get(
        "http://127.0.0.1:59999/unreachable", headers={}, timeout=0.1, default="default_val"
    )
    assert res == "default_val"
