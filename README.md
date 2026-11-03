# Pesquisa de Preços no PNCP — Edição Web Vercel

Plataforma web moderna para **Pesquisa de Preços em Atas de Registro de Preços (ARPs)** do Portal Nacional de Contratações Públicas (**PNCP**), desenvolvida em **Next.js (App Router + TypeScript)** otimizada para **Vercel Fluid Compute**.

> **Autoria:** Desenvolvido por **Sérgio Dantas Torres**  
> **Conformidade Legal:** Lei Federal nº 14.133/2021 (Art. 23) e Instrução Normativa SEGES/ME nº 65/2021.

---

## Principais Funcionalidades

1. **Paridade Auditável 100% (Regras R1 a R7):**
   - **R1 (Escopo de Validade):** União (`F`), Estados (`E`), Distrito Federal (`D`) e os **177 Municípios brasileiros com orçamento anual (LOA 2026) ≥ R$ 1 bilhão**.
   - **R2 (Identificação Estrita de Município):** Validação pelo código IBGE de 7 dígitos (`codigoIbge`) e/ou par exato `Nome Normalizado + UF` (sem correspondência parcial por substring).
   - **R4 (Integridade de Status e Vigência):** Descarte de atas canceladas e rebaixamento automático para revisão manual (`Classe B`) em caso de divergência entre o status retornado pela API e a vigência aferida no calendário de Recife (`America/Recife`).
   - **R5 (Valor Homologado e Unidade):** Extração exclusiva do valor unitário homologado `> 0` no endpoint `/resultados` e verificação estrita de compatibilidade de unidade de medida (sem conversões arbitrárias).
   - **R6 (Deduplicação e Classificação por Item Homologado no Top 20):** Na seleção dos **20 menores preços unitários** (ou maiores taxas de desconto), classifica e ranqueia diretamente os itens homologados no certame, admitindo múltiplos itens/lotes distintos de uma mesma ARP (com fornecedores ou preços variados ou iguais) com identificação inequívoca de Item/Lote e Fornecedor, deduplicando apenas registros idênticos por (CNPJ, ARP, Nº do Item).
   - **R7 (Esfera Obrigatória):** Descarte auditável de registros sem esfera administrativa identificada (`"esfera não identificada"`).

2. **4 Escopos Institucionais de Órgãos:**
   - `Critério de validade` (União, Estados, DF e 177 municípios ≥ R$ 1 bilhão)
   - `Todos os órgãos do Brasil`
   - `ARPs por Estado (UF)` (Seletor com as 27 Unidades da Federação)
   - `Governo de Pernambuco e Prefeitura do Recife` (Poder Executivo Estadual PE + Executivo Municipal Recife)

3. **Histórico de Pesquisas Salvas (com Data e Hora da Consulta):**
   - Opção (toggle switch) para **salvar ou não automaticamente no Histórico** a cada pesquisa.
   - Registro da data e hora exatas da consulta (`DD/MM/AAAA HH:MM:SS` no fuso `America/Recife`).
   - Restauração instantânea de qualquer pesquisa salva sem necessidade de nova varredura no PNCP, além de exportação/importação de backup em `.json`.

4. **Gráficos Interativos e Saneamento Estatístico:**
   - **Gráfico de Dispersão de Preços Unitários** com destaque para os itens selecionados e linhas de referência para **Média** e **Mediana**.
   - **Assistente de Saneamento Estatístico (Outliers IQR / Mediana)** na janela modal dos 20 menores preços.
   - Gráficos de distribuição por **UF** e detalhamento dos **Motivos de Descarte (R1–R7)**.

5. **Exportação Tripla Auditável:**
   - **Excel (`.xlsx` A4 Paisagem):** 3 abas (`Planilha_Parecer`, `Memoria_de_Pesquisa`, `Descartados`), fonte Arial, links clicáveis e fórmula `=AVERAGE(B2:B{N})` na célula de média final.
   - **Relatório Técnico Executivo (`.pdf` A4):** Documento formatado com parâmetros da consulta, quadro estatístico (Média, Mediana, Menor, Maior, Desvio Padrão e CV%), tabela consolidada e links das atas.
   - **CSV Consolidado (`.csv` UTF-8 com BOM):** Delimitado por `;` para abertura direta no Microsoft Excel.

---

## Como Executar e Fazer Deploy na Vercel

### Desenvolvimento Local
```bash
npm install
npm run dev
```

### Testes Automatizados (Vitest)
```bash
npm test
```

### Deploy na Vercel
1. Conecte o repositório na [Vercel](https://vercel.com) ou execute `vercel deploy`.
2. O arquivo `vercel.ts` já configura o limite estendido (`maxDuration: 60`) e memória (`1024 MB`) para as rotas de API em Node.js Fluid Compute.
