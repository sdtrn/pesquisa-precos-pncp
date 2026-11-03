# Quantitativo Oficial da ARP e Múltiplos Itens por ARP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir o quantitativo e unidade oficiais cadastrados na ARP no PNCP (ex.: `10 Veículos`, `120 Mês`), permitir que múltiplos itens homologados de uma mesma ARP concorram no ranking dos 20 menores preços, e identificar de forma evidente o número do item/lote e fornecedor no modal, tabela consolidada e relatórios (Excel, PDF, CSV).

**Architecture:** O pipeline de pesquisa (`pipeline.ts`) preserva a quantidade bruta homologada com a respectiva unidade de medida sem que rotinas de normalização a sobrescrevam com "não informado". O descarte artificial de itens da mesma ata é eliminado no pipeline e no seletor Top 20 (`selection.ts`), permitindo que múltiplos itens com preços/fornecedores distintos (ou idênticos) concorram diretamente por preço unitário. A interface (`Top20SelectionModal.tsx` e `ConsolidatedReportPanel.tsx`) e os exportadores (`exporter-xlsx.ts`, `exporter-pdf.ts`, `exporter-csv.ts`) passam a exibir com destaque a identificação de `numero_item_lote` e `fornecedor`.

**Tech Stack:** Next.js 15 (App Router), TypeScript 5.7+, Tailwind CSS, ExcelJS, jsPDF, Lucide React, Node.js test runner nativo com TypeScript (`--experimental-strip-types`).

**Spec:** `docs/superpowers/specs/2026-11-03-quantitativo-e-multiplos-itens-arp-design.md`

## Global Constraints

- Preservar a integridade das regras de escopo R1, R2 e R7 (177 municípios bilionários, regiões do Brasil, PE/Recife).
- Preservar a avaliação de requisitos técnicos de aderência (Classes A, B e C).
- Não introduzir dependências externas adicionais.
- Itens da mesma compra com o mesmo número de item continuam sendo deduplicados para evitar duplicidade de registros idênticos.
- Manter o fuso horário oficial `America/Recife` em todas as formatações temporais.

## Review Focus

1. Se a API do PNCP não informar a quantidade (nulo/vazio), o sistema deve exibir `"não informado"` como fallback seguro.
2. Quando uma mesma ARP tiver dois itens com o mesmo preço unitário e mesmo fornecedor, ambos devem aparecer com seus respectivos números de item/lote diferenciados (ex.: "Item 1" e "Item 2").
3. O cálculo de média e mediana no Top 20 e no relatório consolidado deve calcular sobre a totalidade dos itens marcados pelo usuário, sem descartar silenciosamente itens repetidos de ata.
4. O campo de busca rápida no modal dos 20 menores preços deve permitir filtrar digitando o número do item/lote (ex.: "Item 3" ou "3").
5. As exportações em Excel, PDF e CSV não podem quebrar o alinhamento de colunas com a presença do campo de item/lote.

---

### Task 1: Preservação do Quantitativo Oficial da ARP no Pipeline

**Files:**
- Modify: `src/lib/domain/pipeline.ts:1200-1270`
- Modify: `tests/domain/pipeline-normalizacao.test.ts:220-230`

**Interfaces:**
- Consumes: `melhorRes.quantidadeHomologada`, `qtdItemCompra`, `formatarQuantitativoArp(qtdBruta, unMedidaItem)`
- Produces: `ItemCandidato.quantitativo_previsto_arp` preservando a string formatada oficial (ex.: `"10 Veículo"`, `"120 Mês"`) em vez de sobrescrever com `"não informado"`.

- [ ] **Step 1: Atualizar teste de normalização para verificar a preservação do quantitativo da ata**
  Em `tests/domain/pipeline-normalizacao.test.ts`, atualizar a asserção do item sem quantitativo textual para verificar que ele preserva o quantitativo do item da compra (`"1 Unidade"`) em vez de forçar `"não informado"`.

- [ ] **Step 2: Executar o teste e observar a falha**
  Run: `node --experimental-strip-types --test tests/domain/pipeline-normalizacao.test.ts`
  Expected: FAIL na asserção de `quantitativo_previsto_arp`.

- [ ] **Step 3: Ajustar o pipeline em `src/lib/domain/pipeline.ts`**
  Remover o bloco que fazia `if (resNorm.quantitativoStatus === "não informado") { quantitativoPrevistoArpFinal = "não informado"; }`. Manter `quantitativoPrevistoArpFinal = quantitativoArpStr`.

