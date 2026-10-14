import pytest

from collector.settings import DEFAULT_CONFIG, CollectorSettings, CollectorState


def make_settings(tmp_path, env=None, **config):
    """Settings rooted at `tmp_path`, so data files never touch the real collector directory."""
    return CollectorSettings(home=tmp_path, env=env or {}, config={**DEFAULT_CONFIG, **config})


@pytest.fixture
def settings(tmp_path):
    return make_settings(tmp_path)


@pytest.fixture
def state():
    return CollectorState()
