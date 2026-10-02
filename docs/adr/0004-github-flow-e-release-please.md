# 4. GitHub Flow e Automação de Versões com Release Please

* **Status:** Aceito
* **Data:** 2026-09-29 (registro retroativo)
* **Decisores:** Diego Hahn

## Contexto

Estratégias de versionamento com múltiplos ramos concorrentes de longa duração (como GitFlow, com branches `develop`, `master`, `release/*` e `hotfix/*`) geram atrito em equipes enxutas:
1. **Conflitos de integração (*merge hell*):** Ramos acumulados aumentam a complexidade de conciliação de código.
2. **Lentidão de entrega:** Múltiplas etapas manuais entre a conclusão de uma funcionalidade e sua publicação.
3. **Inconsistência de releases:** Criação manual de tags git e escrita manual de `CHANGELOG.md`, sujeitas a omissões.

Por outro lado, commits diretos no ramo principal (`main`) sem esteiras automatizadas comprometeriam a integridade do ambiente produtivo na Vercel e inviabilizariam revisões atômicas.

## Decisão

Adotamos o GitHub Flow associado ao padrão Conventional Commits e à automação do Release Please:

1. **Branches efêmeras:** Todo desenvolvimento tem origem a partir do `main` atualizado, adotando prefixos semânticos padronizados (`feat/`, `fix/`, `docs/`, `chore/`).
2. **Ruleset e proteção de branch:** Commits diretos no `main` são bloqueados. O branch exige Pull Request com status checks obrigatórios passando (sem exigência de número mínimo de aprovações de terceiros, compatível com projeto mantido individualmente).
3. **Esteira de CI por PR:** Todo Pull Request deve ter 100% de sucesso nas seguintes checagens:
   - Linting e checagem de tipos (TypeScript no dashboard, Ruff no coletor Python);
   - Testes unitários e de componentes com trava de cobertura mínima de 80%;
   - Build de produção do Next.js;
   - Análise estática de vulnerabilidades e dependências (Trivy e Semgrep).
   Os testes de integração (com Supabase e Open-Meteo reais) e testes E2E executam no branch `main` e em agendamento diário, protegendo credenciais de integração em PRs externos.
4. **Squash and Merge:** O merge no `main` é realizado via *squash*, consolidando o Pull Request em um commit único e mantendo histórico linear.
5. **Versionamento semântico automatizado:** O workflow `.github/workflows/release-please.yml` analisa os commits incorporados ao `main`, determina a próxima versão semântica (SemVer), atualiza o `CHANGELOG.md` e gera as tags e releases no GitHub.

## Consequências

### Positivas

* **Histórico linear e legível:** Facilidade para auditorias, comandos `git bisect` e eventuais operações de reversão (*revert*).
* **Deploy contínuo confiável:** Todo commit incorporado ao `main` passou por validação estática e testes de unidade com cobertura travada.
* **Governança de versões:** Changelog automatizado e rastreável, categorizado por tipo de contribuição.

### Negativas e Mitigações

* **Disciplina nas mensagens de commit:** Títulos de PR e commits precisam seguir o padrão Conventional Commits. *Mitigação:* Diretrizes documentadas no `CONTRIBUTING.md` e verificação nos templates de Pull Request.
