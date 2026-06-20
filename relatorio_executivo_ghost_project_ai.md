# RELATÓRIO EXECUTIVO TÉCNICO - GHOST PROJECT AI

Este relatório apresenta um retrato técnico factual do estado atual do Ghost Project AI, cobrindo aspectos de estado, arquitetura, funcionalidades, componentes órfãos, estruturas estratégicas, integração Shopify, bloqueios e oportunidades de execução imediata. Não inclui opiniões, sugestões ou roadmaps, apenas fatos extraídos da análise do código-fonte e documentação existente.

---

## 1. ESTADO DO PROJETO

*   **Branch Atual:** `main`
*   **Último Commit:** `ceb594ccd7138fcb7f9d717b074f9eee1433e2b4`
*   **Data do Último Commit:** `Tue Jun 16 05:14:12 2026 -0300`
*   **Último Build Válido:** Conforme `RELATORIO_ESTABILIZACAO_TRACKING.md` e `OTIMIZACAO_VISUAL.md`, o último build completo e funcional foi realizado com sucesso em `src/App_FINAL.jsx` (sem erros de compilação, `npm run build`).
*   **Último Deploy Válido:** O `public/ghost-sdk.js` aponta para `https://ghost-project-ai-bbvc.vercel.app`, indicando que o deploy mais recente e funcional está ativo na Vercel.

---

## 2. ARQUITETURA REAL

*   **Arquivo Principal em Produção:** `src/App_FINAL.jsx` é o único componente `App` efetivamente renderizado, importado via `src/main.tsx`.
*   **Fluxo de Execução:**
    1.  `index.html` carrega o ponto de entrada principal `src/main.tsx`.
    2.  `src/main.tsx` importa e renderiza `src/App_FINAL.jsx`.
    3.  `App_FINAL.jsx` gerencia a interface do usuário, a lógica da câmera e o tracking de mão usando `MediaPipe Hands`.
    4.  Ele carrega dinamicamente modelos 3D (`.glb`) usando o componente `<model-viewer>` do Google, obtendo as URLs dos modelos via `src/utils/urlParams.js` e `src/data/products.json`.
    5.  O `public/ghost-sdk.js` é injetado em lojas Shopify para integrar o botão "Ver em Realidade Aumentada", direcionando para a URL principal do Ghost Project com parâmetros específicos de produto.
*   **Componentes Principais:**
    *   `src/App_FINAL.jsx`: Componente React principal que orquestra toda a experiência AR.
    *   `public/ghost-sdk.js`: Script de integração para plataformas externas (Shopify).
    *   `src/utils/urlParams.js`: Utilitário para extrair parâmetros de URL, fundamental para o modo loja.
    *   `src/data/products.json`: Catálogo de produtos com mapeamento entre IDs de produto e URLs de modelos GLB.
    *   `src/components/SAAPSHint.jsx`: Componente de dica visual para refinamento de posicionamento AR (arquitetura preparada, mas não ativado em `App_FINAL.jsx`).
    *   `src/DiagnosticPage.jsx`: Página de diagnóstico para carregamento de modelos GLB.
    *   `src/TestModelsPage.jsx`: Página de catálogo para teste de modelos em desenvolvimento.
    *   `src/LandingPage.jsx`: Landing Page comercial para captação de leads B2B.
*   **Integrações Existentes:**
    *   **MediaPipe Hands:** Biblioteca de tracking de mão do Google (via CDN).
    *   **Google Model Viewer:** Componente web para renderização 3D de modelos GLB (via CDN).
    *   **Shopify (indireta):** Via injeção de `public/ghost-sdk.js` para criar o botão "Ver em Realidade Aumentada" e redirecionar para o Ghost Project com parâmetros de URL.

---

## 3. FUNCIONALIDADES CONCLUÍDAS

