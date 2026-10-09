import logging
import sys

import pytest

try:
    from collector import common, inverters
except ImportError:
    import common
    import inverters


@pytest.mark.parametrize(
    ("process_value", "env_value", "expected"),
    [
        (None, None, logging.INFO),
        ("DEBUG", None, logging.DEBUG),
        ("warning", None, logging.WARNING),
        (None, "ERROR", logging.ERROR),
        ("DEBUG", "ERROR", logging.DEBUG),
        ("NOT_A_LEVEL", None, logging.INFO),
    ],
)
def test_resolve_log_level(monkeypatch, process_value, env_value, expected):
    if process_value is None:
        monkeypatch.delenv("LOG_LEVEL", raising=False)
    else:
        monkeypatch.setenv("LOG_LEVEL", process_value)
    env = {"LOG_LEVEL": env_value} if env_value else {}

    assert common.resolve_log_level(env) == expected


@pytest.mark.parametrize(("journal_stream", "has_time"), [("8:1234", False), (None, True)])
def test_configure_logging_format(monkeypatch, journal_stream, has_time):
    captured = {}
    monkeypatch.setattr(common.logging, "basicConfig", lambda **kw: captured.update(kw))
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    if journal_stream:
        monkeypatch.setenv("JOURNAL_STREAM", journal_stream)
    else:
        monkeypatch.delenv("JOURNAL_STREAM", raising=False)

    common.configure_logging({"LOG_LEVEL": "WARNING"})

    assert captured["level"] == logging.WARNING
    assert captured["stream"] is sys.stdout
    assert ("%(asctime)s" in captured["format"]) is has_time


def test_unreadable_last_known_energies_logs_warning(monkeypatch, tmp_path, caplog):
    latest_file = tmp_path / "latest.json"
    latest_file.write_text("[1]", encoding="utf-8")
    monkeypatch.setattr(inverters, "LATEST_FILE", str(latest_file))
    monkeypatch.setattr(inverters, "_LATEST_IN_MEMORY", None)

    with caplog.at_level(logging.WARNING, logger="collector.inverters"):
        assert inverters.get_last_known_energies() == {}

    assert "Could not read last known energies" in caplog.text


def test_unsupported_inverter_type_fails_the_cycle(monkeypatch):
    monkeypatch.setattr(
        inverters, "config", {"inverters": [{"id": "inv_x", "type": "generic_custom"}]}
    )
    monkeypatch.setattr(inverters, "push_to_supabase", lambda p: None)

    with pytest.raises(ValueError, match="unsupported type 'generic_custom'"):
        inverters.run_collection_cycle()
