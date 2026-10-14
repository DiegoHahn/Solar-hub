"""Helpers shared by the inverter and utility collectors."""

import json
import logging
import os
import sys
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

DEFAULT_LOG_LEVEL = "INFO"

# Root of the collector project (holds pyproject.toml, .env, config.json and data/) when the
# package runs from the repository, as on the edge device: src/collector/common.py -> collector/
_PROJECT_ROOT = Path(__file__).resolve().parents[2]


def collector_home() -> Path:
    """Directory holding .env, config.json and the default data/ directory.

    COLLECTOR_HOME wins when set. Otherwise the collector project directory of this checkout is
    used (the layout on the edge device); a non-editable install falls back to the working
    directory, which the systemd units set to the collector directory.
    """
    override = os.environ.get("COLLECTOR_HOME")
    if override:
        return Path(override)
    if (_PROJECT_ROOT / "pyproject.toml").exists():
        return _PROJECT_ROOT
    return Path.cwd()


def load_env(env_file: str) -> dict[str, str]:
    """Reads KEY=VALUE pairs from `env_file`, ignoring blank lines, comments and surrounding quotes."""
    env_vars = {}
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars


def atomic_write_json(filepath: str, data: Any) -> None:
    """Writes JSON through a temporary file and an atomic rename, so readers never see a partial file."""
    dir_name = os.path.dirname(filepath)
    os.makedirs(dir_name, exist_ok=True)
    temp_file = filepath + f".tmp_{os.getpid()}_{int(time.time() * 1000)}"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_file, filepath)
    except Exception:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
        raise


def resolve_log_level(env: Mapping[str, str] | None = None) -> int:
    """Log level from the LOG_LEVEL process variable, then from `env` (the collector .env), else INFO.

    Unknown names fall back to INFO instead of failing, so a typo never stops the collector.
    """
    name = os.environ.get("LOG_LEVEL") or (env or {}).get("LOG_LEVEL") or DEFAULT_LOG_LEVEL
    level = logging.getLevelName(name.strip().upper())
    return level if isinstance(level, int) else logging.INFO


def configure_logging(env: Mapping[str, str] | None = None) -> None:
    """Configures the root logger once, at the entry point of each collector.

    Output goes to stdout, which systemd forwards to journald. Under systemd (JOURNAL_STREAM set)
    the timestamp is left out because journald already records one for every line.
    """
    # UTF-8 output on Windows terminals (°C, Cooperaliança); a no-op on the edge device
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if os.environ.get("JOURNAL_STREAM"):
        fmt = "%(levelname)s %(name)s: %(message)s"
    else:
        fmt = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    logging.basicConfig(
        level=resolve_log_level(env), format=fmt, datefmt="%Y-%m-%d %H:%M:%S", stream=sys.stdout
    )
