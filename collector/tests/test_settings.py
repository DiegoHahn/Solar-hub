import json
import os
import subprocess
import sys
from pathlib import Path

import collector.common as common
from collector.settings import DEFAULT_CONFIG, CollectorSettings

COLLECTOR_DIR = Path(__file__).resolve().parent.parent


def test_load_reads_env_and_config_from_home(tmp_path):
    (tmp_path / ".env").write_text("SUPABASE_URL=https://example.test\n", encoding="utf-8")
    config = {
        "plant_name": "Plant",
        "data_dir": "runtime",
        "api": {"host": "127.0.0.2", "port": 6000},
    }
    (tmp_path / "config.json").write_text(json.dumps(config), encoding="utf-8")

    settings = CollectorSettings.load(tmp_path)

    assert settings.env == {"SUPABASE_URL": "https://example.test"}
    assert settings.plant_name == "Plant"
    assert settings.api_address == ("127.0.0.2", 6000)
    assert settings.data_dir == os.path.join(str(tmp_path), "runtime")
    assert settings.offline_queue_file == os.path.join(
        str(tmp_path), "runtime", "offline_queue.json"
    )
    # Loading never creates directories; main() does
    assert not (tmp_path / "runtime").exists()


def test_load_without_files_uses_defaults(tmp_path):
    settings = CollectorSettings.load(tmp_path)

    assert settings.env == {}
    assert dict(settings.config) == DEFAULT_CONFIG
    assert settings.inverters == []
    assert settings.poll_interval_seconds == 600
    assert settings.api_address == ("127.0.0.1", 5000)


def test_api_address_legacy_top_level_port(tmp_path):
    settings = CollectorSettings(home=tmp_path, config={"api": "disabled", "api_port": 5050})
    assert settings.api_address == ("127.0.0.1", 5050)


def test_collector_home_resolution(monkeypatch, tmp_path):
    monkeypatch.setenv("COLLECTOR_HOME", str(tmp_path))
    assert common.collector_home() == tmp_path

    monkeypatch.delenv("COLLECTOR_HOME")
    # From a checkout the home is the collector directory, where .env and config.json live
    assert common.collector_home() == COLLECTOR_DIR

    monkeypatch.setattr(common, "_PROJECT_ROOT", tmp_path / "site-packages")
    monkeypatch.chdir(tmp_path)
    assert common.collector_home() == tmp_path


def _run(args, tmp_path, extra_env=None):
    env = {**os.environ, "COLLECTOR_HOME": str(tmp_path), "LOG_LEVEL": "INFO", **(extra_env or {})}
    env.pop("JOURNAL_STREAM", None)
    return subprocess.run(
        [sys.executable, *args],
        cwd=COLLECTOR_DIR,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )


def test_legacy_script_invocation_still_works(tmp_path):
    """The systemd unit runs `python inverters.py`; it must keep working without installing."""
    result = _run(["inverters.py", "--once", "--save-local"], tmp_path)

    assert result.returncode == 0, result.stderr
    assert "Starting polling cycle" in result.stdout
    assert (tmp_path / "data" / "latest.json").exists()


def test_module_invocation(tmp_path):
    src = str(COLLECTOR_DIR / "src")
    result = _run(["-m", "collector.inverters", "--once"], tmp_path, {"PYTHONPATH": src})

    assert result.returncode == 0, result.stderr
    assert "PLANT TOTAL" in result.stdout


def test_legacy_utility_invocation_reads_env_from_home(tmp_path):
    # Empty home: no credentials, so it stops before any network call and exits 1 for systemd
    result = _run(["utility.py"], tmp_path)

    assert result.returncode == 1
    assert "CPF or Password not configured" in result.stdout
