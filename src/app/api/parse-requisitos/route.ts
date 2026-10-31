import { NextResponse } from "next/server";
import {
  extrairRequisitosMinimos,
  gerarTermosBusca,
} from "@/lib/domain/parser-requisitos";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const descricao = String(body?.descricao || "").trim();

    if (!descricao) {
      return NextResponse.json(
        { error: "A descrição do objeto não pode estar vazia." },
        { status: 400 }
      );
    }

    const termos = gerarTermosBusca(descricao);
    const requisitos = extrairRequisitosMinimos(descricao);

    return NextResponse.json({
      termos,
      requisitos,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao extrair requisitos: ${String(err)}` },
      { status: 500 }
    );
  }
}
