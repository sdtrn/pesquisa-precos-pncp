# Padronização e Normalização de Preços Unitários (Postos/Veículos e Período Mensal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o motor determinístico e transparente de normalização de preços unitários em ARPs do PNCP para serviços com postos (vigilância, etc.) e locação de veículos/máquinas, calculando o valor unitário mensal individual com salvaguardas contra dupla divisão e exibindo a memória de cálculo completa na UI e nas exportações (Excel, PDF e CSV).

**Architecture:** Módulo de domínio puro e determinístico (`normalizador-precos.ts`) com TDD, integrado diretamente no pipeline de busca (`pipeline.ts`) antes do agrupamento e seleção do Top 20 (`selection.ts`). Interface com seletor híbrido inteligente no formulário e badges de rastreabilidade de cálculo nas tabelas e relatórios oficiais da Lei 14.133/2021.

**Tech Stack:** TypeScript, Next.js 15, Node.js Test Runner / Vitest shim, ExcelJS, jsPDF / AutoTable, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-11-02-padronizacao-precos-unitarios-design.md`

## Global Constraints

- O critério de **Maior Taxa de Desconto (%)** opera exclusivamente em percentuais e não sofre normalização monetária.
- Se uma ARP não informar o quantitativo de postos ou veículos na descrição nem nas informações complementares, o item **não deve ser descartado**: permanece com seu valor nominal na disputa dos 20 menores e exibe quantitativo como `"não informado"`.
- Se a unidade de medida já for `"Posto"` ou `"Veículo"`, ou se `quantidadeItem === N` no PNCP, o valor já é unitário: o divisor de unidades deve ser estritamente `1` (salvaguarda contra dupla divisão).
- Se a unidade de medida for `"Mês"` / `"Meses"`, o valor já representa uma fatura mensal: o divisor temporal deve ser estritamente `1` (não divide por 12).
- Todas as fórmulas de conversão devem ser registradas em formato textual auditável (ex.: `"R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto"`).

## Review Focus

1. **Item com valor já unitário e quantidade N na API:** item com descrição "3 postos de vigilância armada", `quantidade = 3` e `valorUnitarioHomologado = 12000` não pode ser dividido por 3 (deve permanecer R$ 12.000,00).
2. **Item com unidade 'Mês' e quantidade 12:** item com `unidadeMedida = "Mês"`, `quantidade = 12` e `valorUnitarioHomologado = 36000` (mensalidade de 3 postos) não pode ser dividido por 12 (deve resultar em R$ 36.000 ÷ 3 = R$ 12.000,00/mês/posto, e não R$ 1.000,00).
3. **Item com quantitativo por extenso:** item com texto "locação de dois veículos tipo hatch para 12 meses" deve extrair quantitativo = 2 e converter adequadamente.
4. **Item sem menção a postos ou veículos:** item com descrição genérica "serviço de vigilância da sede" sem informar número de postos não pode quebrar nem ser descartado: deve manter o valor original e marcar quantitativo como "não informado".
5. **Ordenação correta do Top 20:** um item de R$ 432.000,00 anual para 3 postos (R$ 12.000/mês real) deve empatar no ranking com outro item registrado diretamente a R$ 12.000,00/mês/posto.

---

### Task 1: Extensão dos Modelos de Domínio e Constantes

**Files:**
- Modify: `src/lib/domain/types.ts`
- Modify: `src/data/constants.ts`
- Test: `tests/domain/types-normalizacao.test.ts`

**Interfaces:**
- Produces:
  - `ModoNormalizacaoPreco = "auto" | "posto_mes" | "veiculo_mes" | "desativado"`
  - Campos em `ItemCandidato`: `valor_original?: number`, `unidade_original?: string`, `formula_normalizacao?: string`, `unidade_referencia?: string`, `normalizado?: boolean`
  - Campos em `ParametrosPipeline`: `modoNormalizacao?: ModoNormalizacaoPreco`
  - Campos em `ResultadoPesquisa`: `modo_normalizacao_escolhido?: ModoNormalizacaoPreco`, `modo_normalizacao_aplicado?: ModoNormalizacaoPreco`, `unidade_referencia_padrao?: string`
  - Constantes: `MODO_NORMALIZACAO_AUTO`, `MODO_NORMALIZACAO_POSTO`, `MODO_NORMALIZACAO_VEICULO`, `MODO_NORMALIZACAO_DESATIVADO`, `OPCOES_MODO_NORMALIZACAO`

- [ ] **Step 1: Escrever teste de validação de tipos e constantes**

Criar `tests/domain/types-normalizacao.test.ts` verificando a existência das constantes, opções e tipos esperados.

- [ ] **Step 2: Executar teste e verificar falha**

Run: `node --import ./register.js --test tests/domain/types-normalizacao.test.ts`  
Expected: FAIL com constantes/tipos não encontrados.

- [ ] **Step 3: Implementar novos tipos em `types.ts` e constantes em `constants.ts`**

Adicionar as definições em `src/lib/domain/types.ts` e constantes em `src/data/constants.ts`.

- [ ] **Step 4: Executar teste e verificar aprovação**

Run: `node --import ./register.js --test tests/domain/types-normalizacao.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/types.ts src/data/constants.ts tests/domain/types-normalizacao.test.ts
git commit -m "feat: add price normalization domain types and constants"
```

---

### Task 2: Motor Determinístico de Normalização (`normalizador-precos.ts`)

**Files:**
- Create: `src/lib/domain/normalizador-precos.ts`
- Create: `tests/domain/normalizador-precos.test.ts`

**Interfaces:**
- Consumes:
  - `ModoNormalizacaoPreco`, `ItemCandidato` de `src/lib/domain/types.ts`
- Produces:
  - `detectarModoNormalizacaoSugerido(descricao: string): ModoNormalizacaoPreco`
  - `extrairQuantitativoUnidades(texto: string, modo: ModoNormalizacaoPreco): number | null`
  - `detectarMesesPeriodo(texto: string, unidadeMedida?: string, quantidadeItem?: number): number`
  - `calcularPrecoNormalizado(dados: DadosCalculoNormalizacao): ResultadoCalculoNormalizacao`

- [ ] **Step 1: Escrever bateria de testes unitários TDD cobrindo todos os cenários e salvaguardas**

Em `tests/domain/normalizador-precos.test.ts`:
- Detecção automática de modo (`vigilância armada` -> `posto_mes`; `locação de hatch` -> `veiculo_mes`; `ar condicionado` -> `desativado`).
- Extração de quantitativo numérico e por extenso ("3 postos", "05 veículos", "dois vigilantes", "dez carros").
- Salvaguarda contra dupla divisão: quando `unidadeMedida === "Posto"` ou quando `quantidadeItem === 3` e o texto tem "3 postos", divisor de unidades deve ser 1.
- Salvaguarda de período mensal: quando `unidadeMedida === "Mês"`, não divide por 12.
- Conversão anual: quando unidade é "Ano" ou texto diz "valor global anual", divide por 12.
- Quantitativo ausente: texto sem número de postos retorna quantitativo = null, mantém valor original e marca quantitativo = "não informado".
- Formatação exata da string de fórmula: `"R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto"`.

- [ ] **Step 2: Executar testes e verificar falha**

Run: `node --import ./register.js --test tests/domain/normalizador-precos.test.ts`  
Expected: FAIL com módulo não encontrado.

- [ ] **Step 3: Implementar `src/lib/domain/normalizador-precos.ts`**

Implementar as funções com dicionário de termos, regexes para numerais e extensos ("um", "dois", "três", "quatro", "cinco", etc.), verificação de salvaguardas e formatação em BRL.

- [ ] **Step 4: Executar testes e verificar aprovação total**

Run: `node --import ./register.js --test tests/domain/normalizador-precos.test.ts`  
Expected: PASS com 100% dos testes aprovados.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/normalizador-precos.ts tests/domain/normalizador-precos.test.ts
git commit -m "feat: implement deterministic price normalization engine with safeguards"
```

