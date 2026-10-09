import json
import os

try:
    from collector.common import atomic_write_json, load_env
except ImportError:
    from common import atomic_write_json, load_env


def test_load_env_reads_pairs_and_skips_comments(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment\n\nPLAIN=value\nDOUBLE=\"quoted\"\nSINGLE='quoted'\nWITH_EQUALS=a=b\n",
        encoding="utf-8",
    )

    assert load_env(str(env_file)) == {
        "PLAIN": "value",
        "DOUBLE": "quoted",
        "SINGLE": "quoted",
        "WITH_EQUALS": "a=b",
    }


def test_load_env_returns_empty_without_file(tmp_path):
    assert load_env(str(tmp_path / "missing.env")) == {}


def test_atomic_write_json_leaves_no_temporary_file(tmp_path):
    target = tmp_path / "nested" / "data.json"

    atomic_write_json(str(target), {"ok": True})

    assert json.loads(target.read_text(encoding="utf-8")) == {"ok": True}
    assert os.listdir(target.parent) == ["data.json"]
