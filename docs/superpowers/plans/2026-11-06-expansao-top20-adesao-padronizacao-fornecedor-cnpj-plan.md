# Expansão no Top 20, Possibilidade de Adesão, Padronização Condicional e CNPJ do Fornecedor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar expansão e retração individual concomitante de itens no Top 20 com visualização completa de detalhes, coluna oficial de Possibilidade de Adesão (Sim/Não) no PNCP e no PDF, inclusão estritamente condicional das colunas de padronização no Excel (removendo Unidade Original ARP) e exibição do CNPJ/CPF do fornecedor junto ao nome em todas as telas e relatórios.

**Architecture:** Mapeamento no pipeline dos atributos `permite_adesao`/`possibilidadeAdesao`, `especificacao_complementar` e `data_inicio_vigencia` do PNCP com formatação pontuada de CNPJ/CPF do fornecedor. No modal de seleção, estado em `Set<string>` para controle de acordeão multi-item independente com sub-linha responsiva e coluna de adesão. Nos exportadores Excel e PDF, dinamização das colunas baseada em `temPadronizacao` e incorporação da coluna de Adesão mantendo perfeita diagramação A4 e fórmulas íntegras.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS, Lucide React, ExcelJS, jsPDF, jsPDF-AutoTable, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-expansao-top20-adesao-padronizacao-fornecedor-cnpj-design.md`

## Global Constraints

- Manter retrocompatibilidade total com pesquisas salvas e histórico no IndexedDB.
- Não efetuar requisições extras de rede desnecessárias; `possibilidade_adesao` deve ser extraída dos dados já retornados da busca do PNCP (`permite_adesao`) ou detalhes em cache (`detAta.possibilidadeAdesao`), adotando `"Não informado"` se ambos forem ausentes.
- No Excel quando `temPadronizacao` for true, manter: `Valor Unitário Normalizado`, `Memória de Cálculo (Lei 14.133/2021)` e `Valor Homologado Original (R$)`, e remover `Unidade Original ARP`.
- No Excel quando `temPadronizacao` for false, omitir as 3 colunas de padronização, mantendo apenas `Valor Unitário (R$)` padrão. Fórmulas de resumo estatístico devem apontar para a coluna correta de valor unitário dinamicamente.
- No PDF, a nova coluna "Adesão" deve ser inserida na Tabela Consolidada com ajuste de larguras para não estourar a margem do documento A4 retrato.
- Máscara pontuada do fornecedor na mesma célula: `RAZÃO SOCIAL (CNPJ: XX.XXX.XXX/XXXX-XX)` ou `RAZÃO SOCIAL (CPF: XXX.XXX.XXX-XX)`.
- Todos os testes da suíte (`npm test`) e compilação (`npm run build`) devem passar com zero erros.

## Review Focus

- Atas com `permite_adesao === false`: deve renderizar `"Não"` com badge discreto/cinza e constar como `"Não"` no PDF e Excel.
- Atas com `permite_adesao === true`: deve renderizar `"Sim"` com badge esmeralda/verde e constar como `"Sim"` no PDF e Excel.
- Pesquisas sem nenhum item padronizado selecionado: o Excel gerado não deve conter as colunas "Memória de Cálculo (Lei 14.133/2021)" nem "Valor Homologado Original (R$)", e a fórmula de média (`=AVERAGE(B2:Bn)`) deve continuar perfeitamente calculada.
- Pesquisas com itens padronizados selecionados: o Excel gerado deve conter as 3 colunas acordadas, sem a coluna "Unidade Original ARP", e a fórmula de média deve apontar para a coluna de valor unitário normalizado.
- Fornecedores com CPF de 11 dígitos: máscara deve rotular como `(CPF: 000.000.000-00)` e não como CNPJ.

---

### Task 1: Extensão dos Tipos e Utilitário de Formatação de Documento (CNPJ/CPF)

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/domain/normalizador-precos.ts` (ou criar `src/lib/domain/formatters.ts`)
- Test: `tests/domain/formatters-and-types.test.ts`

