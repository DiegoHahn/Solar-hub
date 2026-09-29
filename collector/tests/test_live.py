import pytest

try:
    from collector import inverters, utility
except ImportError:
    import inverters
    import utility


@pytest.mark.live
def test_live_inverters_connection():
    config = inverters.load_config()
    assert "inverters" in config, "config.json precisa conter lista de inversores"

    for inv_cfg in config["inverters"]:
        res = inverters.collect_inverter(inv_cfg)
        assert res is not None, f"Falha ao conectar no inversor {inv_cfg.get('name')}"

        if res.get("status") == "online":
            p_w = res.get("power_w", 0)
            assert 0 <= p_w <= 6500, f"Potência fora da faixa física esperada: {p_w} W"

            vgrid = res.get("vgrid")
            if vgrid:
                assert 180 <= vgrid <= 255, f"Tensão CA fora da faixa física: {vgrid} V"

            e_total = res.get("energy_total_kwh", 0)
            assert e_total >= 0, "Energia acumulada não pode ser negativa"


@pytest.mark.live
def test_live_cooperalianca_login():
    cpf = utility.ENV.get("COOPERALIANCA_CPF")
    senha = utility.ENV.get("COOPERALIANCA_SENHA")
    if not cpf or not senha:
        pytest.skip("Credenciais da Cooperaliança ausentes no .env")

    auth = utility.login_cooperalianca(cpf, senha, utility.portal_headers())
    assert auth and auth["Token"], "Falha na autenticação com a Cooperaliança"
