# 3. Next.js App Router com Server Components e Região gru1 na Vercel

* **Status:** Aceito
* **Data:** 2026-09-04 (registro retroativo)
* **Decisores:** Diego Hahn

## Contexto

Dashboards desenvolvidos como Single Page Applications (SPAs puras no navegador) enfrentam desafios comuns:

1. **Efeito cascata de requisições (*network waterfall*):** O navegador precisa baixar o bundle de scripts, inicializar o framework, renderizar esqueletos de carregamento e disparar múltiplas requisições paralelas para carregar telemetria, clima, faturas e gráficos.
2. **Bundle JavaScript excessivo:** Bibliotecas de formatação, normalização de dados e clientes de banco são enviadas para o dispositivo do usuário final.
3. **Latência de rede:** Se as funções serverless executarem em regiões distantes (como na América do Norte), a comunicação entre o usuário no Brasil, o servidor web e o banco de dados acumula tempo adicional de trânsito em cada requisição.

## Decisão

Adotamos o Next.js 16 com App Router, React Server Components (RSC) e implantação na região `gru1` (São Paulo) na Vercel:

1. **Server Components como padrão:** As rotas principais do sistema buscam dados no banco de dados durante a renderização no servidor. O cliente recebe o HTML com os dados já prontos, reduzindo o tempo até a exibição do conteúdo.
2. **Separação de interatividade:** Apenas componentes que dependem de eventos do DOM, ciclo de vida ou manipulação de canvas/SVG (gráficos do Recharts, abas do Radix UI, seletor de tema) recebem a diretiva `'use client'`.
3. **Região `gru1` na Vercel:** As funções serverless da aplicação são alocadas na região de São Paulo (`gru1`), aproximando o processamento do servidor web dos usuários finais no Brasil.
4. **Proteção de credenciais de API:** Operações com APIs externas (Google AI Studio / Gemini, Open-Meteo) ocorrem em Route Handlers e Server Components, mantendo chaves de serviço e tokens inacessíveis para o cliente.

## Consequências

### Positivas

* **Menor latência de trânsito:** A proximidade geográfica do servidor serverless reduz o tempo de resposta percebido pelo usuário.
* **Carregamento inicial mais eficiente:** Envio de dados pré-renderizados no primeiro payload HTML e menor incidência de saltos de layout (*Cumulative Layout Shift*).
* **Bundle reduzido no cliente:** Código de parsing, formatação e agregação de dados não é enviado ao navegador.
* **Isolamento de segredos:** Credenciais de inteligência artificial e regras de prompt não são expostas no código client-side.

### Negativas e Mitigações

* **Fronteira de serialização:** Exige disciplina para evitar a passagem de objetos não serializáveis entre Server e Client Components. *Mitigação:* Tipagem estrita com TypeScript para as propriedades (*props*) dos componentes de interface.