**Interfaces:**
- Produces:
  - `ItemCandidato.possibilidade_adesao?: "Sim" | "Não" | "Não informado"`
  - `ItemCandidato.especificacao_complementar?: string`
  - `ItemCandidato.data_inicio_vigencia?: string`
  - `ItemCandidato.fornecedor_cnpj?: string`
  - `formatarDocumentoIdentificacao(ni: string): { numeroFormatado: string; tipo: "CNPJ" | "CPF" | "NI"; rotulo: string }`
  - `formatarFornecedorComDocumento(nome: string, ni: string): string`

- [ ] **Step 1: Escrever teste falhando para formatação de documento e tipos**
  Criar `tests/domain/formatters-and-types.test.ts` testando:
  - Formatação de CNPJ com 14 dígitos: `12039966000111` -> `12.039.966/0001-11`, rótulo `CNPJ` e string combinada `FORNECEDOR LTDA (CNPJ: 12.039.966/0001-11)`.
  - Formatação de CPF com 11 dígitos: `12345678901` -> `123.456.789-01`, rótulo `CPF` e string combinada `JOAO DA SILVA (CPF: 123.456.789-01)`.
  - Número já formatado ou vazio: preserva sem quebrar.

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/domain/formatters-and-types.test.ts`
  Resultado esperado: FAIL (funções não encontradas).

- [ ] **Step 3: Implementar utilitários e atualizar `types.ts`**
  - Em `src/lib/domain/types.ts`, adicionar os campos opcionais em `ItemCandidato`:
    `possibilidade_adesao?: "Sim" | "Não" | "Não informado";`
    `especificacao_complementar?: string;`
    `data_inicio_vigencia?: string;`
    `fornecedor_cnpj?: string;`
  - Criar função utilitária `formatarDocumentoIdentificacao` e `formatarFornecedorComDocumento` (em `src/lib/domain/normalizador-precos.ts` ou módulo compartilhado).

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/domain/formatters-and-types.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/lib/domain/types.ts src/lib/domain/normalizador-precos.ts tests/domain/formatters-and-types.test.ts`
  `git commit -m "feat: adicionar tipos de adesao/detalhes e utilitarios de formatacao CNPJ/CPF"`

---

### Task 2: Captura de "Possibilidade de Adesão" e Formatação do Fornecedor no Pipeline

**Files:**
- Modify: `src/lib/domain/pipeline.ts`
- Test: `tests/domain/pipeline-adesao-fornecedor.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato`, `formatarFornecedorComDocumento`
- Produces: `ItemCandidato` com `possibilidade_adesao`, `especificacao_complementar`, `data_inicio_vigencia` e `fornecedor` formatado com CNPJ/CPF.

- [ ] **Step 1: Escrever teste falhando para enriquecimento no pipeline**
  Criar `tests/domain/pipeline-adesao-fornecedor.test.ts` testando:
  - Ata com `permite_adesao: true` gera `possibilidade_adesao: "Sim"`.
  - Ata com `permite_adesao: false` gera `possibilidade_adesao: "Não"`.
  - Ata sem campo de adesão e sem `detAta` gera `possibilidade_adesao: "Não informado"`.
  - Fornecedor com `niFornecedor` de 14 dígitos é salvo como `NOME (CNPJ: XX.XXX.XXX/XXXX-XX)`.
  - Campos `especificacao_complementar` e `data_inicio_vigencia` são populados a partir dos dados do PNCP.

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/domain/pipeline-adesao-fornecedor.test.ts`
  Resultado esperado: FAIL.

- [ ] **Step 3: Implementar extração de adesão e formatação em `pipeline.ts`**
  - Em `pipeline.ts`:
    - Extrair `possibilidadeAdesao` de `detAta?.possibilidadeAdesao` ou `ataS?.permite_adesao`.
    - Formatar `fornecedorFmt` usando `formatarFornecedorComDocumento(fornecedorNome, fornecedorNi)`.
    - Mapear `especificacao_complementar: infCompItem || undefined` e `data_inicio_vigencia: formatarDataBr(dtIniVigFinal) || undefined`.
    - Atribuir `possibilidade_adesao` no objeto do `ItemCandidato`.

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/domain/pipeline-adesao-fornecedor.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/lib/domain/pipeline.ts tests/domain/pipeline-adesao-fornecedor.test.ts`
  `git commit -m "feat: extrair possibilidade de adesao e formatar fornecedor com CNPJ no pipeline"`

