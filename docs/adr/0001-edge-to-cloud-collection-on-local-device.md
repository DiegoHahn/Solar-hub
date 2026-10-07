# 1. Edge-to-Cloud Collection via Local Physical Device

* **Status:** Accepted
* **Date:** 2026-08-30 (retroactive record)
* **Decision Makers:** Diego Hahn

## Context

The solar plant consists of multiple photovoltaic inverters from distinct manufacturers (Solis and GoodWe). Each manufacturer provides its own proprietary cloud infrastructure (Solarman Smart and SEMS Portal). Relying on these third-party cloud services poses notable architectural limitations:

1. **Sampling interval and latency:** Vendor cloud servers refresh metrics at slow intervals (5 to 15 minutes), obscuring transient electrical fluctuations (cloud cover transitions, grid voltage sags).
2. **Data fragmentation:** Disjointed user portals prevent a unified, real-time telemetry view of the overall solar plant.
3. **API instability and rate limits:** Proprietary clouds experience periodic outages, unannounced API schema alterations, and restrictive rate limiting.
4. **Lack of historical telemetry control:** Difficulties exporting raw, high-resolution electrical data (per-string PV voltage and current, inverter internal temperature, power factor).

## Decision

We adopted an edge-to-cloud collection architecture:

1. **Local edge device:** A dedicated single-board computer (Orange Pi 4 Pro) runs on the physical installation's local network, connected over LAN to the inverters' Wi-Fi dataloggers.
2. **Local industrial protocols:** The Python collector service queries equipment directly on the internal subnet:
   - **Solis:** Encapsulates and decodes Solarman V5 frames (`0xA5`) wrapping Modbus RTU requests across holding registers `0..39` on UDP/TCP port `8899`, with HTTP status scrape fallback.
   - **GoodWe:** Queries 52 industrial registers via Modbus TCP on port `502`, with fallback to UDP on port `8899`.
3. **Offline queue and local persistence:** When internet connectivity is disrupted, the collector enqueues snapshots locally in a JSON file (`offline_queue.json`) with FIFO eviction, flushing records to Supabase as soon as network reachability is restored.
4. **Credential isolation:** The unrestricted write key (`service_role`) resides solely on the physical edge device with strict filesystem permissions (`chmod 600`), without exposure to frontend bundles or client-facing environments.

## Consequences

### Positive

* **Cloud vendor independence:** Fully autonomous operation even during outages of third-party manufacturer portals.
* **Fine-grained temporal resolution:** Instantaneous electrical sampling on 10-minute cycles with consolidated cloud telemetry.
* **Unified telemetry model:** Normalization of heterogeneous electrical metrics prior to ingestion into PostgreSQL.
* **Network resilience:** Protection against WAN disconnections through local disk-backed JSON queuing.

### Negative and Mitigations

* **Hardware dependency:** SBC hardware failure halts telemetry collection. *Mitigation:* Solid-state hardware with no moving parts, low power draw (~4W), and supervised process restarts managed by systemd.
* **Local network management:** Inverters must maintain predictable IP addresses. *Mitigation:* Static DHCP IP reservations on the local router and documented topology in the `config.json` configuration file.