---

### Task 3: Integração no Pipeline e Ranqueamento do Top 20

**Files:**
- Modify: `src/lib/domain/pipeline.ts`
- Modify: `src/lib/domain/selection.ts`
- Test: `tests/domain/pipeline-normalizacao.test.ts`

**Interfaces:**
- Consumes:
  - `calcularPrecoNormalizado`, `detectarModoNormalizacaoSugerido` de `normalizador-precos.ts`
  - `selecionarTop20Menores` de `selection.ts`
- Produces:
  - `ItemCandidato` com `valor_unitario` normalizado, `valor_original`, `formula_normalizacao`, `unidade_referencia` e `normalizado`.
  - `ResultadoPesquisa` com `modo_normalizacao_escolhido`, `modo_normalizacao_aplicado` e `unidade_referencia_padrao`.

- [ ] **Step 1: Escrever teste de integração para o pipeline com itens de postos e veículos**

Criar `tests/domain/pipeline-normalizacao.test.ts` simulando itens com preços de R$ 36.000 (lote 3 postos) e R$ 12.000 (já unitário) e verificando que:
1. O valor unitário de ambos fica normalizado em R$ 12.000,00.
2. A ordenação no Top 20 trata ambos com o mesmo valor unitário.
3. Itens sem quantitativo informado mantêm seu valor original e são marcados como "não informado".

