# Critério de Maior Taxa de Desconto e Correção de Links Diretos de ARPs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o critério de classificação por "Maior Taxa de Desconto (%)" para pesquisas de gerenciamento de frota e combustível com preset rápido e corrigir os links diretos de acesso às ARPs no portal PNCP e documentos.

**Architecture:** O critério de classificação (`menor_preco` vs `maior_desconto`) é propagado da UI para a pipeline de pesquisa, invertendo a ordenação da deduplicação (R6) e seleção Top 20 para priorizar maiores descontos, adaptando cálculos estatísticos, formatação visual (%) e exportadores (XLSX, PDF, CSV). Paralelamente, o extrator de chaves da ata passa a ler o `numero_controle_pncp` via regex oficial para garantir URLs diretas e válidas (`https://pncp.gov.br/app/atas/...`) em todas as ARPs.

**Tech Stack:** Next.js 15 (App Router), TypeScript 5.7+, Tailwind CSS, ExcelJS, jsPDF, Lucide React, Node.js test runner nativo com suporte a TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-01-criterio-desconto-e-links-arp-design.md`

## Global Constraints

- Manter retrocompatibilidade total: buscas sem critério explícito devem operar em `menor_preco` (R$) sem qualquer quebra.
- Preservar regras de escopo institucional R1, R2 e R7 (177 municípios bilionários, regiões do Brasil, PE/Recife).
- Não utilizar bibliotecas externas adicionais para formatação ou rotas.
- Todas as datas continuam normalizadas no fuso oficial `America/Recife`.

## Review Focus

1. ARPs com taxa de desconto igual a 0,00% ou muito próxima de zero (ex.: 0,05%) não podem ser descartadas como preço inválido.
2. Extração de chaves da ata quando `item_url` vier nulo ou truncado deve se recuperar via `numero_controle_pncp` sem cair na URL genérica.
3. Planilha Excel gerada no modo desconto deve conter a fórmula `=AVERAGE(...)` calculando a média das taxas de desconto com estilo percentual (`0.00%`).
4. Troca entre presets comuns (ex.: "Lona") e o novo preset de combustível deve alternar dinamicamente o critério entre `menor_preco` e `maior_desconto`.
5. Cliques nos links de ARP dentro de modais e tabelas não podem propagar o evento de seleção de linha (`stopPropagation`).

---

### Task 1: Tipos e Constantes: Adicionar `CriterioClassificacao` e Preset de Combustível

**Files:**
- Modify: `src/lib/domain/types.ts:1-164`
- Modify: `src/data/constants.ts:117-158`
- Test: `tests/domain/types-and-constants.test.ts`

**Interfaces:**
- Consumes: Tipos de pipeline existentes.
- Produces:
  - `export type CriterioClassificacao = "menor_preco" | "maior_desconto";`
  - `CRITERIO_MENOR_PRECO = "menor_preco";`
  - `CRITERIO_MAIOR_DESCONTO = "maior_desconto";`
  - `PresetExemplo.criterioSugerido?: CriterioClassificacao;`
  - `PRESETS_EXEMPLOS` contendo o preset com id `"gestao-frota-combustivel"`.

- [ ] **Step 1: Escrever teste validando os tipos, constantes e presença do novo preset**
  Criar `tests/domain/types-and-constants.test.ts` verificando a presença de `CRITERIO_MENOR_PRECO`, `CRITERIO_MAIOR_DESCONTO` e conferindo que o preset `"gestao-frota-combustivel"` possui `criterioSugerido === "maior_desconto"`.

- [ ] **Step 2: Executar o teste e confirmar falha esperada**
  Run: `node --experimental-strip-types --test tests/domain/types-and-constants.test.ts`
  Expected: FAIL indicando exportações ausentes.

- [ ] **Step 3: Implementar `CriterioClassificacao` em `src/lib/domain/types.ts` e constantes/presets em `src/data/constants.ts`**
  - Adicionar `CriterioClassificacao` em `types.ts` e incluir `criterioClassificacao?: CriterioClassificacao` em `ParametrosPipeline`, `ResultadoPesquisa` e `RegistroHistoricoPesquisa`.
  - Exportar constantes e cadastrar o preset no `PRESETS_EXEMPLOS` em `constants.ts`.

- [ ] **Step 4: Executar o teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/domain/types-and-constants.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/domain/types.ts src/data/constants.ts tests/domain/types-and-constants.test.ts
  git commit -m "feat: adicionar tipo CriterioClassificacao e preset de frota e combustivel"
  ```

---

### Task 2: Extração Blindada de Chaves PNCP e Correção de Links da Ata

**Files:**
- Modify: `src/lib/domain/pncp-client.ts:550-585, 800-830`
- Modify: `src/lib/domain/pipeline.ts:310-330`
- Test: `tests/domain/pncp-links.test.ts`

**Interfaces:**
- Consumes: `PNCPClient.extrairChavesItemUrl`, `PNCPClient.montarLinkAtaPncp`.
- Produces:
  - `extrairChavesItemUrl` com suporte a regex no `numero_controle_pncp` (`^(\d{14})-\d+-(\d+)\/(\d{4})-(\d+)$`).
  - `pipeline.ts` gerando `linkPncp` completo mesmo no bloco fallback.
  - Correção de caminhos inexistentes `/pncp-api/v1/` para `/api/pncp/v1/`.

