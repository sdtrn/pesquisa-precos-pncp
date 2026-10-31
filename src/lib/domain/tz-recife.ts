import {
  DATA_ASSINATURA,
  DATA_PUBLICACAO,
  DATA_VIGENCIA,
  STATUS_NAO_VIGENTES,
  STATUS_TODOS,
  STATUS_VIGENTES,
} from "@/data/constants";

/**
 * Converte uma string de data ou data/hora do PNCP para string "YYYY-MM-DD" no calendário
 * do fuso `America/Recife`, sem deslocar um dia por causa de UTC.
 */
export function parseDataCalendarioRecife(valor?: string | null): string | null {
  if (!valor || typeof valor !== "string") {
    return null;
  }
  const s = valor.trim();
  if (!s) {
    return null;
  }

  // Caso 1: Data pura YYYY-MM-DD (10 caracteres)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      return s;
    }
    return null;
  }

  // Caso 2: Timestamp ISO-8601 (ex.: "2025-11-05T16:09:30.442963" ou com offset / Z)
  try {
    let normalizado = s;
    // Trunca nanosegundos/microssegundos (> 3 dígitos após o ponto) para compatibilidade com Date()
    normalizado = normalizado.replace(/\.(\d{3})\d+/, ".$1");

    // Se o timestamp não tiver sufixo de fuso ('Z' ou '+HH:MM' / '-HH:MM' após o 'T'),
    // os horários do PNCP já estão no horário de Brasília/Recife (UTC-3).
    const temOffsetExplicito = /T.*[Z+-]\d*:?\d*$/i.test(normalizado);
    if (!temOffsetExplicito && normalizado.includes("T")) {
      normalizado = `${normalizado}-03:00`;
    }

    const parsed = new Date(normalizado);
    if (Number.isNaN(parsed.getTime())) {
      const m10 = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m10 ? m10[1] : null;
    }

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Recife",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(parsed);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    const m10 = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m10) return m10[1];
  }

  return null;
}

/**
 * Formata uma data "YYYY-MM-DD" para "DD/MM/YYYY" ou retorna "não informado".
 */
export function formatarDataBr(isoDate?: string | null): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "não informado";
  }
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Retorna a data de hoje ("YYYY-MM-DD") no fuso `America/Recife`.
 */
export function hojeRecifeIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a data e hora atual ("DD/MM/YYYY HH:MM:SS") no fuso `America/Recife`.
 */
export function agoraRecifeFormatado(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Verifica localmente se a ata cumpre o filtro de período no calendário `America/Recife`.
 */
export function verificarPeriodoLocal(
  tipoData: string,
  dataInicial: string | null,
  dataFinal: string | null,
  dtAssinatura: string | null,
  dtPublicacao: string | null,
  dtIniVigencia: string | null,
  dtFimVigencia: string | null
): {
  dentroDoPeriodo: boolean;
  requerRevisaoBPorDataAusente: boolean;
  detalheMotivo: string;
} {
  const ini = dataInicial?.trim() || null;
  const fim = dataFinal?.trim() || null;

  if (!ini && !fim) {
    return {
      dentroDoPeriodo: true,
      requerRevisaoBPorDataAusente: false,
      detalheMotivo: "Sem restrição de período",
    };
  }

  if (tipoData === DATA_ASSINATURA) {
    if (!dtAssinatura) {
      return {
        dentroDoPeriodo: true,
        requerRevisaoBPorDataAusente: true,
        detalheMotivo:
          "Data de assinatura ausente na API (marcado como B para revisão manual)",
      };
    }
    if (ini && dtAssinatura < ini) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    if (fim && dtAssinatura > fim) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    return {
      dentroDoPeriodo: true,
      requerRevisaoBPorDataAusente: false,
      detalheMotivo: `Assinatura em ${formatarDataBr(dtAssinatura)}`,
    };
  }

  if (tipoData === DATA_PUBLICACAO) {
    if (!dtPublicacao) {
      return {
        dentroDoPeriodo: true,
        requerRevisaoBPorDataAusente: true,
        detalheMotivo:
          "Data de publicação ausente na API (marcado como B para revisão manual)",
      };
    }
    if (ini && dtPublicacao < ini) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    if (fim && dtPublicacao > fim) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    return {
      dentroDoPeriodo: true,
      requerRevisaoBPorDataAusente: false,
      detalheMotivo: `Publicação em ${formatarDataBr(dtPublicacao)}`,
    };
  }

  if (tipoData === DATA_VIGENCIA) {
    if (!dtIniVigencia && !dtFimVigencia) {
      return {
        dentroDoPeriodo: true,
        requerRevisaoBPorDataAusente: true,
        detalheMotivo:
          "Datas de vigência ausentes na API (marcado como B para revisão manual)",
      };
    }
    if (ini && dtFimVigencia && dtFimVigencia < ini) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    if (fim && dtIniVigencia && dtIniVigencia > fim) {
      return { dentroDoPeriodo: false, requerRevisaoBPorDataAusente: false, detalheMotivo: "fora do período" };
    }
    return {
      dentroDoPeriodo: true,
      requerRevisaoBPorDataAusente: false,
      detalheMotivo: `Vigência ${formatarDataBr(dtIniVigencia)} a ${formatarDataBr(dtFimVigencia)}`,
    };
  }

  return {
    dentroDoPeriodo: true,
    requerRevisaoBPorDataAusente: false,
    detalheMotivo: "Período verificado",
  };
}

/**
 * Confere localmente o status de vigência da ata no calendário `America/Recife` (Regra R4).
 */
export function verificarStatusLocal(
  statusUi: string,
  dtIniVigencia: string | null,
  dtFimVigencia: string | null,
  cancelado: boolean,
  hojeRecife: string
): { divergencia: boolean; mensagem: string } {
  if (cancelado) {
    return {
      divergencia: true,
      mensagem: "Ata sinalizada como CANCELADA na API (revisão manual B - R4)",
    };
  }

  if (statusUi === STATUS_TODOS) {
    return { divergencia: false, mensagem: "Status Todos" };
  }

  if (!dtFimVigencia) {
    return {
      divergencia: true,
      mensagem: "Data final de vigência não informada para conferência local de status",
    };
  }

  const vigenteLocal = dtFimVigencia >= hojeRecife;
  if (statusUi === STATUS_VIGENTES && !vigenteLocal) {
    return {
      divergencia: true,
      mensagem: `Divergência API vs Local: retornada em 'Vigentes' pela API, mas fim de vigência local (${formatarDataBr(dtFimVigencia)}) < hoje (${formatarDataBr(hojeRecife)})`,
    };
  }
  if (statusUi === STATUS_NAO_VIGENTES && vigenteLocal) {
    return {
      divergencia: true,
      mensagem: `Divergência API vs Local: retornada em 'Não vigentes' pela API, mas fim de vigência local (${formatarDataBr(dtFimVigencia)}) >= hoje (${formatarDataBr(hojeRecife)})`,
    };
  }

  return {
    divergencia: false,
    mensagem: "Status conferido localmente sem divergência",
  };
}