*   **Tracking AR de Mão:** Detecção e rastreamento da mão utilizando MediaPipe Hands, com posicionamento 2D e rotação (`rotateZ`) do modelo 3D no pulso. (Implementado em `App_FINAL.jsx` e `App.jsx`)
*   **Renderização de Modelos 3D:** Exibição de modelos GLB no navegador usando Google Model Viewer.
*   **Catálogo de Produtos Dinâmico:** Carregamento de modelos GLB com base em `productId` via URL, consultando `src/data/products.json`.
*   **Modo Embedded (Loja):** Reconhecimento do parâmetro `embedded=true` na URL para ajustar o comportamento da aplicação em um contexto de e-commerce.
*   **Botões CTA Contextuais:** "Comprar Agora" e "Continuar Comprando" com funcionalidade de redirecionamento para `cartUrl` ou `productUrl` (no modo loja).
*   **Seleção de Câmera:** Permite ao usuário alternar entre câmera frontal (`user`) e traseira (`environment`).
*   **Página de Diagnóstico de GLB:** `DiagnosticPage.jsx` para auditoria e validação de carregamento de modelos.
*   **Página de Teste de Modelos:** `TestModelsPage.jsx` para selecionar e visualizar modelos específicos (`CW001` a `CW015`).
*   **Modal B2B:** Captura de e-mail corporativo para demonstração privada.
*   **Landing Page Comercial:** Página completa com formulário de captação de leads B2B (`LandingPage.jsx`).
*   **Otimização de Modelos GLB:** Todos os 15 modelos de produtos otimizados (redução média de 75.6% no tamanho) para WebAR móvel (documentado em `RELATORIO_OTIMIZACAO_GLB.md`).
*   **Correção de Perspectiva 3D:** Implementação de uma estrutura de dois layers (container pai com `perspective` e wrapper filho com rotações) para ancorar o relógio corretamente ao pulso durante movimentos 3D (documentado em `CORRECAO_3D_PERSPECTIVE.md`).
*   **Estabilização e Suavização de Tracking:** Implementação de dead zones para posição e rotação, e smoothing de rotação para reduzir jitter e tremor (documentado em `RELATORIO_ESTABILIZACAO_TRACKING.md`).

---

## 4. FUNCIONALIDADES PARCIALMENTE IMPLEMENTADAS

*   **Tracking 3D (Pitch/Yaw):** Os cálculos para `pitch` (inclinação vertical) e `yaw` (rotação lateral) foram adicionados em `src/App_FINAL.jsx` e são aplicados ao `<model-viewer>`. No entanto, o `RELATORIO_CAUSA_RAIZ_DEFINITIVA.md` indica que o sistema de tracking profissional (`src/tracking/WristTracker.js`) não está sendo utilizado em `App_FINAL.jsx`, que usa uma implementação mais simples com smoothing primitivo. Embora o `pitch` e `yaw` existam no `App_FINAL.jsx`, a implementação completa e robusta com One Euro Filter e persistência temporal (presente em `src/tracking/`) não está ativa.
*   **SAAPS (Smart Assisted AR Positioning System):** O componente `src/components/SAAPSHint.jsx` está arquitetado com placeholders para gestos de refinamento (`body` e `environment`), mas não está ativado em `App_FINAL.jsx` e a lógica de detecção de gestos reais (fase 2 e 3 do roadmap SAAPS) ainda não foi implementada.
*   **Report Panel:** O componente `src/ReportPanel.jsx` existe e possui a estrutura para gerar relatórios de desempenho de modelos e tracking, mas não está integrado para coletar dados em tempo real da aplicação `App_FINAL.jsx` de forma automática. O preenchimento dos campos `Bounding Box`, `Quantidade de meshes`, `Quantidade de materiais`, `Quantidade de vértices`, `Quantidade de triângulos` ainda estão como "N/A (a ser implementado)" na sua saída gerada, indicando que a coleta desses dados não está ativa.

---

## 5. FUNCIONALIDADES NÃO INICIADAS