---

### Task 3: Exportador Excel Condicional (Aba 1) e Possibilidade de Adesão

**Files:**
- Modify: `src/lib/export/exporter-xlsx.ts`
- Test: `tests/export/exporter-xlsx-condicional.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato.possibilidade_adesao`, `ItemCandidato.normalizado`, `ItemCandidato.formula_normalizacao`
- Produces: Planilha Excel (.xlsx) com colunas de padronização estritamente condicionais e coluna de Adesão.

- [ ] **Step 1: Escrever teste falhando para geração condicional de colunas no Excel**
  Criar `tests/export/exporter-xlsx-condicional.test.ts` testando:
  - Cesta sem itens padronizados: Aba 1 NÃO possui as colunas "Memória de Cálculo (Lei 14.133/2021)", "Valor Homologado Original (R$)" nem "Unidade Original ARP". Possui coluna "Possibilidade de Adesão". A fórmula da MÉDIA referencia a coluna B.
  - Cesta com itens padronizados: Aba 1 POSSUI "Valor Unitário Normalizado", "Memória de Cálculo (Lei 14.133/2021)", "Valor Homologado Original (R$)" e "Possibilidade de Adesão", e NÃO possui "Unidade Original ARP". A fórmula da MÉDIA referencia a coluna de valor unitário normalizado.
  - Coluna de fornecedor contém o CNPJ/CPF formatado.

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/export/exporter-xlsx-condicional.test.ts`
  Resultado esperado: FAIL.

- [ ] **Step 3: Implementar lógica condicional e coluna de Adesão em `exporter-xlsx.ts`**
  - Calcular `const temPadronizacao = itensSelecionados.some(i => i.normalizado || Boolean(i.formula_normalizacao));`
  - Se `ehDesconto`:
    - Headers: `["Descrição do objeto", "Taxa de Desconto (%)", "Nº da ARP / Licitação", "Possibilidade de Adesão", "Data de Assinatura", "Órgão Gerenciador/UF", "Fornecedor"]`
  - Se `!ehDesconto && temPadronizacao`:
    - Headers: `["Descrição do objeto", headerPrecoAba1, "Memória de Cálculo (Lei 14.133/2021)", "Valor Homologado Original (R$)", "Nº da ARP / Licitação", "Possibilidade de Adesão", "Data de Assinatura", "Órgão Gerenciador/UF", "Fornecedor"]`
  - Se `!ehDesconto && !temPadronizacao`:
    - Headers: `["Descrição do objeto", "Valor Unitário (R$)", "Nº da ARP / Licitação", "Possibilidade de Adesão", "Data de Assinatura", "Órgão Gerenciador/UF", "Fornecedor"]`
  - Adaptar dinamicamente as larguras de coluna e as fórmulas estatísticas (AVERAGE, MEDIAN, MIN, MAX) para usar a letra da coluna correspondente (Coluna B).
  - Preencher a célula de Adesão com `item.possibilidade_adesao || "Não informado"`.

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/export/exporter-xlsx-condicional.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/lib/export/exporter-xlsx.ts tests/export/exporter-xlsx-condicional.test.ts`
  `git commit -m "feat: condicionalidade de padronizacao e possibilidade de adesao no exportador excel"`

