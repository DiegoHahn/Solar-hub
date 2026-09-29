from http.server import ThreadingHTTPServer
from threading import Thread

import pytest
import requests

try:
    from collector import inverters
except ImportError:
    import inverters


@pytest.fixture
def local_server(monkeypatch, tmp_path):
    """Sobe uma instância real do servidor HTTP em porta livre do sistema operacional."""
    monkeypatch.setattr(inverters, "LATEST_FILE", str(tmp_path / "latest.json"))
    monkeypatch.setattr(inverters, "HISTORY_FILE", str(tmp_path / "history.json"))
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", None)
    monkeypatch.setattr(inverters, "_HISTORY_IN_MEMORY", [])

    server = ThreadingHTTPServer(("127.0.0.1", 0), inverters.SolarApiHandler)
    port = server.server_port
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{port}"
    yield {"base_url": base_url, "server": server}

    server.shutdown()
    server.server_close()


def test_api_health(local_server):
    url = f"{local_server['base_url']}/api/health"
    res = requests.get(url, timeout=3)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "time" in data
    # A API é só local: nenhuma origem externa é autorizada
    assert "Access-Control-Allow-Origin" not in res.headers


def test_api_latest_empty_and_with_data(local_server, monkeypatch):
    url = f"{local_server['base_url']}/api/latest"

    res_empty = requests.get(url, timeout=3)
    assert res_empty.status_code == 404

    sample_data = {"plant_name": "Usina Teste", "total_power_w": 2500.0}
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", sample_data)

    res_with_data = requests.get(url, timeout=3)
    assert res_with_data.status_code == 200
    assert res_with_data.json()["total_power_w"] == 2500.0


def test_api_trigger_disabled(local_server):
    url = f"{local_server['base_url']}/api/trigger"
    res = requests.get(url, timeout=3)
    assert res.status_code == 404
