import { listarUsuariosPncp } from "@/lib/server/db";
import { exigirAdmin, AuthError } from "@/lib/server/auth";

export async function GET(req: Request): Promise<Response> {
  try {
    await exigirAdmin(req);
    const usuarios = await listarUsuariosPncp();

    return Response.json({ usuarios }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
