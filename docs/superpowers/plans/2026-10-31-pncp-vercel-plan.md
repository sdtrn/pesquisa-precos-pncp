# Pesquisa de Preços em Atas do PNCP (Edição Web Vercel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a aplicação web completa em Next.js App Router (TypeScript) para Pesquisa de Preços em Atas do PNCP na Vercel, com paridade 100% em relação às regras de auditoria R1–R7, streaming de progresso em tempo real (SSE), gráficos de dispersão/distribuição, histórico de pesquisas em IndexedDB (com toggle de salvamento), filtros e saneamento estatístico, e exportação tripla (`.xlsx` A4 com 3 abas e fórmula `=AVERAGE`, `.pdf` executivo A4 e `.csv`).

**Architecture:** Aplicação full-stack Next.js App Router em TypeScript sob Node.js 24 LTS (Fluid Compute da Vercel). O backend em `src/lib/domain/` e `src/app/api/` executa o cliente HTTP keep-alive paralelo com cache em memória, validação de municípios IBGE (177 municípios embarcados em JSON), extração de requisitos e pipeline R1–R7 com streaming via `ReadableStream` (SSE). O frontend em `src/components/` oferece tema Light/Dark institucional (`#1B365D` e `#B59410`), animações `framer-motion`, gráficos `recharts`, janela modal interativa dos 20 menores valores, histórico em IndexedDB e exportadores `.xlsx`, `.pdf` e `.csv`.

**Tech Stack:** Next.js 15+ (App Router, TypeScript), React 19, Tailwind CSS, Framer Motion, Lucide React, Recharts, ExcelJS, jsPDF + jspdf-autotable, Vitest.