*   **Integração do Sistema de Tracking Profissional:** Embora os módulos `WristTracker.js`, `OneEuroFilter.js` e `RenderPipeline.js` existam em `src/tracking/`, eles não estão sendo utilizados pelo `App_FINAL.jsx`. O `RELATORIO_CAUSA_RAIZ_DEFINITIVA.md` descreve essa como a causa raiz principal da degradação do tracking, com o `App_FINAL.jsx` utilizando um sistema de tracking simplificado e primitivo.
*   **Sistema de Licenciamento:** Não há código ou estrutura aparente para gerenciamento de licenciamento de uso do Ghost Project AI.
*   **White Label:** Não há mecanismos de customização ou branding para permitir que o Ghost Project seja adaptado para diferentes clientes (White Label).
*   **Modo Ambiente (ARCore/ARKit):** Embora exista uma opção de "Câmera Traseira" (`environment`), não há implementação de tracking de ambiente com ARCore ou ARKit para posicionamento de modelos em superfícies reais. O tracking atual é baseado apenas em mão.
*   **Spatial Passport™ Integration:** Mencionado no roadmap do SAAPS, mas sem qualquer código ou estrutura para integração.
*   **Autenticação e Autorização:** Não há sistema de autenticação ou autorização para acesso aos recursos ou funcionalidades do Ghost Project, exceto pelo formulário de lead B2B.
*   **Backend / API:** A aplicação é puramente front-end. Não há um backend dedicado para gerenciamento de produtos, leads, telemetria ou qualquer outra funcionalidade.
*   **Internacionalização (i18n):** A aplicação está em português e não possui infraestrutura para múltiplos idiomas.

---

## 6. COMPONENTES ÓRFÃOS

*   **Componentes `App_*.jsx` Não Utilizados:** Existem 5 versões alternativas do componente principal `App` que não são utilizadas em produção (App.jsx, App_NEW.jsx, App_BRUTO.jsx, App_DIAGNOSTICO.jsx, App_DIAGNOSTICO_VISUAL.jsx), totalizando aproximadamente 3.010 linhas de código morto (conforme `MAPEAMENTO_ARQUITETURA_EXECUTADA.md`).
*   **Módulos de Tracking Não Utilizados:** Os módulos `src/tracking/WristTracker.js`, `src/tracking/RenderPipeline.js` e `src/tracking/OneEuroFilter.js` estão implementados com um sistema de tracking profissional, mas não são importados nem utilizados pelo `App_FINAL.jsx` (conforme `MAPEAMENTO_ARQUITETURA_EXECUTADA.md` e `RELATORIO_CAUSA_RAIZ_DEFINITIVA.md`).
*   **`public/Watch.glb`:** Este arquivo GLB está presente no diretório `public/` mas não é referenciado em nenhum lugar do código-fonte analisado.
*   **`public/models_backup/`:** Este diretório contém backups dos modelos GLB originais e não é utilizado em produção. É um código morto.
*   **SAAPS `Fase 2` e `Fase 3` (Gestos reais e persistência):** São estruturas futuras já iniciadas conceitualmente e com parte do componente `SAAPSHint.jsx` criado, mas sem a lógica de interação ou persistência ativada.

---

## 7. ESTRUTURAS ESTRATÉGICAS

