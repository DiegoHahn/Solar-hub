import json
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests

try:
    import collector.utility as utility
    from collector.utility import (
        download_informativo_pdf,
        login_cooperalianca,
        main,
        portal_headers,
        safe_api_get,
        sync_cooperalianca,
    )
except ImportError:
    import utility
    from utility import (
        download_informativo_pdf,
        login_cooperalianca,
        main,
        portal_headers,
        safe_api_get,
        sync_cooperalianca,
    )

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "cooperalianca"


def load_fixture(name):
    path = FIXTURES_DIR / f"{name}.json"
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def test_safe_api_get_success(httpserver):
    httpserver.expect_request("/api/test").respond_with_json(
        {"Content": {"faturas": [1, 2, 3]}}, status=200
    )

    url = httpserver.url_for("/api/test")
    res = safe_api_get(url, headers={}, default={})

    assert res == {"faturas": [1, 2, 3]}


def test_safe_api_get_http_error(httpserver):
    httpserver.expect_request("/api/error").respond_with_data("Server Error", status=500)

    url = httpserver.url_for("/api/error")
    res = safe_api_get(url, headers={}, default={"fallback": True})

    assert res == {"fallback": True}


def test_safe_api_get_timeout_error():
    res = safe_api_get(
        "http://127.0.0.1:59999/unreachable", headers={}, timeout=0.1, default="default_val"
    )
    assert res == "default_val"


def test_portal_headers():
    headers = portal_headers()
    assert "User-Agent" in headers
    assert headers["Content-Type"] == "application/json"
    assert "use-token-externo" in headers


def test_login_cooperalianca_success(httpserver):
    auth_data = load_fixture("Auth") or {"Token": "TOKEN123", "Nome": "Titular Teste"}
    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)

    with patch.object(utility, "API_BASE", httpserver.url_for("/")):
        res = login_cooperalianca("00000000000", "senha123", portal_headers())
        assert res is not None
        assert res.get("Token") == auth_data.get("Token")


def test_login_cooperalianca_failures(httpserver):
    def attempts(prefix):
        return sum(1 for req, _ in httpserver.log if req.path == f"/{prefix}/Auth")

    httpserver.expect_request("/negado/Auth").respond_with_data("Unauthorized", status=401)
    with patch.object(utility, "API_BASE", httpserver.url_for("/negado/")):
        assert login_cooperalianca("000", "123", {}, retry_delays=(0, 0)) is None
    assert attempts("negado") == 1

    httpserver.expect_request("/fora/Auth").respond_with_data("Error", status=500)
    with patch.object(utility, "API_BASE", httpserver.url_for("/fora/")):
        assert login_cooperalianca("000", "123", {}, retry_delays=(0, 0)) is None
    assert attempts("fora") == 3

    httpserver.expect_request("/sem-token/Auth").respond_with_json({"Content": {}}, status=200)
    with patch.object(utility, "API_BASE", httpserver.url_for("/sem-token/")):
        assert login_cooperalianca("000", "123", {}, retry_delays=(0, 0)) is None
    assert attempts("sem-token") == 1


def test_login_cooperalianca_recovers_after_portal_unavailable(httpserver):
    httpserver.expect_oneshot_request("/Auth").respond_with_data("Unavailable", status=503)
    httpserver.expect_request("/Auth").respond_with_json({"Content": {"Token": "TOKEN123"}})

    with patch.object(utility, "API_BASE", httpserver.url_for("/")):
        res = login_cooperalianca("000", "123", {}, retry_delays=(0,))

    assert res == {"Token": "TOKEN123"}
    assert len(httpserver.log) == 2


def test_sync_cooperalianca_missing_credentials(monkeypatch):
    monkeypatch.setattr(utility, "ENV", {})
    assert sync_cooperalianca() is None

    monkeypatch.setattr(utility, "ENV", {"COOPERALIANCA_CPF": "000", "COOPERALIANCA_SENHA": "123"})
    monkeypatch.setattr(utility, "UCS", [])
    assert sync_cooperalianca() is None


