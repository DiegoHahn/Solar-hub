# 1. Coleta Edge-to-Cloud em Dispositivo Local

* **Status:** Aceito
* **Data:** 2026-08-30 (registro retroativo)
* **Decisores:** Diego Hahn

## Contexto

A usina solar é composta por múltiplos inversores fotovoltaicos de fabricantes distintos (Solis e GoodWe). Cada fabricante disponibiliza sua própria infraestrutura de nuvem (Solarman Smart e SEMS Portal). Depender desses serviços terceirizados apresenta limitações arquiteturais:

1. **Latência e amostragem:** Os servidores em nuvem dos fabricantes atualizam métricas em intervalos lentos (5 a 15 minutos), impedindo a análise de variações transitórias (passagem de nuvens, oscilações de tensão da rede).
2. **Fragmentação de dados:** Interfaces separadas impedem uma visão consolidada em tempo real da usina.
3. **Instabilidade e bloqueios de API:** Nuvens proprietárias sofrem indisponibilidades ocasionais, alterações em APIs internas e restrições de chamadas (*rate limiting*).
4. **Falta de controle histórico:** Dificuldade de exportar dados elétricos detalhados (tensão e corrente por string PV, temperatura interna, fator de potência).

## Decisão

Adotamos a arquitetura de coleta edge-to-cloud:

1. **Dispositivo local (Edge):** Um computador de placa única (Orange Pi 4 Pro) opera dedicado na rede local da instalação física, conectado via LAN aos dataloggers Wi-Fi dos inversores.
2. **Protocolos industriais locais:** O serviço coletor em Python interroga diretamente os equipamentos na rede interna:
   - **Solis:** Empacota e decodifica quadros Solarman V5 (`0xA5`) contendo requisições Modbus RTU aos registradores `0..39` na porta UDP/TCP `8899`, com fallback via status HTTP.
   - **GoodWe:** Consulta 52 registradores industriais via Modbus TCP na porta `502`, com fallback para UDP na porta `8899`.
3. **Buffer e persistência offline:** Caso a conexão com a internet seja interrompida, o coletor enfileira os snapshots localmente em arquivo JSON (`offline_queue.json`) com retenção FIFO, descarregando-os para o Supabase assim que a conectividade for restaurada.
4. **Isolamento de credenciais:** A chave com permissão de escrita irrestrita (`service_role`) reside unicamente no dispositivo edge com permissões restritas de arquivo (`chmod 600`), sem ser exposta ao frontend ou ao repositório.

## Consequências

### Positivas

* **Independência de nuvens terceiras:** Operação autônoma mesmo com indisponibilidade dos portais dos fabricantes.
* **Resolução temporal fina:** Leitura elétrica instantânea em ciclos de 10 minutos e telemetria consolidada na nuvem.
* **Modelo de dados unificado:** Normalização de grandezas elétricas antes do upload para o PostgreSQL.
* **Resiliência de rede:** Proteção contra oscilações de conexão através da fila offline local em JSON.

### Negativas e Mitigações

* **Dependência de hardware local:** Um defeito no SBC interrompe a coleta. *Mitigação:* Hardware sem partes móveis, baixo consumo elétrico (~4W) e reinicialização supervisionada pelo systemd.
* **Gestão de rede local:** Requer que os inversores mantenham endereços IP previsíveis. *Mitigação:* Reserva de IPs estáticos via DHCP no roteador local e documentação da topologia em arquivo de configuração (`config.json`).
