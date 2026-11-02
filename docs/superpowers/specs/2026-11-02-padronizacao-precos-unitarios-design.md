# Especificação de Design: Padronização e Normalização de Preços Unitários (Postos/Veículos e Período Mensal) em ARPs

**Data**: 02/11/2026  
**Status**: Proposto (Aguardando Aprovação)  
**Autor**: Sérgio Dantas Torres / Antigravity

---

## 1. Contexto e Motivação (Intent & Why)

Na administração pública brasileira (sob a Lei nº 14.133/2021), a pesquisa de preços para contratação de **serviços contínuos com dedicação exclusiva de mão de obra** (como vigilância armada/desarmada, portaria, limpeza e recepção) ou **locação de bens e frotas** (locação de veículos, máquinas e equipamentos) enfrenta um desafio crítico no PNCP:

Os órgãos públicos frequentemente registram no PNCP o item da licitação/ARP não pelo valor unitário individual por posto ou veículo por mês (ex.: R$ 12.000,00/mês/posto), mas sim:
1. Pelo **valor mensal global do lote com múltiplos postos/veículos** (ex.: R$ 36.000,00/mês para 3 postos);
2. Pelo **valor anual global para todo o contrato de 12 meses** (ex.: R$ 432.000,00/ano para 3 postos durante 12 meses);
3. Ou com quantidades registradas como `12` (meses) e valor unitário sendo a fatura mensal do lote inteiro.

Atualmente, o pipeline extrai diretamente o campo `valorUnitarioHomologado`. Isso causa uma distorção grave de comparabilidade: valores de lotes inteiros ou montantes anuais (R$ 36.000,00 ou R$ 432.000,00) concorrem diretamente com itens que foram cadastrados corretamente pelo preço unitário por posto/mês (R$ 12.000,00). Essa inconsistência desvirtua o ranking dos 20 menores preços, a identificação de outliers e o cálculo da média e mediana da pesquisa.

Para atender aos rigores dos órgãos de controle (TCU, TCEs, Controladorias) e garantir a fidedignidade da pesquisa de preços para a estimativa da contratação, o sistema deve **padronizar e normalizar os preços na mesma unidade de comparação mensal (por posto ou por veículo)**, assegurando comparabilidade real e transparência documental com memória de cálculo explícita.

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos
1. **Padronização da Unidade de Comparação**:
   - Para serviços com postos (vigilância, etc.): calcular e comparar o **Preço Unitário Mensal por Posto (R$/mês/posto)**.
   - Para locação de veículos/máquinas: calcular e comparar o **Preço Unitário Mensal por Veículo (R$/mês/veículo)**.
   - Para bens comuns ou desativado: manter o preço unitário padrão registrado na ARP.
2. **Abordagem Híbrida de Configuração**:
   - Detectar automaticamente a unidade recomendada a partir da descrição do objeto e dos requisitos (ex.: identificando palavras como "vigilância", "posto", "locação de veículo", etc.).
   - Disponibilizar um seletor visual e editável nos Parâmetros da Pesquisa permitindo ao operador confirmar ou escolher:
     - `auto` (Automático / Detectado)
     - `posto_mes` (Mensal por Posto)
     - `veiculo_mes` (Mensal por Veículo)
     - `desativado` (Preço Bruto da Ata / Sem Normalização)
3. **Motor Determinístico de Normalização com Salvaguardas**:
   - Analisar `unidadeMedida`, `quantidade`, `descricao`, `informacaoComplementar` e dados do item/resultado.
   - Extrair a quantidade de postos ou veículos (ex.: "3 postos", "05 veículos", "2 vigilantes").
   - Identificar a periodicidade temporal (anual / 12 meses vs. mensal).
   - Aplicar a fórmula matemática: `Preço Normalizado = Valor Homologado ÷ (Meses × Quantidade)`.
   - Prevenir rigorosamente dupla divisão se a ata já cadastrou o preço unitário correto ou se a unidade for mensal.
4. **Tratamento de Dados Incompletos na ARP**:
   - Se uma ARP não informar o quantitativo de postos ou veículos na descrição nem nos metadados, o item **não deve ser descartado**: se seu valor estiver entre os 20 menores, ele é incluído, seu valor original é preservado como base e a coluna de quantitativo exibirá `"não informado"`.