def test_sync_cooperalianca_full_cycle(httpserver, monkeypatch, tmp_path):
    uc_test = "90001"
    auth_data = load_fixture("Auth") or {"Token": "TOKEN123", "Nome": "Titular Teste"}
    perfil_data = load_fixture("BuscarPerfilUsuario")
    faturas_data = load_fixture("RecuperarHistoricoFaturaConsumo60Meses")
    resumo_data = load_fixture("RecuperarResumoUltimaFaturaUc")
    gd_data = load_fixture("RecuperarDadosGeracaoDistribuida")
    hist_gd = load_fixture("RecuperarDadosHistoricoGeracao")
    grafico_gd = load_fixture("BuscaDadosHistoricoGeracaoConsumo")

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request(
        "/PerfilUsuario/BuscarPerfilUsuario", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": perfil_data}, status=200)
    httpserver.expect_request(
        "/Fatura/RecuperarHistoricoFaturaConsumo60Meses", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": faturas_data}, status=200)
    httpserver.expect_request(
        "/ImprimirFaturas/RecuperarResumoUltimaFaturaUc", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": resumo_data}, status=200)
    httpserver.expect_request(
        "/GeracaoDistribuida/RecuperarDadosGeracaoDistribuida", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": gd_data}, status=200)
    httpserver.expect_request(
        "/GeracaoDistribuida/RecuperarDadosHistoricoGeracao", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": hist_gd}, status=200)
    httpserver.expect_request(
        "/GeracaoDistribuida/BuscaDadosHistoricoGeracaoConsumo", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": grafico_gd}, status=200)

    httpserver.expect_request(
        "/TarifasBandeiras", query_string=f"codigoUc={uc_test}"
    ).respond_with_json({"Content": load_fixture("TarifasBandeiras")}, status=200)

    httpserver.expect_request(
        "/rest/v1/utility_data", method="POST", query_string="on_conflict=cpf"
    ).respond_with_data("OK", status=201)

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "UCS", [uc_test])
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility,
        "ENV",
        {
            "COOPERALIANCA_CPF": "00000000000",
            "COOPERALIANCA_SENHA": "senha",
            "SUPABASE_URL": httpserver.url_for("/"),
            "SUPABASE_SERVICE_ROLE_KEY": "test-key",
        },
    )

    monkeypatch.setattr("sys.argv", ["utility.py", "--save-local"])
    res = sync_cooperalianca("00000000000", "senha")

    assert res is not None
    assert res["distribuidora"] == "Cooperaliança (Içara/SC)"
    assert uc_test in res["unidades_consumidoras"]
    assert res["unidades_consumidoras"][uc_test]["codigo_uc"] == uc_test
    assert res["tarifa_referencia"]["bandeira_vigente"] == "Bandeira verde"

    saved_file = tmp_path / "cooperalianca_latest.json"
    assert saved_file.exists()

    pushed = json.loads(
        next(r for r, _ in httpserver.log if r.path == "/rest/v1/utility_data").data
    )
    assert pushed["tarifa_referencia"]["tarifa_kwh"] == 0.75773
    # Carries the UTC offset, otherwise Postgres stores local time as if it were UTC
    assert datetime.fromisoformat(pushed["updated_at"]).utcoffset() is not None


def test_fetch_current_tariff_uses_the_flag_in_force(httpserver):
    httpserver.expect_request("/TarifasBandeiras").respond_with_json(
        {"Content": load_fixture("TarifasBandeiras")}
    )

    with patch.object(utility, "API_BASE", httpserver.url_for("/")):
        tariff = utility.fetch_current_tariff("90001", {})

    assert tariff == {
        "bandeira_vigente": "Bandeira verde",
        "tarifa_kwh": 0.75773,
        "te_kwh": 0.25829,
        "tusd_kwh": 0.49944,
        "vigente_desde": "2026-08-29",
        "resolucao": "Despacho 3.398 /2026",
    }


def test_fetch_current_tariff_returns_none_without_a_current_flag(httpserver):
    flags = load_fixture("TarifasBandeiras")
    flags["RetTarifasBandeiraVerde"]["VigenciaNaCompetencia"] = False
    httpserver.expect_request("/sem-vigente/TarifasBandeiras").respond_with_json({"Content": flags})
    httpserver.expect_request("/erro/TarifasBandeiras").respond_with_data("Error", status=500)

    with patch.object(utility, "API_BASE", httpserver.url_for("/sem-vigente/")):
        assert utility.fetch_current_tariff("90001", {}) is None
    with patch.object(utility, "API_BASE", httpserver.url_for("/erro/")):
        assert utility.fetch_current_tariff("90001", {}) is None


def test_portal_date_to_iso():
    assert utility.portal_date_to_iso("29/08/2026 00:00:00") == "2026-08-29"
    assert utility.portal_date_to_iso("") is None
    assert utility.portal_date_to_iso(None) is None


def test_sync_keeps_stored_tariff_when_unavailable(httpserver, monkeypatch):
    httpserver.expect_request("/Auth").respond_with_json({"Content": {"Token": "TOKEN123"}})
    httpserver.expect_request("/rest/v1/utility_data", method="POST").respond_with_data(
        "OK", status=201
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "UCS", ["90001"])
    monkeypatch.setattr(
        utility,
        "ENV",
        {"SUPABASE_URL": httpserver.url_for("/"), "SUPABASE_SERVICE_ROLE_KEY": "test-key"},
    )
    monkeypatch.setattr("sys.argv", ["utility.py"])

    res = sync_cooperalianca("00000000000", "senha")

    assert res is not None
    assert "tarifa_referencia" not in res
    pushed = json.loads(
        next(r for r, _ in httpserver.log if r.path == "/rest/v1/utility_data").data
    )
    assert "tarifa_referencia" not in pushed


def test_sync_cooperalianca_fails_when_supabase_rejects_payload(httpserver, monkeypatch):
    httpserver.expect_request("/Auth").respond_with_json({"Content": {"Token": "TOKEN123"}})
    httpserver.expect_request("/rest/v1/utility_data", method="POST").respond_with_data(
        "Error", status=500
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "UCS", ["90001"])
    monkeypatch.setattr(
        utility,
        "ENV",
        {"SUPABASE_URL": httpserver.url_for("/"), "SUPABASE_SERVICE_ROLE_KEY": "test-key"},
    )
    monkeypatch.setattr("sys.argv", ["utility.py"])

    assert sync_cooperalianca("00000000000", "senha") is None


def test_download_informativo_pdf(httpserver, monkeypatch, tmp_path):
    out_pdf = str(tmp_path / "info.pdf")
    auth_data = {"Token": "TOKEN_PDF", "Nome": "Titular Teste"}
    pdf_bytes = b"%PDF-1.4 mock content"

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request("/GeracaoDistribuida/InformativoMicrogeracao").respond_with_data(
        pdf_bytes, status=200
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility, "ENV", {"COOPERALIANCA_CPF": "00000000000", "COOPERALIANCA_SENHA": "senha"}
    )
    monkeypatch.setattr(utility, "UCS", ["90001"])

    result_path = download_informativo_pdf(
        competencia="01/08/2026 00:00:00",
        uc="90001",
        cpf="00000000000",
        senha="senha",
        output_file=out_pdf,
    )

    assert result_path == out_pdf
    assert Path(out_pdf).exists()
    assert Path(out_pdf).read_bytes() == pdf_bytes


def test_download_informativo_pdf_errors(monkeypatch):
    monkeypatch.setattr(utility, "ENV", {})
    monkeypatch.setattr(utility, "UCS", [])
    assert download_informativo_pdf(cpf=None, senha=None, uc=None) is None


def test_download_informativo_pdf_auto_competencia_from_payload(httpserver, monkeypatch, tmp_path):
    out_pdf = str(tmp_path / "auto.pdf")
    auth_data = {"Token": "TOKEN_PDF", "Nome": "Titular Teste"}
    pdf_bytes = b"%PDF-1.4 auto"

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request("/GeracaoDistribuida/InformativoMicrogeracao").respond_with_data(
        pdf_bytes, status=200
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility, "ENV", {"COOPERALIANCA_CPF": "00000000000", "COOPERALIANCA_SENHA": "senha"}
    )
    monkeypatch.setattr(utility, "UCS", ["90001"])

    mock_payload = {
        "unidades_consumidoras": {
            "90001": {"historico_faturas_60_meses": [{"MesAnoCompetencia": "08/2026"}]}
        }
    }

    res = download_informativo_pdf(
        competencia=None,
        uc="90001",
        cpf="00000000000",
        senha="senha",
        output_file=out_pdf,
        data_payload=mock_payload,
    )
    assert res == out_pdf
    assert Path(out_pdf).exists()


def test_download_informativo_pdf_server_failure(httpserver, monkeypatch, tmp_path):
    out_pdf = str(tmp_path / "fail.pdf")
    auth_data = {"Token": "TOKEN_PDF", "Nome": "Titular Teste"}

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request("/GeracaoDistribuida/InformativoMicrogeracao").respond_with_data(
        "Error", status=500
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility, "ENV", {"COOPERALIANCA_CPF": "00000000000", "COOPERALIANCA_SENHA": "senha"}
    )

    res = download_informativo_pdf(
        competencia="01/08/2026 00:00:00",
        uc="90001",
        cpf="00000000000",
        senha="senha",
        output_file=out_pdf,
    )
    assert res is None


def test_utility_atomic_write_error(tmp_path):
    invalid_file = tmp_path / "test.json"
    with pytest.raises(TypeError):
        utility.atomic_write_json(str(invalid_file), {"unserializable": object()})
    assert not invalid_file.exists()


def test_login_cooperalianca_network_exception(monkeypatch):
    monkeypatch.setattr(
        utility.requests, "post", MagicMock(side_effect=requests.RequestException("Network"))
    )
    login = utility.login_cooperalianca
    assert login("00000000000", "senha", utility.portal_headers(), retry_delays=(0,)) is None
    assert utility.requests.post.call_count == 2


def test_download_informativo_pdf_from_local_file(httpserver, monkeypatch, tmp_path):
    out_pdf = str(tmp_path / "from_file.pdf")
    auth_data = {"Token": "TOKEN_PDF", "Nome": "Titular Teste"}
    pdf_bytes = b"%PDF-1.4 file content"

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request("/GeracaoDistribuida/InformativoMicrogeracao").respond_with_data(
        pdf_bytes, status=200
    )

    latest_file = tmp_path / "cooperalianca_latest.json"
    latest_file.write_text(
        json.dumps(
            {
                "unidades_consumidoras": {
                    "90001": {"historico_faturas_60_meses": [{"MesAnoCompetencia": "07/2026"}]}
                }
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility, "ENV", {"COOPERALIANCA_CPF": "00000000000", "COOPERALIANCA_SENHA": "senha"}
    )
    monkeypatch.setattr(utility, "UCS", ["90001"])

    res = download_informativo_pdf(
        competencia=None,
        uc="90001",
        cpf="00000000000",
        senha="senha",
        output_file=out_pdf,
    )
    assert res == out_pdf
    assert Path(out_pdf).exists()


def test_download_informativo_pdf_empty_faturas_fallback_current_month(
    httpserver, monkeypatch, tmp_path
):
    out_pdf = str(tmp_path / "fallback_month.pdf")
    auth_data = {"Token": "TOKEN_PDF", "Nome": "Titular Teste"}
    pdf_bytes = b"%PDF-1.4 fallback"

    httpserver.expect_request("/Auth").respond_with_json({"Content": auth_data}, status=200)
    httpserver.expect_request("/GeracaoDistribuida/InformativoMicrogeracao").respond_with_data(
        pdf_bytes, status=200
    )

    monkeypatch.setattr(utility, "API_BASE", httpserver.url_for("/"))
    monkeypatch.setattr(utility, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        utility, "ENV", {"COOPERALIANCA_CPF": "00000000000", "COOPERALIANCA_SENHA": "senha"}
    )
    monkeypatch.setattr(utility, "UCS", ["90001"])

    res = download_informativo_pdf(
        competencia=None,
        uc="90001",
        cpf="00000000000",
        senha="senha",
        output_file=out_pdf,
        data_payload={"unidades_consumidoras": {"90001": {"historico_faturas_60_meses": []}}},
    )
    assert res == out_pdf


def test_download_informativo_pdf_auth_failure_branches(httpserver, monkeypatch, tmp_path):
    httpserver.expect_request("/Auth_403").respond_with_data("Forbidden", status=403)
    with patch.object(utility, "API_BASE", httpserver.url_for("/Auth_403")):
        res = download_informativo_pdf(
            competencia="01/01/2026 00:00:00",
            uc="90001",
            cpf="00000000000",
            senha="senha",
            output_file=str(tmp_path / "out.pdf"),
        )
        assert res is None

    httpserver.expect_request("/Auth_no_tok").respond_with_json({"Content": {}}, status=200)
    with patch.object(utility, "API_BASE", httpserver.url_for("/Auth_no_tok")):
        res = download_informativo_pdf(
            competencia="01/01/2026 00:00:00",
            uc="90001",
            cpf="00000000000",
            senha="senha",
            output_file=str(tmp_path / "out.pdf"),
        )
        assert res is None


def test_utility_main_cli(monkeypatch):
    with patch.object(utility, "sync_cooperalianca", return_value={"ok": True}) as mock_sync:
        with patch.object(
            utility, "download_informativo_pdf", side_effect=RuntimeError("PDF Error")
        ):
            monkeypatch.setattr("sys.argv", ["utility.py", "--pdf"])
            main()
            assert mock_sync.called


def test_utility_main_exits_with_error_when_sync_fails(monkeypatch):
    with patch.object(utility, "sync_cooperalianca", return_value=None):
        monkeypatch.setattr("sys.argv", ["utility.py", "--pdf"])
        with pytest.raises(SystemExit) as exc:
            main()
        assert exc.value.code == 1


def test_utility_main_cli_loop(monkeypatch):
    with patch.object(utility, "sync_cooperalianca", return_value={"ok": True}):
        with patch.object(utility.time, "sleep", side_effect=KeyboardInterrupt()):
            monkeypatch.setattr("sys.argv", ["utility.py", "--loop"])
            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code == 0
