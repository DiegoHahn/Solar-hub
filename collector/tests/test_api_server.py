import json
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

import pytest
import requests

try:
    from collector import inverters
except ImportError:
    import inverters


@pytest.fixture
def local_server(monkeypatch, tmp_path):
    """Spins up a real HTTP server instance on a free OS port."""
    latest_file = str(tmp_path / "latest.json")
    history_file = str(tmp_path / "history.json")

    monkeypatch.setattr(inverters, "LATEST_FILE", latest_file)
    monkeypatch.setattr(inverters, "HISTORY_FILE", history_file)
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", None)
    monkeypatch.setattr(inverters, "_HISTORY_IN_MEMORY", [])

    server = ThreadingHTTPServer(("127.0.0.1", 0), inverters.SolarApiHandler)
    port = server.server_port
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"
    yield {
        "base_url": base_url,
        "server": server,
        "latest_file": latest_file,
        "history_file": history_file,
    }

    server.shutdown()
    server.server_close()


def test_api_health(local_server):
    url = f"{local_server['base_url']}/api/health"
    res = requests.get(url, timeout=3)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "time" in data
    # The API is local only: no external CORS origins authorized
    assert "Access-Control-Allow-Origin" not in res.headers


def test_api_latest_empty_and_with_data(local_server, monkeypatch):
    url = f"{local_server['base_url']}/api/latest"

    res_empty = requests.get(url, timeout=3)
    assert res_empty.status_code == 404

    sample_data = {"plant_name": "Test Plant", "total_power_w": 2500.0}
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", sample_data)

    res_with_data = requests.get(url, timeout=3)
    assert res_with_data.status_code == 200
    assert res_with_data.json()["total_power_w"] == 2500.0


def test_api_latest_fallback_from_disk(local_server):
    url = f"{local_server['base_url']}/api/latest"
    sample = {"plant_name": "From Disk", "total_power_w": 1800.0}
    Path(local_server["latest_file"]).write_text(json.dumps(sample), encoding="utf-8")

    res = requests.get(url, timeout=3)
    assert res.status_code == 200
    assert res.json()["plant_name"] == "From Disk"


def test_api_history_empty_and_with_data(local_server, monkeypatch):
    url = f"{local_server['base_url']}/api/history"

    res_empty = requests.get(url, timeout=3)
    assert res_empty.status_code == 200
    assert res_empty.json() == []

    history_data = [{"power_w": 1000}, {"power_w": 1200}]
    monkeypatch.setattr(inverters, "_HISTORY_IN_MEMORY", history_data)

    res = requests.get(url, timeout=3)
    assert res.status_code == 200
    assert len(res.json()) == 2

    monkeypatch.setattr(inverters, "_HISTORY_IN_MEMORY", [])
    Path(local_server["history_file"]).write_text(json.dumps(history_data), encoding="utf-8")

    res_disk = requests.get(url, timeout=3)
    assert res_disk.status_code == 200
    assert len(res_disk.json()) == 2


def test_api_trigger_disabled(local_server):
    url = f"{local_server['base_url']}/api/trigger"
    res = requests.get(url, timeout=3)
    assert res.status_code == 404


def test_api_unknown_route(local_server):
    url = f"{local_server['base_url']}/api/inexistent_route"
    res = requests.get(url, timeout=3)
    assert res.status_code == 404


def test_start_http_server_port_fallback(monkeypatch):
    from unittest.mock import MagicMock

    calls = []

    def fake_server_init(addr, handler):
        port = addr[1]
        calls.append(port)
        if port == 5000:
            err = OSError("Address already in use")
            err.errno = 10048
            raise err
        mock_srv = MagicMock()
        mock_srv.serve_forever = MagicMock()
        return mock_srv

    monkeypatch.setattr(inverters, "ThreadingHTTPServer", fake_server_init)
    inverters.start_http_server(host="127.0.0.1", port=5000)
    assert calls == [5000, 5001]