**Spec:** [2026-10-31-pncp-vercel-design.md](file:///g:/Meu%20Drive/Projetos%20Antigravity/Pesquisa%20de%20Pre%C3%A7os%20PNCP%20Vercel/docs/superpowers/specs/2026-10-31-pncp-vercel-design.md)

## Global Constraints

- Runtime Node.js na Vercel (Fluid Compute); nunca exportar `runtime = 'edge'`.
- Fuso horário oficial para todas as datas e comparações de calendário: `America/Recife` (UTC-3).
- Regra R1: Escopo `"Critério de validade"` aceita exclusivamente União (`"F"`), Estados (`"E"`), Distrito Federal (`"D"`) e Municípios (`"M"`) constantes na lista dos 177 municípios com orçamento $\ge$ R$ 1 bilhão (`municipios_bilionarios_2026.csv`).
- Regra R2: Casamento de municípios estritamente por código IBGE de 7 dígitos e/ou igualdade exata de `(nome_sem_acentos_minusculo, UF)`. Proibido casar por `contém`/substring (ex.: `"Vitória de Santo Antão/PE"` nunca casa com `"Vitória/ES"`).
- Regra R4: Atas canceladas ou com divergência de status local vs. API nunca recebem aderência `"A"` (são rebaixadas para `"B"` com motivo explícito).
- Regra R5: Preço válido vem exclusivamente de `valorUnitarioHomologado > 0` no endpoint `/resultados` (nunca `valorUnitarioEstimado`), com unidade de fornecimento compatível sem conversão artificial.
- Regra R6: No máximo 1 item por ata na janela de seleção final (o de menor valor unitário que atenda), além de deduplicação por `(cnpj, numero_arp_licitacao, numero_item_lote)` e `(cnpj, ano_compra, seq_compra, numero_item_lote)`.
- Regra R7: Esfera ausente ou fora de `{"F", "E", "D", "M"}` é descartada com motivo `"esfera não identificada"` no escopo de validade.
- Planilha `.xlsx` gerada com 3 abas exatas (`Planilha_Parecer`, `Memoria_de_Pesquisa`, `Descartados`), fonte `Arial`, configuração de página A4 retrato (`fitToWidth = 1`), linha final `"MÉDIA DOS VALORES UNITÁRIOS"` com fórmula nativa `=AVERAGE(B2:B{N})` e quadro complementar de links diretos das ARPs.

## Review Focus

1. **Timestamps ISO-8601 com nanosegundos ou sufixo `Z` vindos do PNCP (`data_publicacao_pncp`):** `parseDataCalendarioRecife` deve truncar frações acima de milissegundos e converter para a data correta em `America/Recife` sem deslocar `"YYYY-MM-DD"` puras em `-1` dia por erro de fuso UTC.
2. **Municípios homônimos parciais (Regra R2):** `"Vitória de Santo Antão"` (PE) ou `"Santa Maria da Boa Vista"` (PE) jamais podem ser aprovados por conterem `"Vitória"` ou `"Santa Maria"`.
3. **Injeção de Fórmulas e HTML Sujo nas Descrições do PNCP:** Descrições vindas do PNCP com tags `<p>`, `<br>`, `&nbsp;`, caracteres de controle XML ilegais (`\x00-\x1F`) ou iniciadas por `=`, `+`, `@` devem ser sanitizadas antes de entrar no `.xlsx` ou `.csv`.
4. **Equação de Status e Paginação Paralela com Falha Parcial:** Caso uma chamada individual de `/itens` ou `/resultados` retorne `404` ou `204`, o cliente deve tratar graciosamente como lista vazia (`[]`) sem derrubar o stream SSE inteiro.
5. **Chave "Salvar no Histórico" Desligada:** Quando o toggle `salvarNoHistorico` estiver desmarcado (`false`), a conclusão da pesquisa não deve gravar registro automático no IndexedDB, mas o usuário ainda pode clicar manualmente em "Salvar no Histórico" se mudar de ideia.

---

### Task 1: Scaffolding Next.js, Configuração Vercel, Dados dos 177 Municípios Bilionários e Utilitários de Fuso (`America/Recife`)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vercel.ts`, `vitest.config.ts`
- Create: `src/data/municipios-bilionarios.json`
- Create: `src/data/constants.ts`
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/tz-recife.ts`
- Create: `src/lib/domain/municipios.ts`
- Test: `tests/domain/municipios-and-tz.test.ts`

**Interfaces:**
- Produces:
  - `src/data/constants.ts`: `ESCOPO_VALIDADE`, `ESCOPO_TODOS`, `ESCOPO_POR_ESTADO`, `ESCOPO_PE_RECIFE`, `STATUS_VIGENTES`, `STATUS_NAO_VIGENTES`, `STATUS_TODOS`, `DATA_ASSINATURA`, `DATA_PUBLICACAO`, `DATA_VIGENCIA`, `UFS_BRASIL`, `TOP_N_ITENS_JANELA = 20`, `PRESETS_EXEMPLOS`
  - `src/lib/domain/tz-recife.ts`:
    - `parseDataCalendarioRecife(valor?: string | null): string | null` (retorna `"YYYY-MM-DD"` no calendário `America/Recife` ou `null`)
    - `formatarDataBr(isoDate?: string | null): string` (`"DD/MM/YYYY"` ou `"não informado"`)
    - `hojeRecifeIso(): string` (`"YYYY-MM-DD"`)
    - `agoraRecifeFormatado(): string` (`"DD/MM/YYYY HH:MM:SS"`)
    - `verificarPeriodoLocal(tipoData: string, dataInicial: string | null, dataFinal: string | null, dtAssinatura: string | null, dtPublicacao: string | null, dtIniVigencia: string | null, dtFimVigencia: string | null): { dentroDoPeriodo: boolean; requerRevisaoBPorDataAusente: boolean; detalheMotivo: string }`
    - `verificarStatusLocal(statusUi: string, dtIniVigencia: string | null, dtFimVigencia: string | null, cancelado: boolean, hojeRecife: string): { divergencia: boolean; mensagem: string }`
  - `src/lib/domain/municipios.ts`:
    - `normalizarNomeMunicipio(nome?: string | null): string`
    - `avaliarOrgaoGerenciador(esferaId?: string | null, uf?: string | null, municipioNome?: string | null, codigoIbge?: string | null): { atendeCriterioValidade: boolean; motivoDescarteEscopoA: string | null; esferaNormalizada: string; metodoCasamentoMunicipio: string }`
    - `verificarEscopoEspecialOrgao(escopoOrgaos: string, ufSelecionada: string | null, esferaId: string, poderId: string, ufOrgao: string, municipioNome: string, codigoIbge: string, orgaoNome: string, unidadeNome: string): { aprovado: boolean; motivo: string }`

- [ ] **Step 1: Inicializar projeto Next.js + TypeScript + Tailwind + Vitest e converter `municipios_bilionarios_2026.csv` para `src/data/municipios-bilionarios.json`**
- [ ] **Step 2: Escrever os testes unitários em `tests/domain/municipios-and-tz.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { parseDataCalendarioRecife, formatarDataBr, verificarPeriodoLocal } from "@/lib/domain/tz-recife";
import { avaliarOrgaoGerenciador, verificarEscopoEspecialOrgao } from "@/lib/domain/municipios";
import { ESCOPO_PE_RECIFE, ESCOPO_POR_ESTADO, DATA_ASSINATURA, DATA_VIGENCIA } from "@/data/constants";

describe("Fuso America/Recife e Datas", () => {
  it("mantém data pura YYYY-MM-DD sem deslocar fuso UTC", () => {
    expect(parseDataCalendarioRecife("2025-11-04")).toBe("2025-11-04");
    expect(formatarDataBr(parseDataCalendarioRecife("2025-11-04"))).toBe("04/11/2025");
  });

  it("interpreta ISO-8601 com nanosegundos no fuso America/Recife", () => {
    expect(parseDataCalendarioRecife("2025-11-05T16:09:30.891311430")).toBe("2025-11-05");
  });

  it("verifica interseção de vigência e limites de período", () => {
    const ok = verificarPeriodoLocal(DATA_VIGENCIA, "2026-01-01", "2026-06-30", "2025-10-01", null, "2025-10-01", "2026-10-01");
    expect(ok.dentroDoPeriodo).toBe(true);
    const fora = verificarPeriodoLocal(DATA_ASSINATURA, "2026-03-23", "2026-10-21", "2026-01-15", null, null, null);
    expect(fora.dentroDoPeriodo).toBe(false);
    expect(fora.detalheMotivo).toBe("fora do período");
  });
});

describe("Validação de Municípios e Esferas (Regras R1, R2, R7)", () => {
  it("aprova Recife/PE (2611606) e Vitória/ES, mas reprova Vitória de Santo Antão/PE (sem substring)", () => {
    expect(avaliarOrgaoGerenciador("M", "PE", "Recife", "2611606").atendeCriterioValidade).toBe(true);
    expect(avaliarOrgaoGerenciador("M", "ES", "Vitória", "").atendeCriterioValidade).toBe(true);
    const vitoriaPe = avaliarOrgaoGerenciador("M", "PE", "Vitória de Santo Antão", "");
    expect(vitoriaPe.atendeCriterioValidade).toBe(false);
    expect(vitoriaPe.motivoDescarteEscopoA).toBe("município fora da lista");
  });

  it("aprova União (F), Estados (E) e DF (D) e reprova esfera vazia (R7)", () => {
    expect(avaliarOrgaoGerenciador("F", "DF", "Brasília", "").atendeCriterioValidade).toBe(true);
    const semEsf = avaliarOrgaoGerenciador("", "PE", "Recife", "2611606");
    expect(semEsf.atendeCriterioValidade).toBe(false);
    expect(semEsf.motivoDescarteEscopoA).toBe("esfera não identificada");
  });

  it("valida escopos especiais (ARPs por Estado e Governo PE / Prefeitura do Recife)", () => {
    expect(verificarEscopoEspecialOrgao(ESCOPO_POR_ESTADO, "SP", "M", "E", "SP", "Campinas", "", "Prefeitura", "").aprovado).toBe(true);
    expect(verificarEscopoEspecialOrgao(ESCOPO_POR_ESTADO, "SP", "F", "E", "SP", "São Paulo", "", "União", "").aprovado).toBe(false);
    expect(verificarEscopoEspecialOrgao(ESCOPO_PE_RECIFE, null, "E", "E", "PE", "Recife", "2611606", "Secretaria de Administração", "").aprovado).toBe(true);
    expect(verificarEscopoEspecialOrgao(ESCOPO_PE_RECIFE, null, "E", "J", "PE", "Recife", "2611606", "Tribunal de Justiça de PE", "").aprovado).toBe(false);
  });
});
```

- [ ] **Step 3: Implementar `src/data/constants.ts`, `src/lib/domain/types.ts`, `src/lib/domain/tz-recife.ts` e `src/lib/domain/municipios.ts`**
- [ ] **Step 4: Executar `npx vitest run tests/domain/municipios-and-tz.test.ts` e confirmar PASS**

---

### Task 2: Motor de Extração de Termos, Requisitos Mínimos e Classificação de Aderência (`A`, `B`, `C` e Regra R5)

**Files:**
- Create: `src/lib/domain/parser-requisitos.ts`
- Test: `tests/domain/parser-requisitos.test.ts`

**Interfaces:**
- Consumes: `RequisitoMinimo`, `ResultadoAderencia` de `src/lib/domain/types.ts`
- Produces:
  - `semAcentosMinusculo(texto?: string | null): string`
  - `gerarTermosBusca(descricao: string): string[]`
  - `extrairRequisitosMinimos(descricao: string): RequisitoMinimo[]`
  - `extrairDimensoesItem(textoNorm: string): [number, number] | null`
  - `extrairEspessuraMicrasItem(textoNorm: string): number | null`
  - `extrairPesoKgItem(textoNorm: string): number | null`
  - `verificarUnidadeCompativel(valorEsperado: string, unidadeApi: string | null | undefined, textoItemNorm: string): { compativel: boolean; mensagem: string }`
  - `avaliarAderenciaItem(descricaoItem: string | null | undefined, unidadeMedidaApi: string | null | undefined, requisitos: RequisitoMinimo[], informacaoComplementarItem?: string | null, objetoAta?: string | null): ResultadoAderencia`

- [ ] **Step 1: Escrever os testes unitários em `tests/domain/parser-requisitos.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  gerarTermosBusca,
  extrairRequisitosMinimos,
  avaliarAderenciaItem,
} from "@/lib/domain/parser-requisitos";