- [ ] **Step 2: Executar teste e verificar falha**

Run: `node --import ./register.js --test tests/domain/pipeline-normalizacao.test.ts`  
Expected: FAIL porque o pipeline ainda não aplica a normalização.

- [ ] **Step 3: Integrar a normalização em `pipeline.ts` e `selection.ts`**

- Em `pipeline.ts`: resolver `modoNormalizacaoAplicado` (se "auto", chama `detectarModoNormalizacaoSugerido`).
- No loop de itens, após apurar `menorValRes`: invocar `calcularPrecoNormalizado`. Preencher `valor_unitario = resNorm.valorNormalizado`, `valor_original = resNorm.valorOriginal`, `formula_normalizacao = resNorm.formula`, `unidade_referencia = resNorm.unidadeReferencia`, `normalizado = resNorm.normalizado`.
- Em `quantitativo_previsto_arp`: se o quantitativo foi detectado ou se não foi informado na ARP, formatar adequadamente.
- Em `selection.ts`: garantir que o desempate preserve a ordenação precisa pelo `valor_unitario` normalizado.

- [ ] **Step 4: Executar testes e verificar aprovação**

Run: `node --import ./register.js --test tests/domain/pipeline-normalizacao.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/pipeline.ts src/lib/domain/selection.ts tests/domain/pipeline-normalizacao.test.ts
git commit -m "feat: integrate unit price normalization into search pipeline and Top 20 selection"
```

---

### Task 4: Atualização da Interface do Usuário (Parâmetros, Top 20 e Painel Consolidado)

