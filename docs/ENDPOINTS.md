# Documentação dos Endpoints e Campos Canônicos (PNCP e IBGE)

Este documento registra os endpoints reais utilizados pelo portal do **PNCP (Portal Nacional de Contratações Públicas)** na página de busca e visualização de Atas de Registro de Preços (`https://pncp.gov.br/app/atas`), bem como a API oficial de localidades do **IBGE** utilizada exclusivamente para identificação e validação de municípios (Regras R1 e R2).

---

## 1. Busca de Atas de Registro de Preços (PNCP)

* **Método e URL:** `GET https://pncp.gov.br/api/search/`
* **Origem da descoberta:** Chamada de rede disparada pelo frontend Angular do PNCP (`searchURL: "/api/search"`, método `fetchContent` / `buildCurrentQueryParams`).

### 1.1. Parâmetros de Consulta (`Query Parameters`)

| Parâmetro | Valores / Formato | Descrição |
| :--- | :--- | :--- |
| `tipos_documento` | `"ata"` (fixo) | Restringe a busca exclusivamente a Atas de Registro de Preços. |
| `q` | Texto livre | Termo pesquisado no título/descrição/objeto da ata. |
| `status` | `"vigente"`, `"nao_vigente"` ou `"todos"` | Filtro de vigência da ata: `"vigente"` (Vigentes), `"nao_vigente"` (Não vigentes) e `"todos"` (Todos). A soma de `"vigente"` + `"nao_vigente"` é igual a `"todos"`. |
| `pagina` | Inteiro $\ge 1$ | Número da página de resultados (inicia em `1`). |
| `tam_pagina` | Inteiro (ex.: `100`) | Quantidade de registros por página (padrão da tela é `10`; exportação usa até `2000`; limite do índice é `9990`). |
| `ordenacao` | `"-data"` | Ordenação padrão do portal (mais recentes primeiro). |
| `data_assinatura_inicio` | `"YYYY-MM-DD"` | Limite inicial (inclusivo) quando o filtro de período usa **Data de assinatura da ata**. |
| `data_assinatura_fim` | `"YYYY-MM-DD"` | Limite final (inclusivo) quando o filtro de período usa **Data de assinatura da ata**. |
| `data_publicacao_inicio` | `"YYYY-MM-DD"` | Limite inicial (inclusivo) quando o filtro de período usa **Data de publicação no PNCP**. |
| `data_publicacao_fim` | `"YYYY-MM-DD"` | Limite final (inclusivo) quando o filtro de período usa **Data de publicação no PNCP**. |
| `data_inicio_vigencia_inicio` | `"YYYY-MM-DD"` | Limite inicial da data de início de vigência na API de busca. |
| `data_inicio_vigencia_fim` | `"YYYY-MM-DD"` | Limite final da data de início de vigência na API de busca. *(Nota: Para a opção **"Vigência"** — pelo menos 1 dia de vigência dentro do período — envia-se apenas `data_inicio_vigencia_fim` na API quando houver Data final, e faz-se a conferência completa de interseção `data_inicio_vigencia <= data_final` E `data_fim_vigencia >= data_inicial` localmente).* |

### 1.2. Nomes Exatos das Datas no PNCP (Busca vs. Detalhe da Ata)

| Opção na Tela do Sistema | Campo Canônico no `/api/search/` (`items[]`) | Campo Canônico no Detalhe da Ata (`/api/pncp/v1/.../atas/{seq}`) | Formato Retornado |
| :--- | :--- | :--- | :--- |
| **Data de assinatura da ata** | `data_assinatura` | `dataAssinatura` | `"YYYY-MM-DD"` (ex.: `"2025-11-04"`) |
| **Data de publicação no PNCP** | `data_publicacao_pncp` | `dataPublicacaoPncp` | ISO-8601 `"YYYY-MM-DDTHH:mm:ss[.ffffff]"` (ex.: `"2025-11-05T16:09:30.442963"`) |
| **Vigência (início)** | `data_inicio_vigencia` | `dataVigenciaInicio` | `"YYYY-MM-DD"` (ex.: `"2025-11-04"`) |
| **Vigência (fim)** | `data_fim_vigencia` | `dataVigenciaFim` | `"YYYY-MM-DD"` (ex.: `"2026-11-04"`) |

> **Regra de Conferência Local (Fuso `America/Recife`):**
> * Campos no formato `"YYYY-MM-DD"` são datas puras de calendário e são convertidos diretamente para `datetime.date(YYYY, MM, DD)` sem deslocamento de fuso.
> * Campos com carimbo de tempo (`data_publicacao_pncp` / `dataPublicacaoPncp`) são interpretados no fuso horário `America/Recife` (horário oficial do PNCP/Brasília, UTC-3) e extraída a respectiva data de calendário (`date()`).
> * Caso o resultado retornado pela API com parâmetros de filtro divirja da conferência local:
>   * Se a ata estiver **fora do período** na conferência local, ela vai para a aba **`Descartados`** com o motivo `"fora do período"` (ou `"status incompatível na conferência local"`).
>   * Se houver divergência entre os campos do índice de busca (`/api/search/`) e o endpoint de detalhe da ata (`/atas/{seq}`), o item é sinalizado como **B (revisão manual)** e registrado no log.