5. **Rastreabilidade e Memória de Cálculo Auditável**:
   - Preservar no `ItemCandidato` o `valor_original`, a `unidade_original`, a `formula_normalizacao` e a `unidade_referencia`.
   - Exibir na tabela do Top 20, no Painel Consolidado e em todas as exportações (Excel, PDF, CSV) tanto o valor normalizado quanto a memória de cálculo (ex.: `"R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês"` ou `"R$ 432.000,00 ÷ (12 m × 3 postos) = R$ 12.000,00/mês"`).
6. **Consistência Total da Janela Top 20 e Estatísticas**:
   - O algoritmo de seleção (`selection.ts`) e o cálculo estatístico (`statistics.ts` - média, mediana, desvio padrão, IQR) devem operar sobre o `valor_unitario` já devidamente normalizado.

### Não-Objetivos
- Não aplicar normalização sobre o critério de **Maior Taxa de Desconto (%)**, que já opera com percentuais puros.
- Não descartar itens de atas pela mera ausência de detalhamento do número de postos, mantendo-os com o status de quantitativo não informado conforme orientação do usuário.
- Não realizar chamadas externas a APIs de terceiros ou downloads pesados de PDFs inteiros para realizar a normalização, mantendo a performance e o tempo de resposta instantâneo.

### Anti-Objetivos
- Não realizar conversões "mágicas" ou invisíveis: o auditor e o operador devem sempre ver com clareza o valor original registrado no PNCP e a fórmula matemática utilizada na normalização.
- Não impor a normalização de forma compulsória ou irreversível: o usuário deve ter sempre o controle nos parâmetros para desativá-la caso queira comparar o valor nominal bruto da ata.

---

## 3. Abordagens Consideradas

### Abordagem 1: Motor Determinístico Integrado ao Pipeline (Selecionada)
- O processamento de normalização é executado diretamente no loop de avaliação dos itens em `pipeline.ts` através de um módulo especialista (`normalizador-precos.ts`).
- **Vantagens**: Execução em sub-milissegundos, 100% determinístico e testável com testes unitários, custo zero de infraestrutura e garante que o ranking do Top 20 já receba os valores unitários reais equivalentes.
- **Desvantagens**: Requer expressões regulares abrangentes para cobrir diferentes formulações de texto em licitações públicas.

### Abordagem 2: Inspeção Profunda via Download e IA de Editais/PDFs (Descartada)
- Baixar a íntegra dos anexos de cada ata e delegar a leitura a modelos de IA.
- **Motivo de Descarte**: Adicionaria latência de dezenas de segundos por consulta, risco crítico de timeout (serverless Vercel) e custos financeiros adicionais por busca.

### Abordagem 3: Ajuste Manual Pós-Pesquisa na Tabela (Descartada)
- Exibir os preços brutos e exigir que o usuário digite os divisores em cada linha da tabela.
- **Motivo de Descarte**: Não soluciona o problema da seleção do Top 20 (uma ata anual de R$ 432.000,00 seria eliminada antes de poder ser dividida) e transfere esforço manual repetitivo para o usuário.

---

## 4. Especificação Técnica e Arquitetura

### 4.1. Tipos e Modelos de Domínio (`src/lib/domain/types.ts`)

```typescript
export type ModoNormalizacaoPreco =
  | "auto"
  | "posto_mes"
  | "veiculo_mes"
  | "desativado";

export interface ItemCandidato {
  // ... campos existentes ...
  valor_unitario: number; // Armazena o valor unitário normalizado (ex.: 12000.00)
  valor_original?: number; // Valor bruto homologado da API (ex.: 36000.00 ou 432000.00)
  unidade_original?: string; // Unidade original da API (ex.: "Mês", "Ano", "Lote")
  formula_normalizacao?: string; // Ex.: "R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto"
  unidade_referencia?: string; // Ex.: "R$/mês/posto", "R$/mês/veículo", "R$"
  normalizado?: boolean; // true se houve cálculo de divisão/conversão
}

export interface ParametrosPipeline {
  // ... campos existentes ...
  modoNormalizacao?: ModoNormalizacaoPreco;
}

export interface ResultadoPesquisa {
  // ... campos existentes ...
  modo_normalizacao_escolhido?: ModoNormalizacaoPreco;
  modo_normalizacao_aplicado?: ModoNormalizacaoPreco;
  unidade_referencia_padrao?: string;
}
```