- [ ] **Step 4: Executar o teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/domain/pipeline-normalizacao.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/domain/pipeline.ts tests/domain/pipeline-normalizacao.test.ts
  git commit -m "fix(pipeline): preservar quantitativo oficial da ARP no pipeline de precos"
  ```

---

### Task 2: Habilitação de Múltiplos Itens por ARP no Ranking e Seleção Top 20

**Files:**
- Modify: `src/lib/domain/pipeline.ts:1370-1425`
- Modify: `src/lib/domain/selection.ts:1-45`
- Create: `tests/domain/pipeline-multiplos-itens.test.ts`

**Interfaces:**
- Consumes: `itensValidosDestaAta`, `ItemCandidato`
- Produces:
  - `itensCandidatosAprovados`: inclui todos os itens válidos da ata (sem descartar `slice(1)`).
  - `selecionarTop20Menores(itens, incluirRevisaoB, limite, criterio)`: seleciona os 20 menores preços de forma aberta, sem restringir a 1 item por chave de ata.

- [ ] **Step 1: Escrever teste unitário para seleção de múltiplos itens da mesma ARP**
  Criar `tests/domain/pipeline-multiplos-itens.test.ts` criando itens com a mesma ata (`CNPJ 123`, `ARP 10/2025`) mas números de itens distintos (`Item 1` a R$ 2.000 e `Item 2` a R$ 2.100), verificando que `selecionarTop20Menores` retorna ambos os itens nos 20 primeiros.

- [ ] **Step 2: Executar o teste e verificar a falha esperada**
  Run: `node --experimental-strip-types --test tests/domain/pipeline-multiplos-itens.test.ts`
  Expected: FAIL porque a implementação atual descarta o segundo item da mesma ata.

- [ ] **Step 3: Implementar a permissão de múltiplos itens em `pipeline.ts` e `selection.ts`**
  - Em `src/lib/domain/pipeline.ts`:
    - Adicionar todos os itens de `itensA` e `itensB` a `itensCandidatosAprovados` (remover os descartes `itensA.slice(1)` e `itensB.slice(1)` com o motivo de Regra R6).
  - Em `src/lib/domain/selection.ts`:
    - Remover o filtro `melhorPorAta.has(chaveAta)`.
    - Ordenar todos os itens filtrados por preço (ou desconto) e retornar `slice(0, limite)`.

- [ ] **Step 4: Executar o teste e confirmar aprovação**
  Run: `node --experimental-strip-types --test tests/domain/pipeline-multiplos-itens.test.ts`
  Expected: PASS.

- [ ] **Step 5: Executar testes de pipeline existentes para verificar eventuais ajustes**
  Run: `node --experimental-strip-types --test tests/domain/pipeline-and-stats.test.ts`
  Expected: Atualizar asserções de testes legados que esperavam descarte de múltiplos itens por ata.

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/domain/pipeline.ts src/lib/domain/selection.ts tests/domain/pipeline-multiplos-itens.test.ts tests/domain/pipeline-and-stats.test.ts
  git commit -m "feat(selection): permitir multiplos itens da mesma ARP no ranking Top 20"
  ```

---

### Task 3: Identificação de Item/Lote e Quantitativo no Modal dos 20 Menores Preços

**Files:**
- Modify: `src/components/Top20SelectionModal.tsx:160-460`
- Test: `tests/domain/ui-normalizacao.test.ts`

**Interfaces:**
- Consumes: `item.numero_item_lote`, `item.quantitativo_previsto_arp`, `item.fornecedor`, `item.numero_arp_licitacao`
- Produces:
  - Cabeçalho com badge `"Classificação por Item Homologado"`.
  - Coluna ou indicador proeminente de `Item / Lote` na tabela.
  - Busca rápida (`buscaTexto`) filtrando também por `item.numero_item_lote`.

- [ ] **Step 1: Identificar e atualizar testes de UI se houverem asserções de texto**
  Verificar `tests/domain/ui-normalizacao.test.ts` para garantir compatibilidade com os novos textos e colunas.