### 1.3. Demais Campos Canônicos de `items[]` em `/api/search/`

* `id`: Identificador interno do documento no índice de busca.
* `title`: Título da ata (ex.: `"Ata nº 12/2026"`).
* `description`: Objeto resumido da compra/ata.
* `item_url`: Caminho relativo da ata no formato `"/atas/{orgao_cnpj}/{ano}/{numero_sequencial_compra_ata}/{numero_sequencial}"`.
* `numero_controle_pncp`: Número de controle PNCP da ata (ex.: `"10565000000192-1-000904/2024-000002"`).
* `ano`: Ano da compra de origem (string).
* `numero_sequencial`: Sequencial da ata dentro da compra (string).
* `numero_sequencial_compra_ata`: Sequencial da compra de origem (string).
* `orgao_cnpj`: CNPJ do órgão gerenciador (14 dígitos).
* `orgao_nome`: Razão social / nome do órgão gerenciador.
* `unidade_codigo` e `unidade_nome`: Código e nome da unidade administrativa gerenciadora.
* `esfera_id`: Código canônico da esfera administrativa (`"F"` = Federal/União, `"E"` = Estadual, `"D"` = Distrital, `"M"` = Municipal).
* `esfera_nome`: Nome da esfera (`"Federal"`, `"Estadual"`, `"Distrital"`, `"Municipal"`).
* `poder_id` e `poder_nome`: Código e nome do Poder (`"E"` Executivo, `"L"` Legislativo, `"J"` Judiciário, `"N"` Não se aplica).
* `uf`: Sigla da Unidade Federativa (ex.: `"PE"`).
* `municipio_nome`: Nome do município do órgão gerenciador (ex.: `"Recife"`).
* `codigo_ibge`: Código IBGE de 7 dígitos do município (atenção: no índice `/api/search/` pode vir vazio `""` em alguns registros; no endpoint de detalhe da ata vem em `unidadeOrgao.codigoIbge`).
* `modalidade_licitacao_nome`: Nome da modalidade da licitação de origem (ex.: `"Pregão - Eletrônico"`).
* `situacao_nome`: Situação da ata (ex.: `"Divulgada no PNCP"`).
* `cancelado`: Booleano (`true` / `false`) indicando se a ata foi cancelada.

---

## 2. Detalhe da Ata de Registro de Preços (PNCP)

* **Método e URL:** `GET https://pncp.gov.br/api/pncp/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}/atas/{sequencial_ata}`
* **Link público correspondente no portal:** `https://pncp.gov.br/app/atas/{orgao_cnpj}/{ano}/{sequencial_compra}/{sequencial_ata}`
* **Campos Canônicos:**
  * `numeroAtaRegistroPreco`: Número oficial da ARP (ex.: `"2001.0006"` ou `"12"`).
  * `anoAta`: Ano da ARP (inteiro, ex.: `2025`).
  * `sequencialAta`: Número sequencial da ata.
  * `numeroControlePNCP`: ID PNCP da ata.
  * `numeroControlePncpCompra`: ID PNCP da compra de origem.
  * `dataAssinatura`: Data de assinatura (`"YYYY-MM-DD"`).
  * `dataVigenciaInicio`: Data inicial de vigência (`"YYYY-MM-DD"`).
  * `dataVigenciaFim`: Data final de vigência (`"YYYY-MM-DD"`).
  * `dataPublicacaoPncp`: Data/hora de publicação no PNCP.
  * `cancelado`: Booleano (`true` / `false`).
  * `dataCancelamento`: Data/hora de cancelamento (quando `cancelado == true` ou preenchido).
  * `orgaoEntidade`: Objeto com `{ "cnpj", "razaoSocial", "esferaId", "poderId" }`.
  * `unidadeOrgao`: Objeto com `{ "codigoUnidade", "nomeUnidade", "municipioNome", "codigoIbge", "ufSigla", "ufNome" }`.
  * `modalidadeNome`: Modalidade da contratação.
  * `objetoCompra`: Descrição do objeto da compra.

---

## 3. Detalhe da Compra / Licitação de Origem (PNCP)

