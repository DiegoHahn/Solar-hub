# Contribuindo

O projeto segue o **GitHub Flow**: o `main` está sempre pronto para produção e toda mudança entra por pull request.

## Fluxo

1. Crie uma branch a partir do `main` atualizado, com o prefixo do tipo de mudança:

   ```bash
   git switch main && git pull
   git switch -c feat/historico-anual
   ```

   Prefixos: `feat/`, `fix/`, `test/`, `docs/`, `refactor/`, `chore/`, `ci/`.

2. Faça commits pequenos no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

   ```text
   feat(placas): comparação da geração anual por inversor
   fix(collector): reconexão ao logger Solis após timeout
   ```

3. Abra o pull request para o `main`. O CI roda lint, typecheck, testes com cobertura mínima, build e análise de segurança (Trivy e Semgrep); a Vercel publica um preview do dashboard no próprio PR.

4. Com os checks verdes e as conversas resolvidas, o PR é integrado por **squash merge**. O título do PR vira a mensagem do commit no `main`, por isso também segue o Conventional Commits. A branch é apagada automaticamente.

O `main` é protegido: não aceita push direto, force push nem merge com checks falhando.

## Checagens locais

O hook `pre-push` roda os testes e a cobertura antes de cada push. Ative uma vez por clone:

```bash
git config core.hooksPath .githooks
```

Para rodar manualmente:

```bash
cd dashboard && npm run lint && npm run typecheck && npm run test:coverage
cd collector && ruff check . && ruff format --check . && pytest
```

## Releases

As versões seguem o [Semantic Versioning](https://semver.org/lang/pt-BR/) e são geradas pelo [release-please](https://github.com/googleapis/release-please) a partir dos commits do `main`: ele mantém um PR de release com o `CHANGELOG.md` e a próxima versão (`fix` e `perf` → patch, `feat` → minor, `!`/`BREAKING CHANGE` → major). Os demais tipos (`refactor`, `test`, `docs`, `ci`, `chore`, `style`) ficam no histórico do git, mas não geram versão. O PR de release acumula as mudanças até ser integrado, o que cria a tag e a GitHub Release.

## Deploy

- **Dashboard:** a Vercel publica o `main` automaticamente a cada merge.
- **Coletor:** o dispositivo edge acompanha o `main`; após o merge de mudanças em `collector/`, atualize com `git pull` e reinicie o serviço (`systemctl restart solar-inverters@<usuário>`).
