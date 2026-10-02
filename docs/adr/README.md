# Registros de Decisões de Arquitetura (ADRs)

Este diretório documenta as principais decisões arquiteturais tomadas durante a concepção e evolução do **Solar Hub**, estruturadas de acordo com o formato [MADR (Markdown Architectural Decision Records)](https://adr.github.io/madr/).

Cada registro detalha o contexto técnico e os requisitos que motivaram a discussão, a decisão adotada e as consequências (positivas, negativas e mitigações).

---

## Índice de Decisões

| ADR | Título | Data | Status | Resumo da Decisão |
| :---: | :--- | :---: | :---: | :--- |
| [0001](0001-coleta-edge-to-cloud-dispositivo-local.md) | Coleta Edge-to-Cloud em Dispositivo Local | 2026-08-30 | **Aceito** | Substituição das nuvens proprietárias por SBC local (Orange Pi 4 Pro) interrogando inversores via Modbus e Solarman V5 com fila offline em JSON. |
| [0002](0002-supabase-com-rls-sem-api-propria.md) | Supabase com Row Level Security (RLS) sem API Intermediária | 2026-09-25 | **Aceito** | Acesso direto ao PostgreSQL gerenciado via Server Components com políticas RLS por linha e escrita restrita a contas pré-autorizadas para cache. |
| [0003](0003-nextjs-app-router-server-components-gru1.md) | Next.js App Router com Server Components e Região gru1 na Vercel | 2026-09-04 | **Aceito** | Renderização no servidor sem waterfall de requisições no cliente e hospedagem na região gru1 (São Paulo) na Vercel. |
| [0004](0004-github-flow-e-release-please.md) | GitHub Flow e Automação de Versões com Release Please | 2026-09-29 | **Aceito** | Branches efêmeras, CI com trava de cobertura ≥ 80%, squash merge linear e releases automatizadas a partir de Conventional Commits. |
| [0005](0005-testes-com-dados-reais-anonimizados.md) | Testes com Dados Reais Anonimizados e Mocks Mínimos | 2026-09-29 | **Aceito** | Suíte de testes baseada em fixtures anonimizadas de produção, servidores HTTP locais reais e minimização de dublês sintéticos. |

---

## Estrutura do Padrão MADR

Cada ADR segue a estrutura padrão:
* **Contexto:** Problema identificado, forças envolvidas e alternativas analisadas.
* **Decisão:** Escolha técnica adotada e justificativa.
* **Consequências:** Benefícios conquistados, trade-offs e estratégias de mitigação.