*   **SAAPS (Smart Assisted AR Positioning System):** **ARQUITETURA PREPARADA - NÃO ATIVADO.** O componente `src/components/SAAPSHint.jsx` existe e define gestos para refinamento, mas a lógica para detectar e aplicar esses gestos não está implementada nem ativada em `App_FINAL.jsx`.
*   **Licenciamento:** **NÃO INICIADO.** Não há código, documentação ou estrutura que sugira qualquer implementação de licenciamento.
*   **White Label:** **NÃO INICIADO.** Não há código ou mecanismos para customização de marca ou interface para diferentes clientes.
*   **Modo Ambiente:** **NÃO INICIADO (APENAS SELEÇÃO DE CÂMERA).** A funcionalidade "Câmera Traseira" permite usar a câmera ambiente, mas o tracking de ambiente (para posicionar modelos em superfícies reais do mundo) não está implementado. O tracking se concentra apenas na mão.
*   **Certificado de Compatibilidade Espacial:** **NÃO INICIADO.** Não há código ou estrutura para emissão ou verificação de tal certificado.
*   **Índice de Ajuste Real:** **NÃO INICIADO.** Não há código ou estrutura para cálculo ou exibição de um índice de ajuste para o modelo AR.
*   **Passaporte Espacial:** **NÃO INICIADO.** Mencionado no roadmap do SAAPS, mas sem qualquer implementação concreta.

---

## 8. INTEGRAÇÃO SHOPIFY

A integração Shopify é realizada por meio de um script JavaScript injetado na loja, `public/ghost-sdk.js`, e de um snippet HTML/Liquid `ghost-ar-button-shopify.html`.

*   **O que está funcionando:**
    *   **Injeção do Botão AR:** O script `ghost-sdk.js` injeta um botão "Ver em Realidade Aumentada" na página de produto Shopify, tipicamente próximo ao formulário de "Adicionar ao Carrinho".
    *   **Redirecionamento com Parâmetros:** Ao clicar no botão, o usuário é redirecionado para a URL do Ghost Project AI (`https://ghost-project-ai-bbvc.vercel.app`) com parâmetros de URL contendo `productId`, `productUrl`, `cartUrl` e `embedded=true`.
    *   **Detecção de Store Mode:** O `App_FINAL.jsx` do Ghost Project detecta `embedded=true` e o `productId`, ajustando a experiência para o modo loja, incluindo botões de "Voltar para Loja" e "Adicionar ao Carrinho".
*   **O que já foi implementado:**
    *   Lógica para extrair `productId` do handle da URL da Shopify (em `ghost-sdk.js`).
    *   Mapeamento de handles de produto da Shopify para IDs internos do Ghost Project (`PRODUCT_MAP` em `ghost-sdk.js`).
    *   Injeção de estilos CSS para o badge e botão AR na loja Shopify (em `ghost-sdk.js`).
    *   Obtenção dinâmica de `productUrl` e `cartUrl` da página Shopify para repassar ao Ghost Project.
*   **O que depende apenas de configuração:**
    *   A ativação do botão "Ver em Realidade Aumentada" em uma loja Shopify depende da **instalação manual do `ghost-sdk.js` e do snippet `ghost-ar-button-shopify.html` no tema da loja**. Os metadados de `product.metafields.ghost.product_id` precisam ser configurados para mapear os produtos da loja aos modelos GLB internos do Ghost Project. A `GHOST_BASE_URL` no `ghost-sdk.js` também precisa estar correta (atualmente `https://ghost-project-ai-bbvc.vercel.app`).

---

## 9. BLOQUEIOS REAIS