- [ ] **Step 1: Escrever teste de unidade para extração de chaves e montagem de links**
  Criar `tests/domain/pncp-links.test.ts` testando:
  1. Extração a partir de `numero_controle_pncp: "45132495000140-1-000872/2024-000001"` -> `["45132495000140", "2024", "872", "1"]`.
  2. Extração com `item_url: "/atas/45132495000140/2024/872/1"`.
  3. Formatação da URL oficial: `https://pncp.gov.br/app/atas/45132495000140/2024/872/1`.

- [ ] **Step 2: Executar o teste e confirmar falha**
  Run: `node --experimental-strip-types --test tests/domain/pncp-links.test.ts`
  Expected: FAIL ou extração incompleta.

- [ ] **Step 3: Implementar a extração robusta e montagem de link**
  - Atualizar `PNCPClient.extrairChavesItemUrl` para testar primeiramente o regex sobre `numero_controle_pncp`, depois `item_url` e depois campos individuais.
  - No `pipeline.ts`, garantir que `linkPncp = PNCPClient.montarLinkAtaPncp(cnpj, anoC, seqCompra, seqAta)` seja chamado sempre que as chaves estiverem presentes, evitando a URL genérica `/app/atas`.
  - Corrigir `/pncp-api/v1/` para `https://pncp.gov.br/api/pncp/v1/`.

- [ ] **Step 4: Executar o teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/domain/pncp-links.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/domain/pncp-client.ts src/lib/domain/pipeline.ts tests/domain/pncp-links.test.ts
  git commit -m "fix: extracao robusta de chaves pncp e correcao de links de atas"
  ```

---

### Task 3: Pipeline e Estatísticas: Inversão de Ordenação por Maior Desconto

**Files:**
- Modify: `src/lib/domain/pipeline.ts:1145-1165, 1245-1275, 1325-1356`
- Modify: `src/lib/domain/statistics.ts:20-77, 85-103`
- Test: `tests/domain/desconto-pipeline.test.ts`

**Interfaces:**
- Consumes: `criterioClassificacao?: CriterioClassificacao`.
- Produces:
  - `selecionarTop20Menores(itens, incluirRevisaoB, limite, criterioClassificacao)`: quando `"maior_desconto"`, ordena decrescente (`b.valor_unitario - a.valor_unitario`).
  - Deduplicação R6 interna por ata respeitando o critério de maior desconto.
  - `calcularEstatisticasPrecos(valores, criterio)`: aceita valores `>= 0` para desconto e calcula dispersão sem filtrar taxas baixas.
  - `formatValorOuTaxa(valor, criterio)`: retorna `X,XX%` ou `R$ X,XX`.

- [ ] **Step 1: Escrever teste de unidade para seleção e estatísticas com maior desconto**
  Criar `tests/domain/desconto-pipeline.test.ts` testando:
  1. `selecionarTop20Menores` com `criterio = "maior_desconto"` retorna itens em ordem decrescente (ex.: `[8.5, 5.0, 3.2]`).
  2. Deduplicação R6 dentro da mesma ata escolhe o item com maior desconto.
  3. Estatísticas incluem itens com taxa `0%` ou baixa sem descartar indevidamente.

- [ ] **Step 2: Executar o teste e confirmar falha**
  Run: `node --experimental-strip-types --test tests/domain/desconto-pipeline.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar a lógica condicional por critério**
  - Em `pipeline.ts`, ajustar a ordenação R6 e atualizar a assinatura de `selecionarTop20Menores` para aceitar `criterioClassificacao`.
  - Em `statistics.ts`, atualizar `calcularEstatisticasPrecos` e `identificarOutliersIqr` para considerar taxas de desconto e exportar `formatValorOuTaxa`.

