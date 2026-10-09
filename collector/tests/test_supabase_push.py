import json
import os

from werkzeug.wrappers import Response

try:
    from collector import inverters, utility
except ImportError:
    import inverters
    import utility


def test_push_to_supabase_success(httpserver, monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    fake_env = {
        "SUPABASE_URL": httpserver.url_for(""),
        "SUPABASE_SERVICE_ROLE_KEY": "fake-service-key-123",
    }
    monkeypatch.setattr(inverters, "ENV", fake_env)

    httpserver.expect_request(
        "/rest/v1/solar_telemetry",
        method="POST",
        headers={
            "apikey": "fake-service-key-123",
            "Authorization": "Bearer fake-service-key-123",
            "Content-Type": "application/json",
        },
    ).respond_with_json({"status": "created"}, status=201)

    plant_summary = {
        "timestamp": "2026-09-29T12:00:00Z",
        "plant_name": "Test Plant",
        "total_nominal_capacity_kw": 16.0,
        "total_power_w": 4500.0,
        "total_power_kw": 4.5,
        "total_today_kwh": 25.0,
        "total_lifetime_kwh": 81000.0,
        "capacity_factor_pct": 28.1,
        "inverters_count": 3,
        "inverters": [],
    }

    inverters.push_to_supabase(plant_summary)

    httpserver.check_assertions()
    assert not os.path.exists(queue_file)


def test_push_to_supabase_offline_fallback(httpserver, monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    fake_env = {
        "SUPABASE_URL": httpserver.url_for(""),
        "SUPABASE_SERVICE_ROLE_KEY": "fake-service-key-123",
    }
    monkeypatch.setattr(inverters, "ENV", fake_env)

    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_data(
        "Internal Server Error", status=500
    )

    plant_summary = {
        "timestamp": "2026-09-29T12:05:00Z",
        "total_power_w": 4600.0,
    }

    inverters.push_to_supabase(plant_summary)

    assert os.path.exists(queue_file)
    with open(queue_file, "r", encoding="utf-8") as f:
        queue = json.load(f)
    assert len(queue) == 1
    assert queue[0]["total_power_w"] == 4600.0


def test_flush_offline_queue(httpserver, monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    pending_items = [
        {"recorded_at": "2026-09-29T11:00:00Z", "total_power_w": 3000.0},
        {"recorded_at": "2026-09-29T11:10:00Z", "total_power_w": 3500.0},
    ]
    inverters.atomic_write_json(queue_file, pending_items)

    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_json(
        {"status": "ok"}, status=201
    )
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_json(
        {"status": "ok"}, status=201
    )

    headers = {"apikey": "fake-key", "Authorization": "Bearer fake-key"}
    inverters.flush_offline_queue(httpserver.url_for(""), headers)

    if os.path.exists(queue_file):
        with open(queue_file, "r", encoding="utf-8") as f:
            queue = json.load(f)
        assert len(queue) == 0


def test_push_utility_to_supabase(httpserver, monkeypatch):
    fake_env = {
        "SUPABASE_URL": httpserver.url_for(""),
        "SUPABASE_SERVICE_ROLE_KEY": "fake-service-key-123",
    }
    monkeypatch.setattr(utility, "ENV", fake_env)

    doc_key = "cpf"

    def handler(request):
        assert request.args.get("on_conflict") == doc_key
        assert request.headers.get("Prefer") == "resolution=merge-duplicates"
        assert request.headers.get("apikey") == "fake-service-key-123"
        return Response(status=201, response='{"status":"ok"}', mimetype="application/json")

    httpserver.expect_request("/rest/v1/utility_data", method="POST").respond_with_handler(handler)

    sample_result = {
        "timestamp": "2026-09-29T10:00:00Z",
        "distribuidora": "Cooperaliança (Içara/SC)",
        "titular": "Titular Teste",
        doc_key: "0" * 11,
        "perfil_usuario": {},
        "tarifa_referencia": {"tarifa_kwh": 0.77658},
        "unidades_consumidoras": {},
    }

    assert utility.push_utility_to_supabase(sample_result) is True
    httpserver.check_assertions()


def test_push_to_supabase_missing_env(monkeypatch):
    monkeypatch.setattr(inverters, "ENV", {})
    assert inverters.push_to_supabase({}) is None

    monkeypatch.setattr(inverters, "ENV", {"SUPABASE_URL": "https://SEU_PROJECT_REF.supabase.co"})
    assert inverters.push_to_supabase({}) is None


def test_push_to_supabase_network_exception(monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)
    monkeypatch.setattr(
        inverters,
        "ENV",
        {"SUPABASE_URL": "http://127.0.0.1:9999", "SUPABASE_SERVICE_ROLE_KEY": "key"},
    )
    import requests

    monkeypatch.setattr(
        inverters.requests,
        "post",
        lambda *a, **k: (_ for _ in ()).throw(requests.RequestException("Network unavailable")),
    )

    inverters.push_to_supabase({"timestamp": "2026-09-29T12:00:00Z", "total_power_w": 100})
    assert os.path.exists(queue_file)


def test_flush_offline_queue_partial_failure(httpserver, monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    pending_items = [
        {"recorded_at": "2026-09-29T11:00:00Z", "total_power_w": 3000.0},
        {"recorded_at": "2026-09-29T11:10:00Z", "total_power_w": 3500.0},
    ]
    inverters.atomic_write_json(queue_file, pending_items)

    call_count = 0

    def handler(request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return Response(status=201, response='{"status":"ok"}', mimetype="application/json")
        return Response(status=500, response="Server Error")

    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_handler(
        handler
    )

    headers = {"apikey": "fake-key", "Authorization": "Bearer fake-key"}
    inverters.flush_offline_queue(httpserver.url_for(""), headers)

    assert os.path.exists(queue_file)
    with open(queue_file, "r", encoding="utf-8") as f:
        remaining = json.load(f)
    assert len(remaining) == 1
    assert remaining[0]["total_power_w"] == 3500.0


def test_flush_offline_queue_corrupted(monkeypatch, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)

    with open(queue_file, "w", encoding="utf-8") as f:
        f.write("corrupted json")

    inverters.flush_offline_queue("http://fake", {})


def test_push_utility_to_supabase_edge_cases(httpserver, monkeypatch):
    monkeypatch.setattr(utility, "ENV", {})
    assert utility.push_utility_to_supabase({}) is True

    monkeypatch.setattr(
        utility,
        "ENV",
        {"SUPABASE_URL": httpserver.url_for(""), "SUPABASE_SERVICE_ROLE_KEY": "fake-key"},
    )
    httpserver.expect_request("/rest/v1/utility_data", method="POST").respond_with_data(
        "Error", status=500
    )
    sample_result = {
        "timestamp": "2026-09-29T10:00:00Z",
        "distribuidora": "Cooperaliança",
        "titular": "Titular",
        "cpf": "00000000000",
    }
    assert utility.push_utility_to_supabase(sample_result) is False

    import requests

    monkeypatch.setattr(
        utility.requests,
        "post",
        lambda *a, **k: (_ for _ in ()).throw(requests.RequestException("Network")),
    )
    assert utility.push_utility_to_supabase(sample_result) is False


class FakePostgrest:
    """Minimal solar_telemetry endpoint with the unique constraint on recorded_at.

    Mirrors PostgREST: with on_conflict=recorded_at and Prefer: resolution=ignore-duplicates a
    repeated recorded_at is skipped (201); without them the insert hits the constraint (409).
    `commit_then_fail` stores the row and then answers 500, like a response lost after the commit.
    """

    def __init__(self, commit_then_fail=()):
        self.rows = []
        self.requests = []
        self.commit_then_fail = set(commit_then_fail)

    def __call__(self, request):
        item = request.get_json()
        self.requests.append((dict(request.args), request.headers.get("Prefer"), item))
        idempotent = (
            request.args.get("on_conflict") == "recorded_at"
            and request.headers.get("Prefer") == "resolution=ignore-duplicates"
        )
        if any(row["recorded_at"] == item["recorded_at"] for row in self.rows):
            if not idempotent:
                return Response(status=409, response='{"code":"23505"}')
        else:
            self.rows.append(item)
        if item["recorded_at"] in self.commit_then_fail:
            self.commit_then_fail.discard(item["recorded_at"])
            return Response(status=500, response="Gateway Timeout")
        return Response(status=201)


def _supabase_env(monkeypatch, httpserver, tmp_path):
    queue_file = str(tmp_path / "offline_queue.json")
    monkeypatch.setattr(inverters, "OFFLINE_QUEUE_FILE", queue_file)
    monkeypatch.setattr(
        inverters,
        "ENV",
        {"SUPABASE_URL": httpserver.url_for(""), "SUPABASE_SERVICE_ROLE_KEY": "fake-key"},
    )
    return queue_file


def test_push_to_supabase_sends_conflict_params(httpserver, monkeypatch, tmp_path):
    queue_file = _supabase_env(monkeypatch, httpserver, tmp_path)
    fake = FakePostgrest()
    httpserver.expect_request(
        "/rest/v1/solar_telemetry",
        method="POST",
        query_string="on_conflict=recorded_at",
        headers={"Prefer": "resolution=ignore-duplicates"},
    ).respond_with_handler(fake)

    snapshot = {"timestamp": "2026-09-29T12:00:00-03:00", "total_power_w": 1.0}
    inverters.push_to_supabase(snapshot)
    inverters.push_to_supabase(snapshot)

    assert len(fake.requests) == 2
    assert [row["recorded_at"] for row in fake.rows] == ["2026-09-29T12:00:00-03:00"]
    assert not os.path.exists(queue_file)


def test_push_to_supabase_never_sends_null_recorded_at(httpserver, monkeypatch, tmp_path):
    _supabase_env(monkeypatch, httpserver, tmp_path)
    fake = FakePostgrest()
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_handler(fake)

    inverters.push_to_supabase({"total_power_w": 1.0})

    assert fake.rows[0]["recorded_at"]


def test_interrupted_queue_replay_is_retried_without_duplicates(httpserver, tmp_path, monkeypatch):
    queue_file = _supabase_env(monkeypatch, httpserver, tmp_path)
    pending = [
        {"recorded_at": f"2026-09-29T11:{minute:02d}:00-03:00", "total_power_w": float(minute)}
        for minute in (0, 10, 20, 30)
    ]
    inverters.atomic_write_json(queue_file, pending)

    # The second snapshot is stored but its response is lost, so the replay stops there
    fake = FakePostgrest(commit_then_fail={pending[1]["recorded_at"]})
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_handler(fake)
    headers = {
        "apikey": "fake-key",
        "Authorization": "Bearer fake-key",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates",
    }

    inverters.flush_offline_queue(httpserver.url_for(""), headers)

    with open(queue_file, "r", encoding="utf-8") as f:
        assert json.load(f) == pending[1:]
    assert len(fake.rows) == 2

    # Next cycle: the replay resends the snapshot that was already stored, and it is skipped
    inverters.flush_offline_queue(httpserver.url_for(""), headers)

    assert not os.path.exists(queue_file)
    assert [row["recorded_at"] for row in fake.rows] == [item["recorded_at"] for item in pending]
    assert len(fake.requests) == 5
    assert all(args == {"on_conflict": "recorded_at"} for args, _, _ in fake.requests)
    assert all(prefer == "resolution=ignore-duplicates" for _, prefer, _ in fake.requests)


def test_cycles_after_outage_drain_queue_without_duplicates(httpserver, monkeypatch, tmp_path):
    """A live push whose replay is cut mid-way, then a clean push: one row per snapshot."""
    queue_file = _supabase_env(monkeypatch, httpserver, tmp_path)
    queued = [
        {"recorded_at": f"2026-09-29T10:{minute:02d}:00-03:00", "total_power_w": 0.0}
        for minute in (0, 10)
    ]
    inverters.atomic_write_json(queue_file, queued)

    fake = FakePostgrest(commit_then_fail={queued[0]["recorded_at"]})
    httpserver.expect_request("/rest/v1/solar_telemetry", method="POST").respond_with_handler(fake)

    inverters.push_to_supabase({"timestamp": "2026-09-29T10:20:00-03:00", "total_power_w": 5.0})
    with open(queue_file, "r", encoding="utf-8") as f:
        assert json.load(f) == queued

    inverters.push_to_supabase({"timestamp": "2026-09-29T10:30:00-03:00", "total_power_w": 6.0})

    assert not os.path.exists(queue_file)
    recorded = [row["recorded_at"] for row in fake.rows]
    assert len(recorded) == len(set(recorded)) == 4