- [ ] **Step 2: Atualizar `Top20SelectionModal.tsx`**
  - Alterar o badge no cabeçalho de `"Máx. 1 item por ARP"` para `"Classificação por Item Homologado"`.
  - Adicionar a coluna `Item / Lote` na tabela (ou destacar `Item {item.numero_item_lote}` na coluna de ARP/Vigência e Descrição).
  - Incluir `item.numero_item_lote.toLowerCase().includes(q)` no filtro `candidatosFiltrados`.
  - Garantir que `item.quantitativo_previsto_arp` renderize o quantitativo oficial da ata formatado.

- [ ] **Step 3: Testar compilação e tipagem TypeScript**
  Run: `npx tsc --noEmit`
  Expected: PASS sem erros de tipagem.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/Top20SelectionModal.tsx
  git commit -m "feat(ui): adicionar coluna de item/lote e atualizar cabecalho no modal Top 20"
  ```

---

### Task 4: Identificação de Item/Lote e Fornecedor na Tabela Consolidada e nos Exportadores

**Files:**
- Modify: `src/components/ConsolidatedReportPanel.tsx`
- Modify: `src/lib/export/exporter-xlsx.ts`
- Modify: `src/lib/export/exporter-pdf.ts`
- Modify: `src/lib/export/exporter-csv.ts`
- Create: `tests/export/exporters-multiplos-itens.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato.numero_item_lote`, `ItemCandidato.quantitativo_previsto_arp`, `ItemCandidato.fornecedor`
- Produces:
  - Tabela consolidada com `Item / Lote` em destaque.
  - Planilha Excel com coluna `Nº do Item/Lote` preenchida e formatada nas abas `Planilha_Parecer` e `Memoria_de_Pesquisa`.
  - Relatório PDF com indicação clara do `Item` em cada linha da tabela.
  - Arquivo CSV com coluna `Nº do Item/Lote`.

- [ ] **Step 1: Escrever teste para os exportadores com múltiplos itens da mesma ata**
  Criar `tests/export/exporters-multiplos-itens.test.ts` gerando Excel, CSV e PDF com 2 itens da mesma ARP e verificando a presença de `numero_item_lote` e `quantitativo_previsto_arp`.

- [ ] **Step 2: Executar o teste e verificar resultados**
  Run: `node --experimental-strip-types --test tests/export/exporters-multiplos-itens.test.ts`
  Expected: Validar saídas dos exportadores.

- [ ] **Step 3: Atualizar `ConsolidatedReportPanel.tsx`, `exporter-xlsx.ts`, `exporter-pdf.ts` e `exporter-csv.ts`**
  - Em `ConsolidatedReportPanel.tsx`: garantir que a coluna `Item / Lote` esteja bem visível e identificada.
  - Em `exporter-xlsx.ts`: confirmar que a coluna `Nº do Item/Lote` e `Quantitativo previsto na ARP` recebam os valores formatados.
  - Em `exporter-pdf.ts`: incluir a identificação do item/lote no cabeçalho ou célula da tabela.
  - Em `exporter-csv.ts`: garantir a inclusão da coluna no cabeçalho e linhas.

- [ ] **Step 4: Executar os testes de exportação**
  Run: `node --experimental-strip-types --test tests/export/exporters-multiplos-itens.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ConsolidatedReportPanel.tsx src/lib/export/exporter-xlsx.ts src/lib/export/exporter-pdf.ts src/lib/export/exporter-csv.ts tests/export/exporters-multiplos-itens.test.ts
  git commit -m "feat(export): evidenciar numero do item/lote na tabela consolidada e exportadores"
  ```

---

### Task 5: Validação da Suíte Completa de Testes e Documentação

**Files:**
- Modify: `README.md`
- Test: Todos os testes em `tests/`

- [ ] **Step 1: Atualizar a descrição da Regra R6 no `README.md`**
  Atualizar a seção da Regra R6 no `README.md` para clarificar que a deduplicação auditável ocorre no nível de item homologado, admitindo múltiplos itens distintos de uma mesma ARP no ranking dos 20 menores preços.

- [ ] **Step 2: Executar a suíte de testes completa do projeto**
  Run: `npm test`
  Expected: Todos os testes passando sem erros nem regressões.

- [ ] **Step 3: Executar build de produção do Next.js**
  Run: `npm run build`
  Expected: Build concluído com sucesso sem erros de tipagem ou de página.

- [ ] **Step 4: Commit**
  ```bash
  git add README.md
  git commit -m "docs: atualizar documentacao da regra R6 e validar build de producao"
  ```
