import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

try:
    import collector.inverters as inverters
    from collector.inverters import collect_inverter, run_collection_cycle
except ImportError:
    import inverters
    from inverters import collect_inverter, run_collection_cycle

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture_text(name):
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


def load_fixture_json(name):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def test_collect_inverter_solis_via_local_server(httpserver):
    html_content = load_fixture_text("solis_status.html")
    httpserver.expect_request("/status.html").respond_with_data(
        html_content, content_type="text/html"
    )

    solis_cfg = {
        "id": "inv_1",
        "name": "Inversor Solis",
        "type": "solarman_lsw3",
        "brand": "Solis",
        "ip": f"{httpserver.host}:{httpserver.port}",
        "auth": "admin:admin",
    }

    res = collect_inverter(solis_cfg)

    assert res["id"] == "inv_1"
    assert res["brand"] == "Solis"
    assert res["status"] == "online"
    assert res["power_w"] == 440.0
    assert res["energy_today_kwh"] == 1.67
    assert res["energy_total_kwh"] == 81800.2


def test_collect_inverter_goodwe_mocked():
    runtime_data = load_fixture_json("goodwe_runtime.json")

    mock_inv = MagicMock()
    mock_inv.model_name = "GW5000-DNS-30"
    mock_inv.serial_number = "SN-GW-002"
    mock_inv.firmware = "6.5.05"
    mock_inv.read_runtime_data = AsyncMock(return_value=runtime_data)

    goodwe_cfg = {
        "id": "inv_2",
        "name": "Inversor GoodWe 2",
        "type": "goodwe_tcp",
        "brand": "GoodWe",
        "ip": "10.0.0.2",
    }

    with patch("collector.inverters.goodwe.connect", AsyncMock(return_value=mock_inv)):
        res = collect_inverter(goodwe_cfg)

    assert res["id"] == "inv_2"
    assert res["brand"] == "GoodWe"
    assert res["status"] == "online"
    assert res["power_w"] == 548.0
    assert res["energy_today_kwh"] == 0.6


def test_collect_inverter_error_handling():
    goodwe_fail_cfg = {
        "id": "inv_err",
        "name": "Inversor Falho",
        "type": "goodwe_tcp",
        "brand": "GoodWe",
        "ip": "127.0.0.1",
    }

    with patch.object(
        inverters,
        "fetch_goodwe_async",
        side_effect=RuntimeError("Conexão recusada pelo inversor"),
    ):
        res = collect_inverter(goodwe_fail_cfg)

    assert res["id"] == "inv_err"
    assert res["status"] == "offline / standby"
    assert res["power_w"] == 0.0
    assert "Conexão recusada pelo inversor" in res["error"]