const DESC_LONA =
  "Rolo de lona em plástico medindo no mínimo 8MX100M. Rolo de lona - em plástico resistente, novo de primeiro uso, acondicionado em bobina, cor preto fosco medindo no mínimo 8mX100m com no mínimo 200 micras (0,200mm). Pesando no mínimo 110 kg.";

describe("Extração de Termos e Requisitos Mínimos e Classificação A/B/C", () => {
  it("gera termos de busca específicos para lona plástica preta sem palavras genéricas isoladas", () => {
    const termos = gerarTermosBusca(DESC_LONA);
    expect(termos).toEqual(["lona", "lona plastica", "lona preta"]);
  });

  it("extrai os 7 requisitos mínimos do caso clássico de lona 8x100m 200 micras 110kg", () => {
    const reqs = extrairRequisitosMinimos(DESC_LONA);
    const atributos = reqs.map((r) => r.Atributo);
    expect(atributos).toContain("Objeto principal");
    expect(atributos).toContain("Material");
    expect(atributos).toContain("Cor");
    expect(atributos).toContain("Largura");
    expect(atributos).toContain("Comprimento");
    expect(atributos).toContain("Espessura");
    expect(atributos).toContain("Peso");
    expect(atributos).toContain("Unidade de fornecimento");
  });

  it("classifica como A item completo, B item com peso ausente, e C item com dimensão menor ou unidade em metros (R5)", () => {
    const reqs = extrairRequisitosMinimos(DESC_LONA);

    const resA = avaliarAderenciaItem(
      "Lona plástica preta em polietileno 8x100m, espessura 200 micras, rolo com 115 kg",
      "ROLO",
      reqs
    );
    expect(resA.aderencia).toBe("A");

    const resB = avaliarAderenciaItem(
      "Bobina de lona plástica preta 8m x 100m, 0,20mm (200 micras)",
      "BOBINA",
      reqs
    );
    expect(resB.aderencia).toBe("B");

    const resCUnidade = avaliarAderenciaItem(
      "Lona plástica preta 8x100m 200 micras 110kg",
      "METRO",
      reqs
    );
    expect(resCUnidade.aderencia).toBe("C");

    const resCDimensao = avaliarAderenciaItem(
      "Rolo de lona plástica preta 4x100m 200 micras 110kg",
      "ROLO",
      reqs
    );
    expect(resCDimensao.aderencia).toBe("C");
  });
});
```

- [ ] **Step 2: Implementar `src/lib/domain/parser-requisitos.ts` portando fielmente todas as regras de `src/parser_requisitos.py`**
- [ ] **Step 3: Executar `npx vitest run tests/domain/parser-requisitos.test.ts` e confirmar PASS**

---

### Task 3: Cliente HTTP PNCP de Alta Performance, Pipeline R1–R7, Seleção Top 20 e Saneamento Estatístico

**Files:**
- Create: `src/lib/domain/pncp-client.ts`
- Create: `src/lib/domain/pipeline.ts`
- Create: `src/lib/domain/statistics.ts`
- Test: `tests/domain/pipeline-and-stats.test.ts`

**Interfaces:**
- Consumes: `tz-recife.ts`, `municipios.ts`, `parser-requisitos.ts`, `types.ts`
- Produces:
  - `src/lib/domain/pncp-client.ts`: `PNCPClient` com cache em memória LRU/TTL, controle de concorrência (`MAX_PARALLEL_WORKERS = 10`), `buscarTodasAtasPorTermos`, `conferirEquacaoStatusApi`, `obterDetalheAta`, `obterDetalheCompra`, `obterTodosItensCompra`, `obterResultadosItem`, `obterArquivosAta`, `enriquecerItensComArquivosAta`
  - `src/lib/domain/pipeline.ts`:
    - `limparTextoExibicao(valor: unknown): string`
    - `executarPipelinePesquisa(params: ParametrosPipeline, progressoCb?: (msg: string, frac: number, parcial?: Record<string, number>) => void): Promise<ResultadoPesquisa>`
    - `selecionarTop20Menores(itensCandidatos: ItemCandidato[], incluirRevisaoB?: boolean, limite?: number): ItemCandidato[]`
  - `src/lib/domain/statistics.ts`:
    - `calcularEstatisticasPrecos(valores: number[]): EstatisticasPrecos` (média, mediana, menor, maior, desvioPadrao, coeficienteVariacao, q1, q3, iqr, limiteInferiorOutlier, limiteSuperiorOutlier)
    - `identificarOutliersIqr(itens: ItemCandidato[]): Set<string>`

- [ ] **Step 1: Escrever os testes unitários em `tests/domain/pipeline-and-stats.test.ts` (incluindo Regra R6 de 1 item por ata, sanitização de HTML/fórmulas e cálculo estatístico/outliers)**

```typescript
import { describe, it, expect } from "vitest";
import { selecionarTop20Menores, limparTextoExibicao } from "@/lib/domain/pipeline";
import { calcularEstatisticasPrecos } from "@/lib/domain/statistics";
import type { ItemCandidato } from "@/lib/domain/types";