### 4.2. Módulo Especialista: `src/lib/domain/normalizador-precos.ts`

Criar o módulo dedicado com funções puras e testáveis:

1. **`detectarModoNormalizacaoSugerido(descricao: string): ModoNormalizacaoPreco`**:
   - Detecta termos de mão de obra / postos: `vigilancia`, `vigilante`, `seguranca patrimonial`, `portaria`, `porteiro`, `recepcao`, `recepcionista`, `limpeza`, `servicos gerais`, `motorista`. -> Retorna `"posto_mes"`.
   - Detecta termos de veículos / frota: `locacao de veiculo`, `aluguel de veiculo`, `veiculos tipo hatch`, `sedan`, `suv`, `picape`, `caminhonete`, `van`, `motocicleta`. -> Retorna `"veiculo_mes"`.
   - Caso contrário: retorna `"desativado"`.

2. **`extrairQuantitativoUnidades(texto: string, modo: ModoNormalizacaoPreco): number | null`**:
   - Para `"posto_mes"`: busca padrões como `(\d+)\s*(?:postos?|vigilantes?|profissionais?|agentes?|colaboradores?)`.
   - Para `"veiculo_mes"`: busca padrões como `(\d+)\s*(?:veiculos?|veículos?|automoveis?|automóveis?|carros?|viaturas?|unidades?)`.
   - Retorna o número inteiro encontrado ou `null` se ausente.

3. **Salvaguarda contra Dupla Divisão de Unidades (Preço Já Unitizado)**:
   - Se `unidadeMedida` já for `"Posto"` (ou sinônimo de posto) no modo `"posto_mes"`, ou `"Veículo"` / `"Automóvel"` no modo `"veiculo_mes"`: o valor do PNCP já é individual por unidade. O divisor de postos/veículos é `1`.
   - Se `quantidadeItem === N` ou `quantidadeHomologada === N` (onde `N` é o quantitativo extraído do texto): significa que o órgão já cadastrou o item com quantidade `N` e o `valorUnitarioHomologado` já é o preço unitário individual de 1 posto ou veículo. O divisor de postos/veículos é `1`.
   - A divisão por `N` é executada exclusivamente quando o item foi registrado como lote/serviço global (`quantidade === 1` ou unidade tipo `"Lote"`, `"Serviço"`, `"Mês"`, `"Unidade"`) e o texto descritivo explicita que o objeto abrange `N` postos ou veículos.

4. **Regra de Periodicidade Temporal (Mensal vs. Anual)**:
   - Se `unidadeMedida` for `"Mês"`, `"Meses"`, `"Mensal"`: o `valorUnitarioHomologado` do PNCP já representa a parcela mensal (divisor temporal = 1).
   - O divisor temporal por `12` (meses) é acionado somente quando:
     a) `unidadeMedida` for expressamente `"Ano"`, `"Anual"` ou `"Exercício"`; OU
     b) A descrição contiver termos expressos de valor global anual como `"valor anual"`, `"montante global anual"`, `"contrato anual"`, `"estimativa anual"`; OU
     c) `quantidade === 1` e a descrição indicar vigência anual com valor total.

5. **Escopo de Extração Textual**:
   - Restrito rigorosamente a `descricao` e `informacaoComplementar` do item (evitando contaminação cruzada com outros itens/lotes da mesma ata).
   - Se o número de postos ou veículos não for identificado nesses campos, o item **não é descartado**: seu valor original é mantido no ranking do Top 20 e a coluna de quantitativo exibe `"não informado"`.

6. **`calcularPrecoNormalizado(...)`**:
   - Entrada: `valorHomologado`, `quantidadeHomologada`, `descricaoItem`, `informacaoComplementar`, `unidadeMedidaItem`, `quantidadeItem`, `modoNormalizacao`.
   - Retorna objeto com:
     - `valorNormalizado`: número em R$
     - `valorOriginal`: número bruto do PNCP
     - `unidadeOriginal`: string
     - `unidadeReferencia`: "R$/mês/posto", "R$/mês/veículo" ou "R$"
     - `formula`: string explicativa (ex.: `"R$ 36.000,00 ÷ 3 postos = R$ 12.000,00/mês/posto"`)
     - `normalizado`: boolean indicando se houve conversão