def test_run_collection_cycle_full(httpserver, monkeypatch, tmp_path):
    html_content = load_fixture_text("solis_status.html")
    httpserver.expect_request("/status.html").respond_with_data(
        html_content, content_type="text/html"
    )

    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_data(
        "Created", status=201
    )

    runtime_data = load_fixture_json("goodwe_runtime.json")
    mock_inv = MagicMock()
    mock_inv.model_name = "GW5000-DNS-30"
    mock_inv.serial_number = "SN-GW-002"
    mock_inv.firmware = "6.5.05"
    mock_inv.read_runtime_data = AsyncMock(return_value=runtime_data)

    mock_config = {
        "plant_name": "Usina Teste 16kW",
        "nominal_capacity_kw": 16.0,
        "inverters": [
            {
                "id": "inv_1",
                "name": "Solis 6k",
                "type": "solarman_lsw3",
                "brand": "Solis",
                "ip": f"{httpserver.host}:{httpserver.port}",
                "auth": "admin:admin",
                "enabled": True,
            },
            {
                "id": "inv_2",
                "name": "GoodWe 5k",
                "type": "goodwe_tcp",
                "brand": "GoodWe",
                "ip": "10.0.0.2",
                "enabled": True,
            },
        ],
    }

    latest_file = str(tmp_path / "latest.json")
    history_file = str(tmp_path / "history.json")
    offline_file = str(tmp_path / "offline_queue.json")

    monkeypatch.setattr(inverters, "config", mock_config)
    monkeypatch.setattr(inverters, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(inverters, "LATEST_FILE", latest_file)
    monkeypatch.setattr(inverters, "HISTORY_FILE", history_file)
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", offline_file)
    monkeypatch.setattr("sys.argv", ["inverters.py", "--save-local"])
    monkeypatch.setattr(
        inverters,
        "ENV",
        {
            "SUPABASE_URL": httpserver.url_for("/"),
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        },
    )

    with patch.object(inverters.goodwe, "connect", AsyncMock(return_value=mock_inv)):
        plant_summary = run_collection_cycle()

    assert plant_summary is not None
    assert plant_summary["plant_name"] == "Usina Teste 16kW"
    assert plant_summary["inverters_count"] == 2
    assert plant_summary["total_power_w"] == 988.0

    assert Path(latest_file).exists()
    assert Path(history_file).exists()


def test_run_collection_cycle_offline_fallback(httpserver, monkeypatch, tmp_path):
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_data(
        "Server Error", status=500
    )

    mock_config = {
        "plant_name": "Usina Teste",
        "nominal_capacity_kw": 16.0,
        "inverters": [],
    }

    latest_file = str(tmp_path / "latest.json")
    history_file = str(tmp_path / "history.json")
    offline_file = str(tmp_path / "offline_queue.json")

    monkeypatch.setattr(inverters, "config", mock_config)
    monkeypatch.setattr(inverters, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(inverters, "LATEST_FILE", latest_file)
    monkeypatch.setattr(inverters, "HISTORY_FILE", history_file)
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", offline_file)
    monkeypatch.setattr(
        inverters,
        "ENV",
        {
            "SUPABASE_URL": httpserver.url_for("/"),
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        },
    )

    run_collection_cycle()
    assert Path(offline_file).exists()


def test_inverter_disabled_is_skipped(monkeypatch):
    mock_config = {
        "plant_name": "Usina",
        "inverters": [{"id": "inv_off", "enabled": False}],
    }
    monkeypatch.setattr(inverters, "config", mock_config)
    monkeypatch.setattr(inverters, "push_to_supabase", lambda p: None)

    summary = run_collection_cycle()
    assert summary["inverters_count"] == 0


def test_inverter_offline_recovers_last_known(monkeypatch):
    mock_config = {
        "plant_name": "Usina",
        "inverters": [
            {
                "id": "inv_offline",
                "name": "Offline Inv",
                "type": "goodwe_tcp",
                "ip": "127.0.0.1",
            }
        ],
    }
    last_known_mock = {
        "inv_offline": {
            "energy_today_kwh": 12.5,
            "energy_total_kwh": 3400.0,
        }
    }
    monkeypatch.setattr(inverters, "config", mock_config)
    monkeypatch.setattr(inverters, "get_last_known_energies", lambda: last_known_mock)
    monkeypatch.setattr(inverters, "push_to_supabase", lambda p: None)

    with patch.object(inverters, "fetch_goodwe_async", side_effect=RuntimeError("Offline")):
        summary = run_collection_cycle()

    assert summary["inverters_count"] == 1
    inv = summary["inverters"][0]
    assert inv["energy_today_kwh"] == 12.5
    assert inv["energy_total_kwh"] == 3400.0


def test_inverters_main_once(monkeypatch):
    called = []
    monkeypatch.setattr("sys.argv", ["inverters.py", "--once"])
    monkeypatch.setattr(inverters, "run_collection_cycle", lambda: called.append(True))
    inverters.main()
    assert called == [True]


def test_inverters_main_continuous_loop(monkeypatch):
    import pytest

    monkeypatch.setattr("sys.argv", ["inverters.py"])
    monkeypatch.setattr(inverters, "start_http_server", lambda *a, **k: None)
    monkeypatch.setattr(inverters, "run_collection_cycle", lambda *a, **k: None)
    monkeypatch.setattr(inverters.time, "sleep", MagicMock(side_effect=KeyboardInterrupt()))

    with pytest.raises(SystemExit) as exc:
        inverters.main()
    assert exc.value.code == 0


def test_collect_inverter_goodwe_udp_fallback():
    runtime_data = load_fixture_json("goodwe_runtime.json")
    mock_inv = MagicMock()
    mock_inv.model_name = "GW5000-DNS-30"
    mock_inv.serial_number = "SN-GW-002"
    mock_inv.firmware = "6.5.05"
    mock_inv.read_runtime_data = AsyncMock(return_value=runtime_data)

    goodwe_cfg = {
        "id": "inv_2",
        "name": "Inversor GoodWe 2",
        "type": "goodwe_tcp",
        "brand": "GoodWe",
        "ip": "10.0.0.2",
    }

    # Primeira chamada falha (Modbus TCP), segunda funciona (UDP)
    connect_mock = AsyncMock(side_effect=[RuntimeError("TCP failed"), mock_inv])
    with patch("collector.inverters.goodwe.connect", connect_mock):
        res = collect_inverter(goodwe_cfg)

    assert res["id"] == "inv_2"
    assert res["status"] == "online"
    assert connect_mock.call_count == 2


def test_collect_inverter_unknown_type():
    unknown_cfg = {
        "id": "inv_unknown",
        "name": "Inversor Desconhecido",
        "type": "generic_custom",
        "ip": "10.0.0.99",
    }
    res = collect_inverter(unknown_cfg)
    assert res is None
