# Changelog

## [1.2.6](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.5...v1.2.6) (2026-10-07)


### Bug Fixes

* **i18n:** English screenshots and remaining untranslated utility strings ([#27](https://github.com/DiegoHahn/Solar-hub/issues/27)) ([018d254](https://github.com/DiegoHahn/Solar-hub/commit/018d25469c19e8fdd74f8db619ba362cf59dcd85))

## [1.2.5](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.4...v1.2.5) (2026-10-07)


### Bug Fixes

* **ai-advisor:** share concurrent generations per locale ([#25](https://github.com/DiegoHahn/Solar-hub/issues/25)) ([f46406b](https://github.com/DiegoHahn/Solar-hub/commit/f46406b6ae64522e3711c608eaa8240624828607))
* **dashboard:** use DC module capacity and plane-of-array irradiation for performance figures ([#24](https://github.com/DiegoHahn/Solar-hub/issues/24)) ([a054574](https://github.com/DiegoHahn/Solar-hub/commit/a0545748c750df98c2b9d66eda1003c74a3273db))

## [1.2.4](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.3...v1.2.4) (2026-10-06)


### Bug Fixes

* **dashboard:** restore dynamic performance ratio and cloud loss cards ([#22](https://github.com/DiegoHahn/Solar-hub/issues/22)) ([23aba42](https://github.com/DiegoHahn/Solar-hub/commit/23aba4238539844720cfb656f7295236c6bc2d35))

## [1.2.3](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.2...v1.2.3) (2026-10-06)


### Bug Fixes

* **ai-advisor:** cache analyses per locale and show an unavailable state ([#20](https://github.com/DiegoHahn/Solar-hub/issues/20)) ([c3735e1](https://github.com/DiegoHahn/Solar-hub/commit/c3735e1b7e9626895f4936e7d0f954d2a2c64b64))
* **dashboard:** replace hard-coded performance figures with measured specific yield ([#19](https://github.com/DiegoHahn/Solar-hub/issues/19)) ([b6ee038](https://github.com/DiegoHahn/Solar-hub/commit/b6ee0386ee8220b70c2ed93a4f3395386a0600e5))

## [1.2.2](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.1...v1.2.2) (2026-10-06)


### Bug Fixes

* **deps:** bump sharp to 0.35.5 and restrict monitor workflow permissions ([#16](https://github.com/DiegoHahn/Solar-hub/issues/16)) ([056fc41](https://github.com/DiegoHahn/Solar-hub/commit/056fc4162160a8a97801989716b860fa4918253f))

## [1.2.1](https://github.com/DiegoHahn/Solar-hub/compare/v1.2.0...v1.2.1) (2026-10-06)


### Bug Fixes

* **auth:** let the sign-in server action through the login redirect ([#13](https://github.com/DiegoHahn/Solar-hub/issues/13)) ([2d2edbc](https://github.com/DiegoHahn/Solar-hub/commit/2d2edbc536792d5e965c3a6634be9edd7f5d2cf1))

## [1.2.0](https://github.com/DiegoHahn/Solar-hub/compare/v1.1.2...v1.2.0) (2026-10-06)


### Features

* **i18n:** English locale with language toggle and English codebase ([#8](https://github.com/DiegoHahn/Solar-hub/issues/8)) ([9423ae3](https://github.com/DiegoHahn/Solar-hub/commit/9423ae384d638b31a7026ea7147b1b59a9bf3b27))


### Bug Fixes

* **dashboard:** use a neutral plant title ([#12](https://github.com/DiegoHahn/Solar-hub/issues/12)) ([bf26228](https://github.com/DiegoHahn/Solar-hub/commit/bf262288cbad0cefb92d9673aa2231f1b5005a72))

## [1.1.2](https://github.com/DiegoHahn/Solar-hub/compare/v1.1.1...v1.1.2) (2026-10-06)


### Correções

* **dashboard:** current month generation in the energy flow ([#5](https://github.com/DiegoHahn/Solar-hub/issues/5)) ([188ccc4](https://github.com/DiegoHahn/Solar-hub/commit/188ccc42c8f94a27d94ae1e99fc4de8408190004))
* **deps:** bump source-map-js to 1.2.2 (CVE-2026-93749) ([#6](https://github.com/DiegoHahn/Solar-hub/issues/6)) ([4de4d98](https://github.com/DiegoHahn/Solar-hub/commit/4de4d98b6eb97fefad72de44017f52dede430f14))

## [1.1.1](https://github.com/DiegoHahn/Solar-hub/compare/v1.1.0...v1.1.1) (2026-10-02)


### Correções

* **dashboard:** ignora meses não faturados com saldo zerado no balanço energético ([#3](https://github.com/DiegoHahn/Solar-hub/issues/3)) ([cfe6467](https://github.com/DiegoHahn/Solar-hub/commit/cfe64676610916abf57bbc49f745124c3144115f))

## [1.1.0](https://github.com/DiegoHahn/Solar-hub/compare/v1.0.2...v1.1.0) (2026-10-02)


### Funcionalidades

* **ci:** alerta de telemetria parada ([#23](https://github.com/DiegoHahn/Solar-hub/issues/23)) ([0d0a8ec](https://github.com/DiegoHahn/Solar-hub/commit/0d0a8ec036ca3cdb2d364c0e01b272267ffbae2b))
* **dashboard:** modo demonstração com dados fictícios ([#21](https://github.com/DiegoHahn/Solar-hub/issues/21)) ([b21683d](https://github.com/DiegoHahn/Solar-hub/commit/b21683d9f98d320337c6298131c6cfa9a9b28ac1))


### Correções

* **collector:** sincronização da Cooperaliança com novas tentativas e fora do horário instável do portal ([#27](https://github.com/DiegoHahn/Solar-hub/issues/27)) ([b2e5cb1](https://github.com/DiegoHahn/Solar-hub/commit/b2e5cb11d28db02620f10b78a3d8f60598aec6e3))
* **dashboard:** eixo Y dos gráficos de curva sem rótulos sobrepostos ou cortados ([#26](https://github.com/DiegoHahn/Solar-hub/issues/26)) ([29a6ba0](https://github.com/DiegoHahn/Solar-hub/commit/29a6ba035c661a56cdd27689dffd328914735cc3))

## [1.0.2](https://github.com/DiegoHahn/Solar-hub/compare/v1.0.1...v1.0.2) (2026-10-01)


### Correções

* **dashboard:** mascara a UC e o titular na interface e exibe o eixo da curva em kW ([#15](https://github.com/DiegoHahn/Solar-hub/issues/15)) ([dd1a40b](https://github.com/DiegoHahn/Solar-hub/commit/dd1a40b586917118a4af27936c311cdbf4c5cfbe))

## [1.0.1](https://github.com/DiegoHahn/Solar-hub/compare/v1.0.0...v1.0.1) (2026-09-29)


### Correções

* **dashboard:** curva solar só exibe o slot depois que o horário dele chega ([#10](https://github.com/DiegoHahn/Solar-hub/issues/10)) ([f579570](https://github.com/DiegoHahn/Solar-hub/commit/f579570c2b03a538222d389fe39625dd0753b4ef))

## [1.0.0](https://github.com/DiegoHahn/Solar-hub/compare/v0.1.0...v1.0.0) (2026-09-29)


### Funcionalidades

* adicionar autenticacao supabase ssr, telemetria modbus solis, historico plurianual e limpar dados legados ([6cf732f](https://github.com/DiegoHahn/Solar-hub/commit/6cf732f2d9102891e4ce8e3dfd62e96152b389ee))
* adicionar fluxo de energia, historico solar 7d/30d/90d e consultor energetico IA ([ab0f55c](https://github.com/DiegoHahn/Solar-hub/commit/ab0f55cc95178d29cfe29e4c0c5d59962c113e22))
* **ai-advisor:** considera o horário da análise ao interpretar a geração ([87d92c3](https://github.com/DiegoHahn/Solar-hub/commit/87d92c3b86f5cecce11a4acd7413c3f337fff8af))
* analise climatica aprofundada IA, correcao status diurno de chuva e alinhamento do grafico solar ([014a55b](https://github.com/DiegoHahn/Solar-hub/commit/014a55b1f6867e44ddb49bf719a9524a36500395))
* **ci:** pipeline com testes do dashboard, Trivy e Semgrep ([3115138](https://github.com/DiegoHahn/Solar-hub/commit/3115138788ac6546f6078c51182761d83ce1ca60))
* conectar Gemini com fallbacks dinamicos no .env, gestao de cotas e prompt executivo PT-BR ([f363a50](https://github.com/DiegoHahn/Solar-hub/commit/f363a508039f2a5c86cdcbe4943a080bbeb6e840))
* conectar telemetria real na analise climatica e corrigir datas do grafico ([d786451](https://github.com/DiegoHahn/Solar-hub/commit/d7864511793c6bd53f3e8968d44353c64dcf6100))
* **dashboard:** add solar hub dashboard, mobile touch inspection and utility upsert ([5ca185b](https://github.com/DiegoHahn/Solar-hub/commit/5ca185b00a7048c18d8d95cc455586682ae3c1ff))
* **dashboard:** cache do clima no Supabase e geração diária sem limite de linhas ([7cbb148](https://github.com/DiegoHahn/Solar-hub/commit/7cbb148e821775243de15c5ad3a8be355f170c12))
* **dashboard:** escala solar fixa 05:00-20:00 e formatação de datas da cooperativa ([ef82837](https://github.com/DiegoHahn/Solar-hub/commit/ef82837c453c95741c98986f57c90e16087ec471))
* **dashboard:** skeletons de carregamento na navegação entre páginas ([76333a6](https://github.com/DiegoHahn/Solar-hub/commit/76333a6c0d0bfb50927eb98fcda23b1e99b307aa))
* **db:** armazena o clima diário e consolida a geração por dia ([2ace438](https://github.com/DiegoHahn/Solar-hub/commit/2ace438779a6f18e08921336d6833c349c6e6b3c))
* **db:** versiona o schema do Supabase como migrations ([39900ff](https://github.com/DiegoHahn/Solar-hub/commit/39900ffbea38ecde15e6229f7c14fe6634daba74))
* integrar historico consolidado de inversores e telemetria real no dashboard ([065138a](https://github.com/DiegoHahn/Solar-hub/commit/065138ac71651f4ca431bd18dba359508aa30ab7))
* **linux:** adicionar scripts bash e systemd service para Orange Pi / Ubuntu ([f926559](https://github.com/DiegoHahn/Solar-hub/commit/f9265598c0c716170ade70171ea9b2e82dbe0728))
* **placas:** expansão sincronizada dos cards de inversores ([d69189e](https://github.com/DiegoHahn/Solar-hub/commit/d69189e3c5897b7af8762a8577a8aca1ad8accf9))
* remover modo simulado e conectar dashboard 100% ao Supabase ([3f572a1](https://github.com/DiegoHahn/Solar-hub/commit/3f572a1ee1f3c0d3f9c38dcde7b315a9c2842de9))
* **security:** headers de segurança no next.config ([0eea8ee](https://github.com/DiegoHahn/Solar-hub/commit/0eea8ee8983e95f30f3c1aa174f032f3dd4fce1e))
* setup solar hub collectors, supabase cloud sync, and docs ([312e867](https://github.com/DiegoHahn/Solar-hub/commit/312e8670dd75cf1f2230f98f9c3cda472298673b))
* suporte Modbus TCP GoodWe, fila offline Supabase, escrita atomica e watchdog 24/7 ([18c4328](https://github.com/DiegoHahn/Solar-hub/commit/18c432815e244289dfa9556256a8a1d67fcbcc26))


### Correções

* **ai-advisor:** incremento atômico de cota via função SQL ([9002686](https://github.com/DiegoHahn/Solar-hub/commit/90026864d3252bf293a00836504cfd58b94d8895))
* **ai-advisor:** inicia a cota diária do Gemini zerada ([e4e5e2a](https://github.com/DiegoHahn/Solar-hub/commit/e4e5e2a3f9e6781f5b7ecb4fe62e8027752c636c))
* **ai-advisor:** persiste cota e cache da análise no Supabase ([1a353a7](https://github.com/DiegoHahn/Solar-hub/commit/1a353a7a8752009b646c65e2e94068c9b7907666))
* ajustar fuso horario (America/Sao_Paulo -03:00) na telemetria e graficos ([599a5a7](https://github.com/DiegoHahn/Solar-hub/commit/599a5a7c7b410e7aab9f3074587bd11a13ce09c7))
* **auth:** mensagens genericas na tela de login contra enumeracao ([5efb082](https://github.com/DiegoHahn/Solar-hub/commit/5efb0829ff099f557d925c62742e2c94a844e413))
* **auth:** proteção de endpoints de api, prevenção de open redirect e allowlist fail-closed ([e113a6f](https://github.com/DiegoHahn/Solar-hub/commit/e113a6fc245cad4e3768cedf18bc28b21edac91a))
* **build:** corrigir tipos TypeScript no build, whitelist auth Google e ajustes de UI ([16845d8](https://github.com/DiegoHahn/Solar-hub/commit/16845d8bbe8eb29a28865e23cb35fbe41a34087b))
* **collector:** API local restrita a localhost e sem trigger ([d8a905d](https://github.com/DiegoHahn/Solar-hub/commit/d8a905dcaee8104b58b70d42673fc025e2a0d25f))
* **collector:** corrigir bloco try-except em get_last_known_energies ([13c83f5](https://github.com/DiegoHahn/Solar-hub/commit/13c83f5066186cff3ed616e85bac5e5c8afd5e41))
* **collector:** exibe a saída dos coletores no journal em tempo real ([9e65bd6](https://github.com/DiegoHahn/Solar-hub/commit/9e65bd68f572d077f39c7870d185b69a3a17c2b4))
* **collector:** remove dados pessoais e de rede do código ([65af8e6](https://github.com/DiegoHahn/Solar-hub/commit/65af8e668ca073cd9aae65e311d2e0fc51c37c2f))
* **dashboard:** corrige os erros apontados pelo ESLint ([6cac469](https://github.com/DiegoHahn/Solar-hub/commit/6cac46948e9900d1c6b38c08f635e981125ab818))
* fuso horario brasilia, centralizacao mobile e touch dos graficos no iphone ([13b41f3](https://github.com/DiegoHahn/Solar-hub/commit/13b41f32f701e6d8942bbfb8b159db4d57e20501))
* **placas:** geração anual pela produção bruta dos inversores ([0db68d3](https://github.com/DiegoHahn/Solar-hub/commit/0db68d300bfd747570ee63e1f6907898f334d050))
* **security:** restringe o acesso aos dados a usuários autenticados ([566aee0](https://github.com/DiegoHahn/Solar-hub/commit/566aee056c295e0e004c09789dc1a396f56bf82a))
* suporte touch e reset definitivo dos graficos no iphone ([91f4d1c](https://github.com/DiegoHahn/Solar-hub/commit/91f4d1cfde47d858452f2f95007be34def97e639))
* touch reset no iphone e painel fixo superior em sol vs geracao ([73c5f67](https://github.com/DiegoHahn/Solar-hub/commit/73c5f67291f4a9ec5b5bff52727585f0ec6d0e76))


### Performance

* desativar gravacao desnecessaria de JSONs locais e enviar direto ao Supabase ([9c054dd](https://github.com/DiegoHahn/Solar-hub/commit/9c054ddc098317d8a8e7636ec57f67f97cca5580))


### Refatoração

* **collector:** parsers puros e testes com pytest ([2035d52](https://github.com/DiegoHahn/Solar-hub/commit/2035d52d5488cf2a4d11fb43a32973a0db7e43cb))
* organiza o coletor Python em collector/ ([a0590ef](https://github.com/DiegoHahn/Solar-hub/commit/a0590ef2096071998b5db747a46da3be8626cb29))


### Testes

* cobertura mínima de 80% no dashboard e no coletor ([#8](https://github.com/DiegoHahn/Solar-hub/issues/8)) ([243c881](https://github.com/DiegoHahn/Solar-hub/commit/243c8812796a017457dae1a6bb112087151fdd36))
* **dashboard:** componentes com Testing Library ([c13f0bf](https://github.com/DiegoHahn/Solar-hub/commit/c13f0bfb980061c0c9cbd82ddbb334445297aecb))
* **dashboard:** E2E com Playwright contra o app real ([b28ad4e](https://github.com/DiegoHahn/Solar-hub/commit/b28ad4ef78c7adca9e78e07ac76423de5ae4fd4e))
* **dashboard:** fixtures reais anonimizadas e script de captura ([24c4215](https://github.com/DiegoHahn/Solar-hub/commit/24c42152cbc3caa1e66171b1193df4cac50e4fd2))
* **dashboard:** integração com Supabase e Open-Meteo reais ([4db39b7](https://github.com/DiegoHahn/Solar-hub/commit/4db39b7ce64439178e35fcd4d2ed4c73437c1b15))
* **dashboard:** regras de negócio de queries e clima com dados reais ([3d7488f](https://github.com/DiegoHahn/Solar-hub/commit/3d7488ffd51f6dcdbf7ed877bf7c51e72e757d60))
* **dashboard:** testes unitários de utilitários e formatação ([fc0a97e](https://github.com/DiegoHahn/Solar-hub/commit/fc0a97e20188142080acc4f835347ac32850b41f))


### Documentação

* adicionar instrucoes de execucao do dashboard, deploy na Vercel e comandos Linux no README ([5d085f1](https://github.com/DiegoHahn/Solar-hub/commit/5d085f11c8fbe5f7745a9cbfba3b8ae38ab6778a))
* atualiza o README para a nova estrutura do repositório ([37313b0](https://github.com/DiegoHahn/Solar-hub/commit/37313b02e8af835bc10d9badb9c28d100becbd81))
* centraliza a documentação no README da raiz ([e295076](https://github.com/DiegoHahn/Solar-hub/commit/e2950769077f4f50760212cfba2fe7d9c6cb5007))
* **dashboard:** reescreve comentários que dependiam de contexto histórico ([cf1f800](https://github.com/DiegoHahn/Solar-hub/commit/cf1f800e2f23de9e81f4a1a93d2e687c9dbda5ee))
* **security:** documentar modelo de RLS e permissões de arquivos no README ([cc29948](https://github.com/DiegoHahn/Solar-hub/commit/cc29948f86e9c1f997a491919ca2044530319041))
