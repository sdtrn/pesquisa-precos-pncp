import { NextResponse } from "next/server";
import { PNCPClient } from "@/lib/domain/pncp-client";
import type { ItemCandidato } from "@/lib/domain/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const itens = Array.isArray(body?.itens)
      ? (body.itens as ItemCandidato[])
      : [];

    if (itens.length === 0) {
      return NextResponse.json({ itens: [] });
    }

    const client = new PNCPClient(true);
    await client.enriquecerItensComArquivosAta(itens);

    return NextResponse.json({ itens });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao consultar arquivos da ata: ${String(err)}` },
      { status: 500 }
    );
  }
}