*   **Degradação do Tracking AR em Produção (`App_FINAL.jsx`):** O `RELATORIO_CAUSA_RAIZ_DEFINITIVA.md` identifica que `App_FINAL.jsx` não utiliza o sistema de tracking profissional (`WristTracker.js`, `OneEuroFilter.js`, `RenderPipeline.js`) presente no projeto, mas inativo. Em vez disso, usa um sistema simplificado com smoothing primitivo, ausência de dead zones e estabilização, e cálculo de posição incorreto, resultando em deriva, jitter e lentidão. **Este é o bloqueio mais crítico para a qualidade da experiência AR.**
*   **Dependência de Modelos Hardcoded/Catálogo Fixo:** O `MAPEAMENTO_ARQUITETURA_EXECUTADA.md` e `AUDITORIA_ARQUITETURA.md` confirmam que o Ghost Project ainda possui referências a modelos 3D hardcoded (`/relogio.glb`) e, embora tenha um catálogo dinâmico (`products.json`), a integração com modelos externos além dos pré-definidos é limitada sem alterar o código.
*   **Duplicação Excessiva de Código:** A existência de 5 arquivos `App_*.jsx` mortos e a duplicação de funções utilitárias (`loadScript`, `loadMediaPipe`, `useModelViewer`, `landmarkToViewport`) tornam a base de código difícil de manter, escalar e introduzem riscos de inconsistências futuras.
*   **Falta de Ferramentas de Auditoria 3D em Tempo Real:** O `src/ReportPanel.jsx` está incompleto e não coleta métricas detalhadas de modelos 3D em tempo real (bounding box, contagem de polígonos, etc.), o que dificulta a identificação e correção de problemas em modelos GLB recém-adicionados.
*   **Ausência de Persistência de Dados (Backend):** A falta de um backend impede a persistência de leads do formulário B2B, rastreamento de uso, telemetria de performance AR ou qualquer outra informação crucial para a evolução do produto.

---

## 10. OPORTUNIDADE DE EXECUÇÃO IMEDIATA

As seguintes tarefas geram valor comercial, já possuem parte do código pronto e não exigem mexer em produtos, tracking ou scanner, focando na arquitetura e otimização:

*   **1. Ativar o Sistema de Tracking Profissional em `App_FINAL.jsx`:** A causa raiz da degradação do tracking foi identificada e a solução (integrar `WristTracker.js`, `OneEuroFilter.js`, `RenderPipeline.js`) já está detalhada em `RELATORIO_CAUSA_RAIZ_DEFINITIVA.md`. Essa tarefa **não exige mexer em produtos, tracking ou scanner** do ponto de vista funcional, mas sim **trocar a implementação interna do tracking** de uma versão simplificada para a profissional. Isso geraria um valor comercial imenso ao resolver o problema de experiência AR mais crítico.
*   **2. Refatorar e Consolidar Código Morto/Duplicado:** Conforme `MAPEAMENTO_ARQUITETURA_EXECUTADA.md`, a remoção de 5 arquivos `App_*.jsx` não utilizados e a refatoração das 4 funções utilitárias duplicadas para arquivos separados (`cdnLoaders.js`, `coordinates.js`) reduziriam a complexidade do projeto, melhorariam a manutenibilidade e preparariam o terreno para futuras funcionalidades. Esta tarefa não altera funcionalidades existentes, apenas otimiza a base de código.
*   **3. Completar Integração do `ReportPanel.jsx` para Auditoria GLB:** Implementar a coleta de dados de `Bounding Box`, `Quantidade de meshes`, `Quantidade de materiais`, `Quantidade de vértices` e `Quantidade de triângulos` em `src/ReportPanel.jsx`. Isso criaria uma ferramenta valiosa para auditar modelos 3D sem impactar o fluxo principal do usuário.
*   **4. Implementar Configuração Externa para `watchSizeMultiplier` e `watchOffsetRatio`:** Os valores de tamanho e offset do relógio ainda são hardcoded em `src/App_FINAL.jsx` e `src/tracking/WristTracker.js`. Implementar a leitura desses parâmetros via URL (similar a `productId`) permitiria ajustar a escala de forma dinâmica para diferentes tipos de modelos (ex: pulseiras, anéis, óculos), sem alterar o código, gerando valor comercial ao expandir a gama de produtos suportados. Isso não exige mexer nos produtos existentes nem no tracking fundamental, apenas nos parâmetros de visualização.

---

## ASSUNTOS CONGELADOS

Conforme instruído, os seguintes assuntos foram ignorados na auditoria e no relatório:

*   Produtos
*   Relógios
*   Tracking (exceto a análise do estado atual da implementação)
*   Posicionamento
*   Refinamentos AR

---

**FIM DO RELATÓRIO EXECUTIVO TÉCNICO**