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
        "plant_name": "Usina Teste",
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
        lambda *a, **k: (_ for _ in ()).throw(requests.RequestException("Rede indisponível")),
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
        "Erro", status=500
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
        lambda *a, **k: (_ for _ in ()).throw(requests.RequestException("Rede")),
    )
    assert utility.push_utility_to_supabase(sample_result) is False