describe("Regra R6 (1 item por ata), Sanitização e Estatísticas", () => {
  it("limpa tags HTML e caracteres de controle das descrições do PNCP", () => {
    expect(limparTextoExibicao("<p>Rolo de <strong>lona</strong>&nbsp;8x100m\x07</p>")).toBe(
      "Rolo de lona 8x100m"
    );
  });

  it("aplica a Regra R6 mantendo no máximo 1 item por ata ordenado por menor valor unitário", () => {
    const candidatos: Partial<ItemCandidato>[] = [
      { cnpj_orgao: "111", numero_arp_licitacao: "ARP nº 1/2026", numero_item_lote: "1", valor_unitario: 950, aderencia: "A" },
      { cnpj_orgao: "111", numero_arp_licitacao: "ARP nº 1/2026", numero_item_lote: "2", valor_unitario: 890, aderencia: "A" },
      { cnpj_orgao: "222", numero_arp_licitacao: "ARP nº 2/2026", numero_item_lote: "1", valor_unitario: 750, aderencia: "B" },
      { cnpj_orgao: "333", numero_arp_licitacao: "ARP nº 3/2026", numero_item_lote: "1", valor_unitario: 910, aderencia: "A" },
    ];

    const topA = selecionarTop20Menores(candidatos as ItemCandidato[], false, 20);
    expect(topA).toHaveLength(2);
    expect(topA.map((x) => x.valor_unitario)).toEqual([890, 910]);

    const topAB = selecionarTop20Menores(candidatos as ItemCandidato[], true, 20);
    expect(topAB).toHaveLength(3);
    expect(topAB.map((x) => x.valor_unitario)).toEqual([750, 890, 910]);
  });

  it("calcula média, mediana, desvio-padrão, CV e limites IQR corretamente", () => {
    const stats = calcularEstatisticasPrecos([100, 110, 105, 115, 108, 450]);
    expect(stats.quantidade).toBe(6);
    expect(stats.menor).toBe(100);
    expect(stats.maior).toBe(450);
    expect(stats.mediana).toBeCloseTo(109, 1);
    expect(stats.limiteSuperiorOutlier).toBeLessThan(450);
  });
});
```

- [ ] **Step 2: Implementar `src/lib/domain/statistics.ts`, `src/lib/domain/pncp-client.ts` e `src/lib/domain/pipeline.ts`**
- [ ] **Step 3: Executar `npx vitest run tests/domain/pipeline-and-stats.test.ts` e confirmar PASS**

---

### Task 4: Exportadores Auditáveis (`.xlsx` A4 com 3 Abas e Fórmula `=AVERAGE`, `.csv` UTF-8 BOM e `.pdf` Executivo A4)

**Files:**
- Create: `src/lib/export/exporter-xlsx.ts`
- Create: `src/lib/export/exporter-csv.ts`
- Create: `src/lib/export/exporter-pdf.ts`
- Test: `tests/export/exporters.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato`, `RegistroDescartado`, `ResultadoPesquisa` de `src/lib/domain/types.ts`
- Produces:
  - `sanitizarCelulaExcel(valor: unknown): string`
  - `gerarPlanilhaXlsx(itensSelecionados: ItemCandidato[], itensJanelaTop20: ItemCandidato[], indicesSelecionados: number[], descartados: RegistroDescartado[]): Promise<Uint8Array>`
  - `gerarCsvConsolidado(itensSelecionados: ItemCandidato[]): string`
  - `gerarRelatorioPdfA4(res: ResultadoPesquisa, itensSelecionados: ItemCandidato[]): Promise<Uint8Array>`

- [ ] **Step 1: Escrever os testes unitários em `tests/export/exporters.test.ts` verificando as 3 abas do `.xlsx`, fonte `Arial`, fórmula `=AVERAGE(B2:B{N})`, bloqueio de fórmula maliciosa e CSV com `;`**

```typescript
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { gerarPlanilhaXlsx, sanitizarCelulaExcel } from "@/lib/export/exporter-xlsx";
import { gerarCsvConsolidado } from "@/lib/export/exporter-csv";
import type { ItemCandidato } from "@/lib/domain/types";

