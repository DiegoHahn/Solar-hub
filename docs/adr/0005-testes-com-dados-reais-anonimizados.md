# 5. Testes com Dados Reais Anonimizados e Mocks Mínimos

* **Status:** Aceito
* **Data:** 2026-09-29 (registro retroativo)
* **Decisores:** Diego Hahn

## Contexto

A confiabilidade de uma suíte de testes em sistemas IoT e de telemetria energética costuma ser afetada por dois extremos:

1. **Abuso de dublês sintéticos (*over-mocking*):** Estruturas de dados manuais tendem a simplificar a realidade. Cenários reais com campos ausentes, nulos imprevistos, discrepâncias de precisão em ponto flutuante, estruturas aninhadas em colunas JSONB e comportamentos de fuso horário passam despercebidos quando os mocks não refletem os payloads reais.
2. **Dependência de hardware físico nos testes:** Testar o coletor diretamente contra os inversores físicos e a concessionária tornaria o pipeline de CI inviável: os equipamentos físicos dependem de incidência de luz solar (desligam-se à noite), conexões de rede locais e credenciais sigilosas.

## Decisão

Adotamos a abordagem de testes baseada em dados reais anonimizados e redução de mocks:

1. **Fixtures anonimizadas:** Um script de captura (`dashboard/scripts/capture-fixtures.ts`) extrai conjuntos de dados reais do banco e dos inversores, aplicando sanitização irreversível antes do versionamento:
   - Substituição de CPF, endereços, nomes de titulares, e-mails e UCs por placeholders padronizados (`000.000.000-00`, `Titular Teste`, `00000000000`, `teste@solarhub.local`);
   - Mascaramento de números de série, dataloggers, MACs de Wi-Fi e endereços IP de inversores por identificadores de teste (`SN-1`, `02:00:00:00:00:0x`, `10.0.0.x`).
2. **Servidores HTTP locais em vez de mocks de chamadas:** Nos testes do coletor Python, as requisições de envio ao Supabase não são substituídas por mocks de funções (`unittest.mock`), mas disparadas contra um servidor HTTP real em loopback (`pytest-httpserver`). Isso valida os cabeçalhos de autenticação, formato dos payloads JSON, códigos de resposta HTTP (200, 201, 401, 500) e o mecanismo de buffer offline em arquivo JSON (`offline_queue.json`).
3. **Integração contra o Supabase:** Os testes de integração executam contra uma instância do Supabase com as políticas de Row Level Security (RLS) ativas, operando sob uma conta de testes com os mesmos privilégios do usuário final.
4. **Mocks restritos a custos e serviços externos:** O uso de mocks sintéticos fica delimitado a:
   - Injeção controlada de falhas de rede e simulação de corrupção de pacotes;
   - Chamadas à API do Google Gemini (para preservar a cota diária de IA nos testes locais e de CI).
5. **Travas obrigatórias de cobertura (≥ 80%):** Tanto o backend Python (`pytest-cov`) quanto o dashboard TypeScript (`vitest` + `v8`) mantêm limites mínimos de 80% de cobertura de linhas.

## Consequências

### Positivas

* **Fidelidade aos dados de produção:** Validação com estruturas de dados equivalentes às que trafegam nos inversores e nas faturas da concessionária.
* **Reprodutibilidade e velocidade:** A suíte completa executa em segundos em qualquer ambiente de desenvolvimento ou runner do GitHub Actions sem depender de hardware físico ou de sol.
* **Prevenção de vazamento de dados pessoais:** Nenhuma informação pessoal identificável (PII) ou credencial real entra nas fixtures ou nos testes.

### Negativas e Mitigações

* **Manutenção das fixtures:** Mudanças de layout de resposta de inversores exigem atualizar as fixtures versionadas. *Mitigação:* Script de captura que permite gerar novas fixtures anonimizadas de forma automatizada.
