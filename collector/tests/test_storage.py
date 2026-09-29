import json
import os

try:
    from collector import inverters
except ImportError:
    import inverters


def test_atomic_write_json(tmp_path):
    target_file = str(tmp_path / "test_data.json")
    payload = {"status": "ok", "value": 42, "items": [1, 2, 3]}

    inverters.atomic_write_json(target_file, payload)

    assert os.path.exists(target_file)
    with open(target_file, "r", encoding="utf-8") as f:
        loaded = json.load(f)
    assert loaded == payload

    files = os.listdir(str(tmp_path))
    assert files == ["test_data.json"]


def test_load_config_with_example():
    example_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.example.json")
    assert os.path.exists(example_path)

    with open(example_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    assert "poll_interval_seconds" in cfg
    assert "inverters" in cfg
    assert len(cfg["inverters"]) >= 3


def test_load_env(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text('FOO=bar\nBAZ="qux"\n# Comentario\nSPACED = 123\n', encoding="utf-8")

    monkeypatch.setattr(inverters, "ENV_FILE", str(env_file))
    env_vars = inverters.load_env()

    assert env_vars.get("FOO") == "bar"
    assert env_vars.get("BAZ") == "qux"
    assert env_vars.get("SPACED") == "123"


def test_queue_offline_telemetry(monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    payload1 = {"id": 1, "power_w": 500}
    payload2 = {"id": 2, "power_w": 600}

    inverters.queue_offline_telemetry(payload1)
    inverters.queue_offline_telemetry(payload2)

    assert os.path.exists(queue_file)
    with open(queue_file, "r", encoding="utf-8") as f:
        queued = json.load(f)

    assert len(queued) == 2
    assert queued[0] == payload1
    assert queued[1] == payload2


def test_get_last_known_energies(monkeypatch, tmp_path):
    latest_file = str(tmp_path / "latest.json")
    monkeypatch.setattr(inverters, "LATEST_FILE", latest_file)
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", None)

    from datetime import datetime

    today_str = datetime.now().strftime("%Y-%m-%d")

    dummy_latest = {
        "timestamp": f"{today_str}T10:00:00",
        "inverters": [
            {"id": "inv_1", "energy_today_kwh": 5.4, "energy_total_kwh": 1200.0},
            {"id": "inv_2", "energy_today_kwh": 4.1, "energy_total_kwh": 850.0},
        ],
    }
    inverters.atomic_write_json(latest_file, dummy_latest)

    last_known = inverters.get_last_known_energies()
    assert "inv_1" in last_known
    assert last_known["inv_1"]["energy_today_kwh"] == 5.4
    assert last_known["inv_2"]["energy_today_kwh"] == 4.1


def test_atomic_write_json_error(tmp_path):
    import pytest

    target_file = str(tmp_path / "fail.json")
    with pytest.raises(TypeError):
        inverters.atomic_write_json(target_file, {"invalid": object()})
    assert not os.path.exists(target_file)


def test_queue_offline_telemetry_corrupted_and_trim(monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    with open(queue_file, "w", encoding="utf-8") as f:
        f.write("{invalid json")

    inverters.queue_offline_telemetry({"power_w": 100})
    with open(queue_file, "r", encoding="utf-8") as f:
        queue = json.load(f)
    assert len(queue) == 1

    huge_queue = [{"power_w": i} for i in range(550)]
    with open(queue_file, "w", encoding="utf-8") as f:
        json.dump(huge_queue, f)

    inverters.queue_offline_telemetry({"power_w": 999})
    with open(queue_file, "r", encoding="utf-8") as f:
        queue = json.load(f)
    assert len(queue) == 500
    assert queue[-1]["power_w"] == 999


def test_get_last_known_energies_corrupted(monkeypatch, tmp_path):
    latest_file = str(tmp_path / "latest.json")
    monkeypatch.setattr(inverters, "LATEST_FILE", latest_file)
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", None)

    with open(latest_file, "w", encoding="utf-8") as f:
        f.write("corrupted")

    assert inverters.get_last_known_energies() == {}