describe("Exportadores .XLSX A4 e .CSV", () => {
  it("escapa prefixos de fórmula (=, +, @) e caracteres ilegais XML", () => {
    expect(sanitizarCelulaExcel("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizarCelulaExcel("<p>Lona\x02 Preta</p>")).toBe("Lona Preta");
  });

  it("gera planilha .xlsx com 3 abas, fonte Arial e fórmula =AVERAGE(B2:B3)", async () => {
    const itens: Partial<ItemCandidato>[] = [
      {
        descricao_objeto: "Lona 8x100m 200 micras",
        valor_unitario: 800,
        numero_arp_licitacao: "ARP nº 10/2026",
        data_assinatura: "10/05/2026",
        orgao_gerenciador_uf: "Prefeitura do Recife/PE",
        fornecedor: "Empresa A (00.000.000/0001-00)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/1/2026/1/1",
      },
      {
        descricao_objeto: "Lona 8x100m 200 micras",
        valor_unitario: 900,
        numero_arp_licitacao: "ARP nº 12/2026",
        data_assinatura: "12/05/2026",
        orgao_gerenciador_uf: "Governo de PE/PE",
        fornecedor: "Empresa B (11.111.111/0001-11)",
        link_ata_pncp: "https://pncp.gov.br/app/atas/2/2026/2/1",
      },
    ];

    const bytes = await gerarPlanilhaXlsx(itens as ItemCandidato[], itens as ItemCandidato[], [0, 1], []);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Planilha_Parecer",
      "Memoria_de_Pesquisa",
      "Descartados",
    ]);

    const ws1 = wb.getWorksheet("Planilha_Parecer")!;
    expect(ws1.getCell("A4").value).toBe("MÉDIA DOS VALORES UNITÁRIOS");
    expect(ws1.getCell("B4").value).toEqual({ formula: "AVERAGE(B2:B3)" });
    expect(ws1.getCell("B4").font?.name).toBe("Arial");
  });

  it("gera CSV com BOM UTF-8, separador ';' e linha final de média", () => {
    const csv = gerarCsvConsolidado([
      {
        descricao_objeto: "Item 1",
        valor_unitario: 500,
        numero_arp_licitacao: "ARP 1",
        data_assinatura: "01/01/2026",
        orgao_gerenciador_uf: "Órgão/PE",
        fornecedor: "Forn 1",
        link_ata_pncp: "https://pncp.gov.br",
      } as ItemCandidato,
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("MÉDIA DOS VALORES UNITÁRIOS;R$ 500,00");
  });
});
```

- [ ] **Step 2: Implementar `src/lib/export/exporter-xlsx.ts`, `src/lib/export/exporter-csv.ts` e `src/lib/export/exporter-pdf.ts`**
- [ ] **Step 3: Executar `npx vitest run tests/export/exporters.test.ts` e confirmar PASS**

---

### Task 5: Rotas de API Next.js (Fluid Compute Node.js) com Streaming SSE e Persistência de Histórico (IndexedDB)

**Files:**
- Create: `src/app/api/parse-requisitos/route.ts`
- Create: `src/app/api/pesquisar/route.ts`
- Create: `src/app/api/arquivos-ata/route.ts`
- Create: `src/lib/storage/history-db.ts`
- Test: `tests/storage/history-db.test.ts`

**Interfaces:**
- Consumes: `parser-requisitos.ts`, `pipeline.ts`, `pncp-client.ts`
- Produces:
  - `POST /api/parse-requisitos`: recebe `{ descricao: string }`, retorna `{ termos: string[], requisitos: RequisitoMinimo[] }`
  - `POST /api/pesquisar`: recebe `ParametrosPipeline`, retorna stream `text/event-stream` com eventos `{ type: "progress", msg, frac, parcial }` e `{ type: "result", data: ResultadoPesquisa }`
  - `POST /api/arquivos-ata`: recebe `{ itens: ItemCandidato[] }`, retorna `{ itens: ItemCandidato[] }` enriquecidos com `arquivos_arp` e `link_download_arp`
  - `src/lib/storage/history-db.ts`:
    - `deveSalvarAutomaticamenteNoHistorico(flagUsuario: boolean): boolean`
    - `criarRegistroHistorico(res: ResultadoPesquisa, descricaoObjeto: string, itensSelecionados: ItemCandidato[], indicesSelecionados: number[], incluirRevisaoB: boolean): RegistroHistoricoPesquisa`
    - `salvarPesquisaHistorico(registro: RegistroHistoricoPesquisa): Promise<void>`
    - `listarHistoricoPesquisas(): Promise<RegistroHistoricoPesquisa[]>`
    - `removerPesquisaHistorico(id: string): Promise<void>`
    - `limparTodoHistorico(): Promise<void>`
    - `exportarHistoricoJson(registros: RegistroHistoricoPesquisa[]): string`
    - `importarHistoricoJson(jsonStr: string): RegistroHistoricoPesquisa[]`

- [ ] **Step 1: Escrever os testes unitários em `tests/storage/history-db.test.ts` validando a criação de registros com data da pesquisa, serialização/importação JSON e respeito à flag `salvarNoHistorico`**
- [ ] **Step 2: Implementar `src/lib/storage/history-db.ts` e as 3 rotas de API em `src/app/api/`**
- [ ] **Step 3: Executar `npx vitest run tests/storage/history-db.test.ts` e confirmar PASS**

---

### Task 6: Interface Visual Moderna (UI/UX Pro Max), Gráficos de Dispersão/Auditoria, Janela Modal Top 20 e Histórico

**Files:**
- Create: `src/components/HeaderInstitucional.tsx`
- Create: `src/components/ScopeSelectorBanner.tsx`
- Create: `src/components/SearchParametersForm.tsx`
- Create: `src/components/RequirementsReviewPanel.tsx`
- Create: `src/components/LiveProgressBanner.tsx`
- Create: `src/components/Top20SelectionModal.tsx`
- Create: `src/components/AuditAnalyticsDashboard.tsx`
- Create: `src/components/ConsolidatedReportPanel.tsx`
- Create: `src/components/HistoryDrawer.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: Rotas `/api/parse-requisitos`, `/api/pesquisar`, `/api/arquivos-ata`, `exporter-xlsx.ts`, `exporter-csv.ts`, `exporter-pdf.ts`, `history-db.ts`, `statistics.ts`
- Produces: Aplicação web interativa completa com:
  1. Cabeçalho Institucional com crédito a **Sérgio Dantas Torres**, alternador Light/Dark Mode e botão de Histórico com contador de pesquisas salvas.
  2. Seletor visual dos **4 Escopos de Órgãos** (incluindo seletor das 27 UFs quando `"ARPs por Estado (UF)"` estiver ativo) + Banner dinâmico de explicação do escopo ativo.
  3. Card **1. Parâmetros da Pesquisa de Preços** com Catálogo de Presets rápidos (1 clique), Status (`Vigentes`, `Não vigentes`, `Todos`), Tipo de Data (`Assinatura`, `Publicação`, `Vigência`), Período com validação de datas e **Switch "Salvar pesquisa no Histórico (com data/hora)"**.
  4. Card **2. Conferência de Termos de Busca e Requisitos Mínimos Extraídos** com chips de termos editáveis e tabela dinâmica para adicionar, editar ou remover requisitos antes de consultar o PNCP.
  5. Painel de **Progresso em Tempo Real (Streaming SSE)** com barra fluida, etapas detalhadas e contadores parciais.
  6. **Janela Modal Ampla dos 20 Menores Valores Unitários (Regra R6)** aberta automaticamente após a busca, com:
     - Toggle *"Incluir itens de revisão manual (B)"*
     - Filtros rápidos internos (busca por texto/fornecedor/órgão, filtro de UF, filtro de Esfera, faixa de valor R$)
     - Botões *"Marcar todas"*, *"Desmarcar todas"* e *"Sugerir saneamento de outliers (IQR)"*
     - Rodapé ao vivo fixo com: Qtd selecionada, **Média dos valores unitários**, **Mediana**, **Menor/Maior valor** e **Coeficiente de Variação (CV%)**.
  7. **Painel de Auditoria e Gráficos Interativos (`AuditAnalyticsDashboard`)**:
     - 4 cards de métricas (`Atas Encontradas`, `Atas no Escopo/Período`, `Itens Avaliados`, `Registros Descartados`) + badges da **Equação de Status no PNCP (`Todos = Vigentes + Não vigentes`)**.
     - **Gráfico de Dispersão de Preços (Scatter Plot)** com linha de Média, Mediana e destaque dourado nos itens selecionados.
     - **Gráfico de Distribuição por UF / Esfera** e **Tabela/Gráfico de Motivos de Descarte** + Explorador pesquisável da aba `Descartados` e `Memória de Pesquisa` direto na tela.
  8. **Seção 3. Tabela Consolidada, Evidências das ARPs e Downloads**:
     - Tabela Consolidada com linha final `"MÉDIA DOS VALORES UNITÁRIOS"`.
     - Botões de download: **Planilha `.xlsx` Formatada A4 (3 Abas + `=AVERAGE`)**, **Relatório Técnico `.pdf` Formatado A4** e **Tabela `.csv`**.
     - Cartões e tabela de **Evidências e Papéis de Trabalho** com links diretos para a página oficial da ata no PNCP e download direto dos PDFs homologados.
  9. **Gaveta Lateral de Histórico de Pesquisas (`HistoryDrawer`)** com busca por data/objeto, restauração com 1 clique, botão de salvar manualmente, exclusão e exportação/importação de backup `.json`.

- [ ] **Step 1: Configurar estilos globais (`globals.css`), fontes (`Plus Jakarta Sans`, `IBM Plex Sans`, `JetBrains Mono`) e variáveis de tema Light/Dark**
- [ ] **Step 2: Implementar os componentes visuais em `src/components/` e integrar o fluxo completo em `src/app/page.tsx`**
- [ ] **Step 3: Executar `npm run build` e `npx vitest run` para verificar zero erros de TypeScript, lint, build da Vercel e testes**
- [ ] **Step 4: Validar a aplicação ao vivo em servidor local (`npm run dev`) testando a API real do PNCP**