* **Método e URL:** `GET https://pncp.gov.br/api/consulta/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}`
* **Finalidade:** Obter o número da licitação de origem (`numeroCompra` e `anoCompra`) para compor a coluna `"Nº da ARP / Licitação"` (ex.: `"ARP nº 12/2026 — Pregão - Eletrônico nº 45/2025"`).
* **Campos Canônicos:**
  * `numeroCompra`: Número do edital/licitação no órgão (ex.: `"GC-SEPLAGTD-001-PL 0025"`).
  * `anoCompra`: Ano da compra/licitação.
  * `modalidadeNome`: Nome da modalidade.
  * `processo`: Número do processo administrativo.

---

## 4. Itens da Compra Vinculada à Ata (PNCP)

* **Quantidade total de itens:**
  * `GET https://pncp.gov.br/api/pncp/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}/itens/quantidade`
  * Retorna um número inteiro com o total de itens da compra.
* **Listagem paginada de itens:**
  * `GET https://pncp.gov.br/api/pncp/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}/itens?pagina={pagina}&tamanhoPagina=50`
* **Campos Canônicos de cada item:**
  * `numeroItem`: Número do item (convertido imediatamente para `str` / texto para evitar erros de tipagem).
  * `descricao`: Descrição completa do item licitado.
  * `quantidade`: Quantidade prevista do item.
  * `unidadeMedida`: Unidade de fornecimento (ex.: `"UNIDADE"`, `"ROLO"`, `"BOBINA"`, `"METROS"`).
  * `valorUnitarioEstimado`: Valor estimado na fase interna (NÃO utilizado como preço registrado; o preço válido da ARP vem exclusivamente do endpoint `/resultados`).
  * `temResultado`: Booleano (`true` / `false`) indicando se há resultado homologado cadastrado.
  * `situacaoCompraItemNome`: Situação do item (ex.: `"Homologado"`, `"Em andamento"`).
  * `orcamentoSigiloso`: Booleano.

---

## 5. Resultados Homologados do Item — Preço Unitário e Fornecedor (PNCP)

* **Método e URL:** `GET https://pncp.gov.br/api/pncp/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}/itens/{numeroItem}/resultados`
* **Campos Canônicos (lista de resultados do item):**
  * `valorUnitarioHomologado`: Valor unitário homologado/registrado em R$ (campo obrigatório `> 0` conforme Regra R5).
  * `quantidadeHomologada`: Quantidade registrada/homologada para o fornecedor.
  * `valorTotalHomologado`: Valor total homologado.
  * `nomeRazaoSocialFornecedor`: Nome ou Razão Social do fornecedor vencedor.
  * `niFornecedor`: CNPJ ou CPF do fornecedor vencedor.
  * `situacaoCompraItemResultadoId` e `situacaoCompraItemResultadoNome`: Situação do resultado (ex.: `1` / `"Informado"`).
  * `dataCancelamento` e `motivoCancelamento`: Preenchidos caso o resultado do fornecedor tenha sido cancelado.
  * `ordemClassificacaoSrp`: Ordem de classificação no Sistema de Registro de Preços (prioriza-se `1`).

---

## 6. Arquivos e Documentos Oficiais da Ata de Registro de Preços (PNCP)

* **Método e URL:** `GET https://pncp.gov.br/api/pncp/v1/orgaos/{orgao_cnpj}/compras/{ano}/{sequencial_compra}/atas/{sequencial_ata}/arquivos`
* **Finalidade:** Obter os links diretos de download dos arquivos oficiais da ARP assinada (PDFs, aditivos etc.) para comprovação e instrução de papéis de trabalho de auditoria/controle interno.
* **Campos Canônicos:**
  * `url`: URL direta de download do arquivo no PNCP (`https://pncp.gov.br/pncp-api/v1/orgaos/{cnpj}/compras/{ano}/{seq_compra}/atas/{seq_ata}/arquivos/{sequencialDocumento}`).
  * `titulo`: Nome do documento cadastrado pelo órgão (ex.: `"ata assinada.pdf"`).
  * `tipoDocumentoNome`: Tipo do documento (ex.: `"Ata de Registro de Preços"`).
  * `sequencialDocumento`: Número sequencial do arquivo da ata.

---

## 7. API de Localidades do IBGE (Apenas Identificação de Municípios — R2)

* **Método e URL:** `GET https://servicodados.ibge.gov.br/api/v1/localidades/municipios`
* **Finalidade:** Preencher e validar a coluna `codigo_ibge` do arquivo `municipios_bilionarios_2026.csv`, confirmando nome do município e sigla da UF, com gravação em cache local. Nunca é utilizada para preços.
* **Campos Canônicos:**
  * `id`: Código IBGE do município (7 dígitos, ex.: `2611606` para Recife/PE).
  * `nome`: Nome oficial do município no IBGE.
  * `microrregiao.mesorregiao.UF.sigla` (ou `regiao-imediata.regiao-intermediaria.UF.sigla`): Sigla da UF de 2 letras.