**Files:**
- Modify: `src/components/SearchParametersForm.tsx`
- Modify: `src/components/Top20SelectionModal.tsx`
- Modify: `src/components/ConsolidatedReportPanel.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes:
  - `ModoNormalizacaoPreco`, `OPCOES_MODO_NORMALIZACAO`
  - `detectarModoNormalizacaoSugerido`
  - Novos campos em `ItemCandidato` e `ResultadoPesquisa`

- [ ] **Step 1: Atualizar `SearchParametersForm.tsx`**

- Adicionar props: `modoNormalizacao: ModoNormalizacaoPreco`, `onChangeModoNormalizacao: (modo: ModoNormalizacaoPreco) => void`.
- Inserir seletor "Padronização de Preço Unitário" com opções:
  - `⚡ Automático (Detectado)`
  - `🛡️ Mensal por Posto (R$/mês/posto)`
  - `🚗 Mensal por Veículo (R$/mês/veículo)`
  - `⏹️ Desativado (Preço Bruto da Ata)`
- Exibir badge dinâmico ao lado do seletor indicando o modo detectado a partir de `descricaoObjeto` quando `modoNormalizacao === "auto"`.

- [ ] **Step 2: Atualizar `Top20SelectionModal.tsx`**

- Ajustar cabeçalho da coluna de valor para exibir a unidade de referência ativa (ex.: `"Valor Unitário (R$/mês/posto)"`).
- Na linha da tabela: se `item.normalizado`, exibir ícone de cálculo com tooltip contendo `item.formula_normalizacao` e valor bruto original `item.valor_original`.
- Se o quantitativo estiver ausente, exibir `"não informado"` com estilo discreto.

- [ ] **Step 3: Atualizar `ConsolidatedReportPanel.tsx` e `page.tsx`**

- No painel consolidado: exibir a unidade de referência nos cartões de métricas (média, mediana, menor valor).
- Em `page.tsx`: gerenciar o estado `modoNormalizacao`, repassá-lo na chamada da API `/api/pesquisar` e na persistência do histórico.

- [ ] **Step 4: Executar build de verificação da aplicação**

Run: `node --import ./register.js --test (Get-ChildItem -Recurse tests/*.test.ts | Select-Object -ExpandProperty FullName)`  
Expected: PASS sem quebrar nenhum teste existente.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchParametersForm.tsx src/components/Top20SelectionModal.tsx src/components/ConsolidatedReportPanel.tsx src/app/page.tsx
git commit -m "feat: add price normalization controls and audit tooltips to UI"
```

---

### Task 5: Atualização dos Exportadores Auditáveis (Excel, PDF e CSV)

**Files:**
- Modify: `src/lib/export/exporter-xlsx.ts`
- Modify: `src/lib/export/exporter-pdf.ts`
- Modify: `src/lib/export/exporter-csv.ts`
- Modify: `tests/export/exporters.test.ts`
- Create: `tests/export/exporters-normalizacao.test.ts`

**Interfaces:**
- Consumes:
  - Campos `valor_original`, `formula_normalizacao`, `unidade_referencia`, `normalizado` de `ItemCandidato`
  - `modo_normalizacao_aplicado` de `ResultadoPesquisa`
- Produces:
  - Planilha `.xlsx` com colunas de valor normalizado, memória de cálculo e valor original.
  - Relatório `.pdf` com indicação da regra de normalização e memória de cálculo de cada item normalizado.
  - Arquivo `.csv` com colunas `valor_unitario_normalizado`, `valor_original_arp`, `formula_normalizacao`.

- [ ] **Step 1: Escrever teste de validação de exportação com campos normalizados**

Criar `tests/export/exporters-normalizacao.test.ts` testando a geração de XLSX, PDF e CSV contendo itens normalizados e verificando a presença da fórmula e do valor original nas saídas geradas.

- [ ] **Step 2: Executar teste e verificar falha**

Run: `node --import ./register.js --test tests/export/exporters-normalizacao.test.ts`  
Expected: FAIL porque os exportadores ainda não possuem as colunas/campos.

- [ ] **Step 3: Implementar colunas e memórias de cálculo nos exportadores**

- Em `exporter-xlsx.ts`: adicionar na aba do Top 20 as colunas `Valor Unitário Normalizado (R$)`, `Memória de Cálculo / Normalização`, `Valor Original ARP (R$)` e `Unidade ARP`. Manter as fórmulas de média e mediana sobre a coluna do valor normalizado.
- Em `exporter-pdf.ts`: incluir no quadro de parâmetros a regra de normalização aplicada e, na tabela dos 20 menores preços, a linha de memória de cálculo para itens convertidos.
- Em `exporter-csv.ts`: incluir as colunas adicionais mantendo compatibilidade com delimitador `;` e UTF-8 BOM.

- [ ] **Step 4: Executar testes de exportação e verificar aprovação**

Run: `node --import ./register.js --test tests/export/exporters-normalizacao.test.ts tests/export/exporters.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/exporter-xlsx.ts src/lib/export/exporter-pdf.ts src/lib/export/exporter-csv.ts tests/export/exporters.test.ts tests/export/exporters-normalizacao.test.ts
git commit -m "feat: add unit price normalization audit trail and formula columns to exporters"
```

---

### Task 6: Testes Integrados E2E e Ajuste do Script de Testes em `package.json`

**Files:**
- Modify: `package.json`
- Create: `tests/domain/normalizacao-e2e.test.ts`

**Interfaces:**
- Consumes:
  - Todo o ecossistema integrado: pipeline, normalizador, seleção Top 20, exportadores e estatísticas.

- [ ] **Step 1: Ajustar o script `test` em `package.json`**

Atualizar `"test"` em `package.json` para executar o runner Node com TypeScript nativo e registro de aliases:  
`"test": "node --import ./register.js --test tests/domain/*.test.ts tests/export/*.test.ts tests/storage/*.test.ts"`

- [ ] **Step 2: Escrever teste E2E completo do cenário de vigilância e locação de veículos**

Em `tests/domain/normalizacao-e2e.test.ts`, simular uma pesquisa completa de serviço de vigilância contendo:
- ARP 1: R$ 36.000,00 mensal para 3 postos (normaliza para R$ 12.000,00).
- ARP 2: R$ 432.000,00 anual para 3 postos (normaliza para R$ 12.000,00).
- ARP 3: R$ 12.000,00 mensal já cadastrada com unidade "Posto" (permanece R$ 12.000,00).
- ARP 4: R$ 15.000,00 sem quantitativo informado (permanece R$ 15.000,00 com "não informado").
Verificar que a média calculada reflete com exatidão R$ 12.750,00 (em vez de centenas de milhares de reais), confirmando o pleno sucesso da normalização.

- [ ] **Step 3: Executar a suíte de testes completa do sistema**

Run: `node --import ./register.js --test (Get-ChildItem -Recurse tests/*.test.ts | Select-Object -ExpandProperty FullName)`  
Expected: PASS com 100% dos testes aprovados.

- [ ] **Step 4: Commit**

```bash
git add package.json tests/domain/normalizacao-e2e.test.ts
git commit -m "test: add comprehensive end-to-end normalization test suite and update test script"
```
