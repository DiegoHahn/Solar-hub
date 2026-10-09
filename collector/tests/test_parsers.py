import json
import os

from collector.inverters import normalize_goodwe_runtime, parse_solis_status

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def test_parse_solis_status_html_only():
    with open(os.path.join(FIXTURES_DIR, "solis_status.html"), "r", encoding="utf-8") as f:
        html = f.read()

    result = parse_solis_status(html)

    assert result["status"] == "online"
    assert result["power_w"] == 440.0
    assert result["energy_today_kwh"] == 1.67
    assert result["energy_total_kwh"] == 81800.2
    assert result["inverter_sn"] == "SN-INVERSOR-1"
    assert result["logger_ver"] == "LSW3_15_FFFF_1.0.57"
    assert result["wifi_rssi"] == "88%"
    assert result["wifi_ssid"] == "WIFI-SOLAR-TEST"
    assert result["pv1"] is None
    assert result["temperature_c"] is None


def test_parse_solis_status_with_registers():
    with open(os.path.join(FIXTURES_DIR, "solis_status.html"), "r", encoding="utf-8") as f:
        html = f.read()
    with open(os.path.join(FIXTURES_DIR, "solarman_registers.json"), "r", encoding="utf-8") as f:
        regs = json.load(f)

    result = parse_solis_status(html, regs=regs, logger_sn="1000000001")

    assert result["status"] == "online"
    assert result["power_w"] == 440.0
    assert result["energy_today_kwh"] == 1.67
    assert result["energy_total_kwh"] == 81800.0
    assert result["temperature_c"] == 45.2
    assert result["vgrid"] == 209.2
    assert result["igrid"] == 2.15
    assert result["fgrid"] == 59.99

    assert result["pv1"] == {"v": 315.7, "i": 0.92, "w": 290.4}
    assert result["pv2"] == {"v": 369.2, "i": 0.65, "w": 240.0}
    assert result["logger_sn"] == "1000000001"


def test_normalize_goodwe_runtime():
    with open(os.path.join(FIXTURES_DIR, "goodwe_runtime.json"), "r", encoding="utf-8") as f:
        runtime_data = json.load(f)

    result = normalize_goodwe_runtime(
        runtime_data,
        model_name="GW5000-DNS-30",
        serial_number="SN-GOODWE-123",
        firmware="6.5.05",
    )

    assert result["status"] == "online"
    assert result["power_w"] == 548.0
    assert result["energy_today_kwh"] == 0.6
    assert result["energy_total_kwh"] == 14766.5
    assert result["temperature_c"] == 29.5
    assert result["vgrid"] == 214.4
    assert result["igrid"] == 2.5
    assert result["fgrid"] == 60.01

    assert result["pv1"] == {"v": 210.4, "i": 1.1, "w": 231.0}
    assert result["pv2"] == {"v": 288.2, "i": 1.1, "w": 317.0}
    assert result["work_mode"] == "Normal"
    assert result["model"] == "GW5000-DNS-30"
    assert result["serial"] == "SN-GOODWE-123"
    assert result["firmware"] == "6.5.05"
    assert result["sensors_count"] == len(runtime_data)
    assert result["raw_sensors"]["power_factor"] == 0.999