---

### Task 4: Exportador PDF com Coluna "Possibilidade de Adesão" e Fornecedor com CNPJ

**Files:**
- Modify: `src/lib/export/exporter-pdf.ts`
- Test: `tests/export/exporter-pdf-adesao.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato.possibilidade_adesao`, `ItemCandidato.fornecedor`
- Produces: Relatório em PDF (.pdf) com coluna "Adesão" na Tabela 3 e fornecedor formatado com CNPJ.

- [ ] **Step 1: Escrever teste falhando para inclusão da coluna de Adesão no PDF**
  Criar `tests/export/exporter-pdf-adesao.test.ts` testando:
  - Cabeçalho da Tabela 3 contém "Adesão" (ou "Possib. Adesão").
  - Linhas de dados contêm "Sim" ou "Não" correspondente ao item.
  - Larguras de coluna somam a largura útil da página A4 retrato (186mm).

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/export/exporter-pdf-adesao.test.ts`
  Resultado esperado: FAIL.

- [ ] **Step 3: Implementar coluna no `exporter-pdf.ts`**
  - Na Tabela 3 de `exporter-pdf.ts`:
    - Adicionar coluna "Adesão" no cabeçalho.
    - No mapeamento das linhas de `bodyConsolidado`, inserir `it.possibilidade_adesao || "Não informado"`.
    - Na linha de Média final, inserir `"—"` para a coluna de Adesão.
    - Recalibrar `columnStyles` para distribuição harmoniosa no A4 retrato:
      - 0: Descrição (50mm)
      - 1: Valor Unitário (23mm)
      - 2: ARP / Licitação (26mm)
      - 3: Adesão (15mm, alinhamento central)
      - 4: Data de Assinatura (18mm, alinhamento central)
      - 5: Órgão Gerenciador/UF (27mm)
      - 6: Fornecedor (27mm)

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/export/exporter-pdf-adesao.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/lib/export/exporter-pdf.ts tests/export/exporter-pdf-adesao.test.ts`
  `git commit -m "feat: adicionar coluna de adesao e fornecedor com CNPJ no relatorio PDF"`

---

### Task 5: Modal dos 20 Menores Itens — Expansão por Seta e Coluna de Adesão

**Files:**
- Modify: `src/components/Top20SelectionModal.tsx`
- Test: `tests/domain/top20-modal-expansao.test.tsx` (ou componente vitest)

**Interfaces:**
- Consumes: `ItemCandidato`, `ChevronDown`, `ChevronUp` de `lucide-react`
- Produces: Modal Top 20 interativo com botão de expansão concomitante por item, cartão de detalhes completo e coluna de Adesão.

