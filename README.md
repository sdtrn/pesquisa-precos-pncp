# Sistema de Pesquisa de Preços em Atas do PNCP

Este sistema realiza pesquisas auditáveis de preços unitários exclusivamente em **Atas de Registro de Preços (ARP)** publicadas no **Portal Nacional de Contratações Públicas (PNCP)**, gerando planilhas formatadas para o tópico **"Pesquisa de Preços"** de Pareceres Técnicos (Lei nº 14.133/2021).

> **Desenvolvido por:** Sérgio Dantas Torres (Gestor Governamental de Controle Interno — CGM Recife)

---

## Como Abrir o Sistema Localmente (Com 1 Duplo Clique no Windows)

1. Abra a pasta do projeto no seu Windows (`Pesquisa de Preços PNCP`).
2. Dê um **duplo clique** no arquivo **`iniciar_sistema.bat`**.
3. Uma janela se abrirá e, em poucos segundos, o sistema carregará automaticamente no seu navegador padrão.
4. *(Mantenha a janela aberta enquanto utilizar o sistema; ao terminar, basta fechá-la).*

---

## Funcionalidades e Fluxo do Sistema

### 1. Parâmetros da Pesquisa (Tela Inicial)
* **Escopo dos órgãos** (4 modalidades de filtro auditável):
  * **Critério de validade (padrão):** Aceita atas gerenciadas pela **União (Federal)**, pelos **Estados**, pelo **Distrito Federal** ou pelos **Municípios com orçamento anual ≥ R$ 1 bilhão** listados em `municipios_bilionarios_2026.csv`.
  * **Todos os órgãos do Brasil:** Aceita atas de qualquer órgão municipal, estadual, distrital ou federal do país, sem restrição de lista.
  * **ARPs por Estado (UF):** Filtra a pesquisa para retornar exclusivamente atas do Estado escolhido (Poder Executivo Estadual + todos os municípios daquela UF).
  * **Governo de Pernambuco e Prefeitura do Recife:** Filtro especializado para **objetos de mão de obra** sujeitos a Convenções Coletivas de Trabalho (CCT) locais, retornando apenas atas da Administração Direta e Indireta do Governo de PE e/ou da Prefeitura do Recife.
* **Objeto da pesquisa:** Digite ou cole a descrição técnica completa do item pretendido.
* **Status da ata:** "Vigentes" (padrão), "Não vigentes" ou "Todos".
* **Data usada no período e Intervalo:**
  * Filtre por **Data de assinatura da ata** (padrão), **Data de publicação no PNCP** ou **Vigência**.
  * Limites de data inclusivos com validação de datas.

### 2. Conferência de Termos e Requisitos Mínimos
* Extração automática de requisitos (dimensões, espessura, cor, material, peso, etc.).
* Possibilidade de edição antes de iniciar as consultas ao PNCP.

### 3. Janela de Seleção dos 20 Menores Valores Unitários
* Abre automaticamente ao final da busca em janela modal ampla (`st.dialog`).
* Apresenta os **20 menores valores unitários** encontrados em ordem crescente, aplicando rigorosamente a **Regra R6 (1 item por ata)** para evitar distorções na média.
* Opção de incluir itens com aderência B (revisão manual).
* Caixa de seleção na primeira coluna à esquerda, botões "Marcar todas" / "Desmarcar todas" e rodapé com cálculo dinâmico da média em tempo real.

### 4. Tabela Consolidada, Evidências e Downloads
* **Tabela Consolidada**: Linhas selecionadas + linha final "MÉDIA DOS VALORES UNITÁRIOS".
* **Planilha Formatada para A4 (`.xlsx`)**: Arquivo Excel de 3 abas (`Planilha_Parecer`, `Memoria_de_Pesquisa`, `Descartados`), ajustado para folha A4 com fórmula nativa `=AVERAGE(...)` e rodapé de página personalizado.
* **Arquivo `.csv`**: Download rápido com separador ponto e vírgula e codificação UTF-8 com BOM.
* **Evidências e Links Diretos**: Tabela e cartões com links diretos para a página oficial da ata no PNCP e links diretos para download dos arquivos/PDFs originais homologados.

---

## Estrutura de Pastas e Arquivos

* `iniciar_sistema.bat` — Arquivo para abrir o sistema com duplo clique.
* `app.py` — Interface visual do sistema (Streamlit).
* `municipios_bilionarios_2026.csv` — Lista oficial dos municípios com orçamento ≥ R$ 1 bilhão, enriquecida com o código oficial do IBGE.
* `docs/ENDPOINTS.md` — Documentação técnica das rotas e nomes exatos dos campos da API do PNCP e do IBGE.
* `.cache_pncp/` — Pasta de memória local que guarda atas já consultadas para tornar novas pesquisas muito mais rápidas.
* `logs/` — Registro técnico de auditoria para eventuais divergências de dados na API do PNCP.
