import type {
  ItemCandidato,
  RegistroHistoricoPesquisa,
  ResultadoPesquisa,
} from "@/lib/domain/types";

const DB_NAME = "PesquisaPrecosPNCP_DB";
const DB_VERSION = 1;
const STORE_NAME = "historico_pesquisas";

export function deveSalvarAutomaticamenteNoHistorico(
  flagUsuario: boolean
): boolean {
  return Boolean(flagUsuario);
}

export function criarRegistroHistorico(
  res: ResultadoPesquisa,
  descricaoObjeto: string,
  itensSelecionados: ItemCandidato[],
  indicesSelecionados: number[],
  incluirRevisaoB: boolean,
  idExistente?: string
): RegistroHistoricoPesquisa {
  const id =
    idExistente ||
    `pncp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const nSel = itensSelecionados.length;
  const soma = itensSelecionados.reduce(
    (acc, it) => acc + Number(it.valor_unitario || 0),
    0
  );
  const media = nSel > 0 ? soma / nSel : 0;

  return {
    id,
    dataHoraPesquisa: res.momento_consulta,
    timestampIso: new Date().toISOString(),
    descricaoObjeto: descricaoObjeto.trim() || res.termos_busca.join(", "),
    escopoOrgaos: res.escopo_orgaos,
    ufSelecionada: res.uf_selecionada || null,
    statusAta: res.status_ata,
    periodoAplicado: res.periodo_aplicado_str,
    termosBusca: res.termos_busca,
    incluirRevisaoB,
    indicesSelecionados,
    itensSelecionadosCount: nSel,
    mediaSelecionados: Math.round(media * 100) / 100,
    resultado: res,
  };
}

export function exportarHistoricoJson(
  registros: RegistroHistoricoPesquisa[]
): string {
  return JSON.stringify(
    {
      versao: "2.0.0",
      exportadoEm: new Date().toISOString(),
      registros,
    },
    null,
    2
  );
}

export function importarHistoricoJson(
  jsonStr: string
): RegistroHistoricoPesquisa[] {
  const parsed = JSON.parse(jsonStr);
  const lista = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.registros)
      ? parsed.registros
      : [];

  return lista.filter(
    (r: unknown): r is RegistroHistoricoPesquisa =>
      Boolean(
        r &&
          typeof r === "object" &&
          "id" in r &&
          "dataHoraPesquisa" in r &&
          "resultado" in r
      )
  );
}

function abrirBancoIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponível neste ambiente"));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestampIso", "timestampIso", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function salvarPesquisaHistorico(
  registro: RegistroHistoricoPesquisa
): Promise<void> {
  const db = await abrirBancoIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(registro);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function listarHistoricoPesquisas(): Promise<
  RegistroHistoricoPesquisa[]
> {
  try {
    const db = await abrirBancoIndexedDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const todos = (req.result || []) as RegistroHistoricoPesquisa[];
        todos.sort((a, b) =>
          (b.timestampIso || "").localeCompare(a.timestampIso || "")
        );
        db.close();
        resolve(todos);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return [];
  }
}

export async function removerPesquisaHistorico(id: string): Promise<void> {
  const db = await abrirBancoIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function limparTodoHistorico(): Promise<void> {
  const db = await abrirBancoIndexedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
