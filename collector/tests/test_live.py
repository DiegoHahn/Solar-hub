import pytest

from collector import inverters, utility
from collector.settings import CollectorSettings


@pytest.mark.live
def test_live_inverters_connection():
    config = CollectorSettings.load().config
    assert "inverters" in config, "config.json must contain inverters list"

    for inv_cfg in config["inverters"]:
        res = inverters.collect_inverter(inv_cfg)
        assert res is not None, f"Failed to connect to inverter {inv_cfg.get('name')}"

        if res.get("status") == "online":
            p_w = res.get("power_w", 0)
            assert 0 <= p_w <= 6500, f"Power outside expected physical range: {p_w} W"

            vgrid = res.get("vgrid")
            if vgrid:
                assert 180 <= vgrid <= 255, f"AC grid voltage outside physical range: {vgrid} V"

            e_total = res.get("energy_total_kwh", 0)
            assert e_total >= 0, "Lifetime energy cannot be negative"


@pytest.mark.live
def test_live_cooperalianca_login():
    cpf = utility.ENV.get("COOPERALIANCA_CPF")
    senha = utility.ENV.get("COOPERALIANCA_SENHA")
    if not cpf or not senha:
        pytest.skip("Cooperaliança credentials missing in .env")

    auth = utility.login_cooperalianca(cpf, senha, utility.portal_headers())
    assert auth and auth["Token"], "Authentication failed with Cooperaliança"