- [ ] **Step 1: Escrever teste de unidade para lógica de expansão concomitante**
  Testar que:
  - Múltiplas chaves de itens podem ser adicionadas e removidas de `expandedKeys`.
  - Expandir um item não contrai outro item já expandido.
  - O rótulo e status de Adesão ("Sim" / "Não") são exibidos corretamente.

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/domain/top20-modal-expansao.test.tsx`
  Resultado esperado: FAIL.

- [ ] **Step 3: Implementar acordeão multi-item e coluna no `Top20SelectionModal.tsx`**
  - Adicionar estado: `const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());`
  - Função `toggleExpandItem(key: string)` para adicionar/remover chave.
  - No cabeçalho da tabela:
    - Adicionar coluna vazia de largura fixa para o botão da seta (`w-8`).
    - Adicionar coluna "Adesão" com alinhamento central.
  - Na linha principal do item:
    - Botão de seta: `<button onClick={(e) => { e.stopPropagation(); toggleExpandItem(key); }}>{isExpanded ? <ChevronUp className="w-4 h-4 text-[#1B365D] dark:text-[#D4AF37]" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</button>`
    - Célula de Adesão: badge estilizado (verde para "Sim", cinza para "Não").
    - Célula de fornecedor com CNPJ exibido na mesma célula.
  - Sub-linha condicional (`{isExpanded && (<tr className="bg-slate-50/90 dark:bg-slate-900/90"><td colSpan={totalCols}>...</td></tr>)}`):
    - Cartão estruturado com:
      - Objeto completo e Especificação Complementar;
      - Dados do Órgão e Localidade (CNPJ do Órgão, Esfera, Município, UF, IBGE);
      - Dados da ARP e Contratação (Número da ARP, Modalidade, Ano/Sequencial, Situação, Vigência Completa de Início e Fim, Data de Assinatura, Link PNCP e Anexos);
      - Fornecedor (Razão Social e CNPJ/CPF pontuado);
      - Quantitativos (Quantitativo previsto na ARP, Unidade de Fornecimento, Unidade de Referência);
      - Precificação e Normalização (Valor original, fórmula e memória de cálculo da Lei 14.133/2021);
      - Possibilidade de Adesão (Sim / Não com explicação sucinta).

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/domain/top20-modal-expansao.test.tsx`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/components/Top20SelectionModal.tsx tests/domain/top20-modal-expansao.test.tsx`
  `git commit -m "feat: implementar expansao concomitante por seta e coluna de adesao no top 20"`

---

### Task 6: Painel Consolidado e Exportador CSV

**Files:**
- Modify: `src/components/ConsolidatedReportPanel.tsx`
- Modify: `src/lib/export/exporter-csv.ts`
- Test: `tests/export/exporters-consolidated-update.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato.possibilidade_adesao`, `ItemCandidato.fornecedor`
- Produces: Visualização de Adesão e fornecedor com CNPJ no Painel Consolidado e no CSV.

- [ ] **Step 1: Escrever teste falhando para Painel Consolidado e CSV**
  Testar que:
  - O CSV exporta a coluna `possibilidade_adesao` com os valores correspondentes.
  - O fornecedor exportado no CSV inclui o CNPJ pontuado.

- [ ] **Step 2: Executar teste para verificar falha**
  Executar: `npx vitest run tests/export/exporters-consolidated-update.test.ts`
  Resultado esperado: FAIL.

- [ ] **Step 3: Implementar atualizações em `ConsolidatedReportPanel.tsx` e `exporter-csv.ts`**
  - Em `ConsolidatedReportPanel.tsx`:
    - Adicionar coluna "Adesão" na tabela de itens selecionados.
    - Exibir CNPJ junto ao fornecedor.
  - Em `exporter-csv.ts`:
    - Adicionar coluna `possibilidade_adesao` no cabeçalho e nos dados.

- [ ] **Step 4: Executar teste para verificar aprovação**
  Executar: `npx vitest run tests/export/exporters-consolidated-update.test.ts`
  Resultado esperado: PASS.

- [ ] **Step 5: Commit das alterações**
  `git add src/components/ConsolidatedReportPanel.tsx src/lib/export/exporter-csv.ts tests/export/exporters-consolidated-update.test.ts`
  `git commit -m "feat: adicionar possibilidade de adesao e cnpj no painel consolidado e csv"`

---

### Task 7: Verificação Integrada e Suite Completa de Testes

**Files:**
- Modify: Atualizar quaisquer mocks em testes existentes que dependam do número de colunas do Excel ou cabeçalhos do PDF (`tests/export/exporters.test.ts`, `tests/export/exporters-normalizacao.test.ts`).

- [ ] **Step 1: Executar suíte completa de testes unitários e de integração**
  Executar: `npm test`
  Resultado esperado: Todos os testes passando com zero falhas.

- [ ] **Step 2: Executar build de produção do Next.js**
  Executar: `npm run build`
  Resultado esperado: Compilação TypeScript e Webpack concluída com sucesso (código de saída 0).

- [ ] **Step 3: Commit final de homologação**
  `git commit -m "chore: validar suite completa de testes e build de producao"`