### 4.3. Integração no Pipeline (`src/lib/domain/pipeline.ts`)

- Ao instanciar `params.modoNormalizacao`, resolver o modo ativo:
  - Se `"auto"`, chama `detectarModoNormalizacaoSugerido(params.descricaoObjeto)`.
  - Caso contrário, utiliza o modo explicitamente selecionado.
- No processamento do item após obtenção do `menorValRes`:
  - Invocar `calcularPrecoNormalizado(...)`.
  - Atribuir o valor normalizado ao campo `valor_unitario`.
  - Guardar `valor_original = menorValRes`, `formula_normalizacao`, `unidade_referencia` e `normalizado`.
- No agrupamento por ata e seleção do Top 20 (`selection.ts`):
  - A ordenação e desempate utilizam o `valor_unitario` normalizado, assegurando que o ranking compare rigorosamente a mesma base.

### 4.4. Componentes de Interface do Usuário (UI)

1. **`SearchParametersForm.tsx`**:
   - Adicionar o controle de **"Padronização de Preço Unitário"** junto ao critério de classificação:
     - O select mantém a opção ativa (padrão: `"auto"`).
     - Um badge informativo dinâmico exibe em tempo real o modo detectado a partir do texto digitado (ex.: `⚡ Auto (Detectado: Mensal por Posto)`).
     - Opções disponíveis:
       - ⚡ **Automático (Detectado)**
       - 🛡️ **Mensal por Posto (R$/mês/posto)**
       - 🚗 **Mensal por Veículo (R$/mês/veículo)**
       - ⏹️ **Desativado (Preço Bruto da Ata)**
   - Ao selecionar um preset rápido (ex.: vigilância ou veículos), o modo correspondente é sugerido.

2. **`Top20SelectionModal.tsx`**:
   - Cabeçalho da coluna: exibir a unidade de referência ativa (ex.: `"Valor Unitário (R$/mês/posto)"` quando aplicável).
   - Na linha da tabela: se o item foi normalizado, exibir um ícone ou badge com a memória de cálculo em tooltip (ex.: `"Calculado a partir de R$ 36.000,00 ÷ 3 postos"`).
   - Se o quantitativo não foi informado na ARP, exibir `"não informado"` com clareza.

3. **`ConsolidatedReportPanel.tsx`**:
   - Refletir no cabeçalho estatístico e na tabela consolidada a unidade padrão da pesquisa (ex.: `"Preço Médio Unitário: R$ 12.350,00 / mês / posto"`).

### 4.5. Exportadores (Excel, PDF e CSV)

1. **Planilha Excel (`src/lib/export/exporter-xlsx.ts`)**:
   - Na aba "Top 20 Itens", adicionar colunas:
     - `Valor Unitário Normalizado (R$)`
     - `Fórmula / Memória de Cálculo`
     - `Valor Original Homologado na ARP (R$)`
     - `Unidade da ARP`
   - O cabeçalho e as fórmulas estatísticas (`=AVERAGE`, `=MEDIAN`) continuam operando sobre a coluna do valor normalizado.

2. **Relatório PDF Oficial (`src/lib/export/exporter-pdf.ts`)**:
   - No quadro resumo de parâmetros, listar a regra de normalização aplicada.
   - Na tabela do Top 20, incluir a anotação/fórmula da conversão para cada item normalizado, atendendo às exigências de transparência da Lei 14.133/2021.

3. **Arquivo CSV (`src/lib/export/exporter-csv.ts`)**:
   - Incluir os campos `valor_unitario_normalizado`, `valor_original_arp`, `formula_normalizacao` e `unidade_referencia`.

---

## 5. O que fica a cargo do Implementador (Left to the Builder)

- Expressões regulares específicas e sinônimos no dicionário de postos (ex.: "vigias", "porteiros", "postos 12x36", "postos 44h") e veículos (ex.: "veículos utilitários", "caminhonetes", "motocicletas").
- Ajuste fino dos espaçamentos visuais e larguras de colunas no PDF e na planilha Excel para manter harmonia e paginação perfeita.
- Testes unitários abrangendo casos com números por extenso (ex.: "três postos", "dois veículos") e variações comuns em editais.