- [ ] **Step 4: Executar o teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/domain/desconto-pipeline.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/domain/pipeline.ts src/lib/domain/statistics.ts tests/domain/desconto-pipeline.test.ts
  git commit -m "feat: ordenacao decrescente e estatisticas para maior taxa de desconto"
  ```

---

### Task 4: Interface do Usuário: Seletor no Formulário e Ajuste nos Modais/Dashboards

**Files:**
- Modify: `src/components/SearchParametersForm.tsx:1-250`
- Modify: `src/components/Top20SelectionModal.tsx:1-450`
- Modify: `src/components/AuditAnalyticsDashboard.tsx:550-650`
- Modify: `src/app/page.tsx:1-350`

**Interfaces:**
- Consumes: `criterioClassificacao`, `onChangeCriterioClassificacao`, `CRITERIO_MENOR_PRECO`, `CRITERIO_MAIOR_DESCONTO`.
- Produces:
  - Botões seletores de "Critério de Classificação" no formulário com ícones e descrições claras.
  - Disparo automático do critério ao selecionar o preset de frota/combustível.
  - Títulos e formatações no modal Top 20 e no Dashboard de auditoria adaptados para "Taxa de Desconto (%)" e `X,XX%`.
  - Ícone de link na tabela com `stopPropagation` e link oficial funcional.

- [ ] **Step 1: Atualizar o formulário `SearchParametersForm.tsx` com o controle de critério**
  Adicionar a propriedade `criterioClassificacao` e callback no `SearchParametersFormProps`, renderizando os botões:
  - "Menor Preço Unitário (R$)"
  - "Maior Taxa de Desconto (%)"
  Integrar com a seleção de presets: quando o preset possuir `criterioSugerido`, acionar o callback.

- [ ] **Step 2: Atualizar `src/app/page.tsx` para gerenciar o estado `criterioClassificacao`**
  - Armazenar `criterioClassificacao` no estado da página (default: `"menor_preco"`).
  - Enviar `criterioClassificacao` no payload de `/api/pesquisar`.
  - Propagar para os modais e painéis de resultado.

- [ ] **Step 3: Ajustar `Top20SelectionModal.tsx` e `AuditAnalyticsDashboard.tsx`**
  - Substituir rótulo da coluna: de "Preço Unit." para "Desconto (%)" quando `criterio === "maior_desconto"`.
  - Formatar valores com `formatValorOuTaxa`.
  - Assegurar que o link externo para a ata use `target="_blank"` e `stopPropagation()`.

- [ ] **Step 4: Executar testes de tipos e compilação TS**
  Run: `node --experimental-strip-types tests/domain/types-and-constants.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/SearchParametersForm.tsx src/components/Top20SelectionModal.tsx src/components/AuditAnalyticsDashboard.tsx src/app/page.tsx
  git commit -m "feat: seletor de criterio na ui e adaptacao visual para taxa de desconto"
  ```

---

### Task 5: Painel Consolidado e Exportações (Excel, PDF, CSV)

**Files:**
- Modify: `src/components/ConsolidatedReportPanel.tsx:1-497`
- Modify: `src/lib/export/exporter-xlsx.ts:1-650`
- Modify: `src/lib/export/exporter-pdf.ts:1-350`
- Modify: `src/lib/export/exporter-csv.ts:1-120`
- Test: `tests/export/exporters-desconto.test.ts`

**Interfaces:**
- Consumes: `criterioClassificacao?: CriterioClassificacao` nas funções de exportação e no painel consolidado.
- Produces:
  - `ConsolidatedReportPanel`: coluna "Taxa de Desconto (%)", média formatada em `%`, links diretos ativos e sem ambiguidade entre "Página PNCP" e "PDF".
  - `gerarPlanilhaXlsx`: coluna "Taxa de Desconto (%)" com estilo `0.00%` e linha final "MÉDIA DAS TAXAS DE DESCONTO" com `=AVERAGE(...)`.
  - `gerarRelatorioPdfA4`: cabeçalho "Taxa de Desconto (%)" e sumário adaptado.
  - `gerarCsvConsolidado`: coluna de desconto.

- [ ] **Step 1: Escrever teste de exportação para modo desconto**
  Criar `tests/export/exporters-desconto.test.ts` validando que a geração de XLSX, CSV e PDF aceita o critério e aplica os cabeçalhos correspondentes.

- [ ] **Step 2: Executar teste e verificar falha**
  Run: `node --experimental-strip-types --test tests/export/exporters-desconto.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implementar adaptação nos exportadores e no `ConsolidatedReportPanel`**
  - Em `exporter-xlsx.ts`, adicionar suporte ao `criterioClassificacao`: cabeçalho "Taxa de Desconto (%)", formatação percentual e fórmula da média.
  - Em `exporter-pdf.ts`, formatar as células com `%` e ajustar os textos de cabeçalho.
  - Em `exporter-csv.ts`, ajustar o nome da coluna.
  - Em `ConsolidatedReportPanel.tsx`, atualizar a tabela do parecer, a linha de média, a coluna de link ("Acessar Ata no PNCP") e os cards de evidências.

- [ ] **Step 4: Executar teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/export/exporters-desconto.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ConsolidatedReportPanel.tsx src/lib/export/exporter-xlsx.ts src/lib/export/exporter-pdf.ts src/lib/export/exporter-csv.ts tests/export/exporters-desconto.test.ts
  git commit -m "feat: exportadores xlsx pdf csv e painel consolidado com suporte a taxa de desconto"
  ```

---

### Task 6: Verificação End-to-End e Testes de Regressão

**Files:**
- Test: `tests/domain/pipeline-and-stats.test.ts`
- Test: `tests/domain/all-regression.test.ts`

- [ ] **Step 1: Atualizar testes existentes para garantir 100% de compatibilidade**
  Executar todos os testes de domínio garantindo que o comportamento padrão de compras em `R$` continue intacto e que o novo comportamento de desconto passe em todos os cenários.

- [ ] **Step 2: Executar suite completa de testes**
  Run: `node --experimental-strip-types --test tests/domain/*.test.ts tests/export/*.test.ts`
  Expected: Todos os testes passando sem erros.

- [ ] **Step 3: Commit final**
  ```bash
  git add tests/
  git commit -m "test: verificacao completa do criterio de desconto e links de atas"
  ```
