"""Inverter collector configuration and runtime state.

Nothing here touches the disk at import time: `CollectorSettings.load()` reads .env and
config.json when an entry point asks for it, and `CollectorState` holds what used to live in
mutable module globals (the in-memory latest snapshot and history served by the local API).
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from collector.common import collector_home, load_env

DEFAULT_CONFIG: dict[str, Any] = {
    "poll_interval_seconds": 600,
    "data_dir": "data",
    "history_max_records": 1000,
    "api_port": 5000,
    "inverters": [],
}


def load_config(config_file: str | Path) -> dict[str, Any]:
    """Reads config.json; without it, returns the defaults (no inverters)."""
    if os.path.exists(config_file):
        with open(config_file, "r", encoding="utf-8") as f:
            loaded: dict[str, Any] = json.load(f)
            return loaded
    return dict(DEFAULT_CONFIG)


@dataclass(frozen=True)
class CollectorSettings:
    """Values read once at startup from collector/.env and collector/config.json."""

    home: Path
    env: Mapping[str, str] = field(default_factory=dict)
    config: Mapping[str, Any] = field(default_factory=lambda: dict(DEFAULT_CONFIG))

    @classmethod
    def load(cls, home: str | Path | None = None) -> CollectorSettings:
        base = Path(home) if home is not None else collector_home()
        return cls(
            home=base,
            env=load_env(str(base / ".env")),
            config=load_config(base / "config.json"),
        )

    @property
    def data_dir(self) -> str:
        return os.path.join(str(self.home), self.config.get("data_dir", "data"))

    @property
    def latest_file(self) -> str:
        return os.path.join(self.data_dir, "latest.json")

    @property
    def history_file(self) -> str:
        return os.path.join(self.data_dir, "history.json")

    @property
    def offline_queue_file(self) -> str:
        return os.path.join(self.data_dir, "offline_queue.json")

    @property
    def inverters(self) -> list[dict[str, Any]]:
        """Every configured inverter, in config order; there is no fixed count."""
        return list(self.config.get("inverters", []))

    @property
    def plant_name(self) -> Any:
        return self.config.get("plant_name", "Solar Plant")

    @property
    def nominal_capacity_kw(self) -> Any:
        return self.config.get("nominal_capacity_kw", 16.0)

    @property
    def poll_interval_seconds(self) -> Any:
        return self.config.get("poll_interval_seconds", 600)

    @property
    def history_max_records(self) -> Any:
        return self.config.get("history_max_records", 1000)

    @property
    def api_address(self) -> tuple[str, int]:
        """Local API host and port: the `api` block, or the legacy top-level `api_port`."""
        api_cfg = self.config.get("api", {})
        if isinstance(api_cfg, dict):
            return (
                api_cfg.get("host", "127.0.0.1"),
                api_cfg.get("port", self.config.get("api_port", 5000)),
            )
        return "127.0.0.1", self.config.get("api_port", 5000)


@dataclass
class CollectorState:
    """In-memory results served by the local API, kept off the SD card unless --save-local.

    The collection loop replaces `latest` and `history` with new objects instead of mutating
    them in place, so the API thread always reads a consistent value.
    """

    latest: dict[str, Any] | None = None
    history: list[dict[str, Any]] = field(default_factory=list)
