import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from conftest import make_settings

import collector.inverters as inverters
from collector.inverters import collect_inverter, run_collection_cycle
from collector.settings import CollectorState

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
        "name": "Solis Inverter",
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
        "name": "GoodWe Inverter 2",
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
        "name": "Failing Inverter",
        "type": "goodwe_tcp",
        "brand": "GoodWe",
        "ip": "127.0.0.1",
    }

    with patch.object(
        inverters,
        "fetch_goodwe_async",
        side_effect=RuntimeError("Connection refused by inverter"),
    ):
        res = collect_inverter(goodwe_fail_cfg)

    assert res["id"] == "inv_err"
    assert res["status"] == "offline / standby"
    assert res["power_w"] == 0.0
    assert "Connection refused by inverter" in res["error"]


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
        "plant_name": "Test Plant 16kW",
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

    settings = make_settings(
        tmp_path,
        env={"SUPABASE_URL": httpserver.url_for("/"), "SUPABASE_SERVICE_ROLE_KEY": "test-key"},
        **mock_config,
    )
    state = CollectorState()

    with patch.object(inverters.goodwe, "connect", AsyncMock(return_value=mock_inv)):
        plant_summary = run_collection_cycle(settings, state, save_local=True)

    assert plant_summary is not None
    assert plant_summary["plant_name"] == "Test Plant 16kW"
    assert plant_summary["inverters_count"] == 2
    assert plant_summary["total_power_w"] == 988.0

    assert Path(settings.latest_file).exists()
    assert Path(settings.history_file).exists()
    assert state.latest is plant_summary
    assert state.history[-1]["inv_1_w"] == 440.0
    assert state.history[-1]["inv_2_w"] == 548.0
    assert state.history[-1]["inv_3_w"] == 0


def test_run_collection_cycle_offline_fallback(httpserver, tmp_path):
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_data(
        "Server Error", status=500
    )

    mock_config = {
        "plant_name": "Test Plant",
        "nominal_capacity_kw": 16.0,
        "inverters": [],
    }

    settings = make_settings(
        tmp_path,
        env={"SUPABASE_URL": httpserver.url_for("/"), "SUPABASE_SERVICE_ROLE_KEY": "test-key"},
        **mock_config,
    )

    run_collection_cycle(settings, CollectorState())
    assert Path(settings.offline_queue_file).exists()
    assert not Path(settings.latest_file).exists()


def test_inverter_disabled_is_skipped(monkeypatch, tmp_path):
    settings = make_settings(
        tmp_path, plant_name="Plant", inverters=[{"id": "inv_off", "enabled": False}]
    )
    monkeypatch.setattr(inverters, "push_to_supabase", lambda *a: None)

    summary = run_collection_cycle(settings, CollectorState())
    assert summary["inverters_count"] == 0


def test_inverter_offline_recovers_last_known(monkeypatch, tmp_path):
    mock_config = {
        "plant_name": "Plant",
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
    settings = make_settings(tmp_path, **mock_config)
    monkeypatch.setattr(inverters, "get_last_known_energies", lambda *a: last_known_mock)
    monkeypatch.setattr(inverters, "push_to_supabase", lambda *a: None)

    with patch.object(inverters, "fetch_goodwe_async", side_effect=RuntimeError("Offline")):
        summary = run_collection_cycle(settings, CollectorState())

    assert summary["inverters_count"] == 1
    inv = summary["inverters"][0]
    assert inv["energy_today_kwh"] == 12.5
    assert inv["energy_total_kwh"] == 3400.0


def test_inverters_main_once(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setenv("COLLECTOR_HOME", str(tmp_path))
    monkeypatch.setattr(
        inverters,
        "run_collection_cycle",
        lambda settings, state, save_local: calls.append((settings.home, save_local)),
    )
    inverters.main(["--once", "--save-local"])
    assert calls == [(tmp_path, True)]
    # The data directory is created by main(), not when the module is imported
    assert (tmp_path / "data").is_dir()


def test_inverters_main_reads_sys_argv(monkeypatch, tmp_path):
    calls = []
    monkeypatch.setenv("COLLECTOR_HOME", str(tmp_path))
    monkeypatch.setattr("sys.argv", ["inverters.py", "--once"])
    monkeypatch.setattr(
        inverters, "run_collection_cycle", lambda *a, save_local: calls.append(save_local)
    )
    inverters.main()
    assert calls == [False]


def test_inverters_main_continuous_loop(monkeypatch, tmp_path):
    monkeypatch.setenv("COLLECTOR_HOME", str(tmp_path))
    monkeypatch.setattr(inverters, "start_http_server", lambda *a, **k: None)
    monkeypatch.setattr(inverters, "run_collection_cycle", lambda *a, **k: None)
    monkeypatch.setattr(inverters.time, "sleep", MagicMock(side_effect=KeyboardInterrupt()))

    with pytest.raises(SystemExit) as exc:
        inverters.main([])
    assert exc.value.code == 0


def test_history_has_one_field_per_inverter(tmp_path, monkeypatch):
    """More than three inverters: inv_4_w and beyond are added, the first three keep their names."""
    monkeypatch.setattr(inverters, "push_to_supabase", lambda *a: None)
    fake_results = {f"inv_{n}": float(n * 100) for n in range(1, 6)}
    monkeypatch.setattr(
        inverters,
        "collect_inverter",
        lambda cfg: {"id": cfg["id"], "status": "online", "power_w": fake_results[cfg["id"]]},
    )
    settings = make_settings(tmp_path, inverters=[{"id": inv_id} for inv_id in fake_results])
    state = CollectorState()

    summary = run_collection_cycle(settings, state)

    assert summary["inverters_count"] == 5
    assert summary["total_power_w"] == 1500.0
    entry = state.history[-1]
    assert [entry[f"inv_{n}_w"] for n in range(1, 6)] == [100.0, 200.0, 300.0, 400.0, 500.0]


def test_history_is_trimmed_to_max_records(tmp_path, monkeypatch):
    monkeypatch.setattr(inverters, "push_to_supabase", lambda *a: None)
    settings = make_settings(tmp_path, history_max_records=2)
    state = CollectorState()
    previous = state.history

    for _ in range(3):
        run_collection_cycle(settings, state)

    assert len(state.history) == 2
    # Replaced, never mutated, so the API thread never sees a half-updated list
    assert previous == []


def test_collect_inverter_goodwe_udp_fallback():
    runtime_data = load_fixture_json("goodwe_runtime.json")
    mock_inv = MagicMock()
    mock_inv.model_name = "GW5000-DNS-30"
    mock_inv.serial_number = "SN-GW-002"
    mock_inv.firmware = "6.5.05"
    mock_inv.read_runtime_data = AsyncMock(return_value=runtime_data)

    goodwe_cfg = {
        "id": "inv_2",
        "name": "GoodWe Inverter 2",
        "type": "goodwe_tcp",
        "brand": "GoodWe",
        "ip": "10.0.0.2",
    }

    # First call fails (Modbus TCP), second succeeds (UDP fallback)
    connect_mock = AsyncMock(side_effect=[RuntimeError("TCP failed"), mock_inv])
    with patch("collector.inverters.goodwe.connect", connect_mock):
        res = collect_inverter(goodwe_cfg)

    assert res["id"] == "inv_2"
    assert res["status"] == "online"
    assert connect_mock.call_count == 2


def test_collect_inverter_unknown_type():
    unknown_cfg = {
        "id": "inv_unknown",
        "name": "Unknown Inverter",
        "type": "generic_custom",
        "ip": "10.0.0.99",
    }
    res = collect_inverter(unknown_cfg)
    assert res is None
