# 2. Supabase com Row Level Security (RLS) sem Camada de API Intermediária

* **Status:** Aceito
* **Data:** 2026-09-25 (registro retroativo)
* **Decisores:** Diego Hahn

## Contexto

Aplicações orientadas a dashboards frequentemente adotam uma arquitetura com três camadas: Frontend (SPA) → Backend/API (Node.js/Python) → Banco de Dados (SQL).

Para o Solar Hub, manter um serviço intermediário de API representaria:
1. **Sobrecarga operacional:** Necessidade de gerenciar, monitorar e manter contêineres ou serviços adicionais na nuvem.
2. **Duplicação de camadas de tipos:** Escrever e sincronizar DTOs e controladores REST repetitivos apenas para repassar dados do banco para o frontend.
3. **Latência adicional:** Salto de rede extra (Browser/SSR → API Gateway → PostgreSQL).

## Decisão

Adotamos o Supabase (PostgreSQL gerenciado) com Row Level Security (RLS) como camada unificada de dados e autenticação, acessado diretamente pelo Next.js via Server Components e Route Handlers:

1. **Autenticação:** O Supabase Auth gerencia identidades via tokens JWT trafegados em cookies seguros (`httpOnly`, `sameSite=lax`), operados pelo pacote `@supabase/ssr`. Novos cadastros públicos estão desativados no projeto; apenas contas pré-autorizadas na variável de ambiente `ALLOWED_EMAILS` obtêm acesso às rotas da aplicação.
2. **Isolamento via RLS:**
   - **Leitura restrita:** Todas as tabelas possuem `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Usuários anônimos (`anon`) não possuem permissão de leitura nas tabelas de telemetria ou concessionária.
   - **Escrita restrita das telemetrias:** As tabelas `solar_telemetry` e `utility_data` rejeitam operações de escrita (INSERT, UPDATE, DELETE) por usuários da role `authenticated`. Apenas a chave administrativa `service_role`, retida exclusivamente no hardware edge da usina, grava essas informações.
3. **Escrita `authenticated` em tabelas de cache (`ai_advisor_daily` e `daily_weather`):**
   - O dashboard consome previsões da Open-Meteo e insights do Consultor IA (Google Gemini). Para evitar custos e esgotamento de cotas de APIs externas, essas respostas são salvas em cache por data.
   - As funções serverless na Vercel operam sob a identidade do usuário logado (`authenticated`). Para persistir o cache diário sem injetar a chave com privilégios totais (`service_role`) no ambiente da Vercel, concedemos permissão de escrita para a role `authenticated` nas tabelas `ai_advisor_daily` e `daily_weather`.
   - **Risco aceito:** A role `authenticated` pode realizar INSERT/UPDATE nessas tabelas para qualquer data. Esse risco é aceito porque o cadastro público no Supabase Auth está desativado e apenas e-mails explicitamente configurados em `ALLOWED_EMAILS` recebem sessão de usuário autenticado.

## Consequências

### Positivas

* **Arquitetura enxuta:** Nenhuma infraestrutura de servidor intermediário para escalar ou orquestrar.
* **Controle de acesso centralizado no banco:** Políticas de segurança aplicadas no nível da linha no PostgreSQL (*defense-in-depth*), prevenindo que erros de renderização ou consultas no cliente acessem dados não autorizados.
* **Execução de funções serverless sem chave mestra:** O cache de clima e IA funciona na Vercel sem expor a chave `service_role` no frontend ou em variáveis de ambiente da nuvem pública.

### Negativas e Mitigações

* **Acoplamento a recursos de banco:** As regras de acesso dependem da sintaxe e mecanismos de RLS do PostgreSQL. *Mitigação:* O PostgreSQL é padrão aberto; todas as políticas de segurança são expressas em migrações SQL versionadas no repositório.
