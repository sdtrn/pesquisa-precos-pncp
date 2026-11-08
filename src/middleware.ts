/**
 * Next.js Edge Middleware de Proteção Global e RBAC
 *
 * Utiliza o utilitário de sessão Edge-Safe (Web Crypto HMAC-SHA256)
 * para validar autenticação e perfis de acesso em tempo de borda (Edge Runtime).
 *
 * Não utiliza dependências exclusivas do Node.js nem imports pesados de next/server,
 * permitindo execução pura, ultrarrápida e compatível com suítes de teste nativas.
 */

import {
  extrairTokenDosCookies,
  verificarTokenSessao,
} from "@/lib/server/session-edge";

export type DecisaoMiddleware =
  | { acao: "allow" }
  | { acao: "redirect"; destino: string }
  | { acao: "json"; status: 401 | 403; body: { error: string } };

/**
 * Função pura de avaliação de rotas e políticas de controle de acesso (RBAC).
 * Desacoplada do objeto Request para facilidade máxima de testes unitários.
 */
export async function avaliarRotaMiddleware(
  pathname: string,
  search: string,
  cookieHeader?: string | null
): Promise<DecisaoMiddleware> {
  // 1. Assets estáticos e recursos públicos imutáveis
  if (
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/icon.svg" ||
    pathname.startsWith("/_next/")
  ) {
    return { acao: "allow" };
  }

  // 2. Endpoints públicos de autenticação (/api/auth/*)
  if (pathname.startsWith("/api/auth/")) {
    return { acao: "allow" };
  }

  // Extração e verificação criptográfica do token de sessão (HMAC-SHA256)
  const token = extrairTokenDosCookies(cookieHeader);
  const sessao = token ? await verificarTokenSessao(token) : null;

  // 3. Páginas públicas de autenticação (/login, /cadastro)
  if (pathname === "/login" || pathname === "/cadastro") {
    // Se o usuário já possui sessão ativa válida, redireciona para a raiz
    if (sessao !== null) {
      return { acao: "redirect", destino: "/" };
    }
    return { acao: "allow" };
  }

  // 4. Rotas de API protegidas
  if (pathname.startsWith("/api/")) {
    if (!sessao) {
      return {
        acao: "json",
        status: 401,
        body: {
          error: "Sessão expirada ou não autenticada. Faça login para continuar.",
        },
      };
    }

    // RBAC em APIs restritas ao perfil 'admin'
    if (
      (pathname.startsWith("/api/usuarios") || pathname.startsWith("/api/historico")) &&
      sessao.perfil !== "admin"
    ) {
      return {
        acao: "json",
        status: 403,
        body: {
          error: "Acesso restrito ao Administrador do sistema.",
        },
      };
    }

    return { acao: "allow" };
  }

  // 5. Páginas protegidas da aplicação (/, /usuarios, /historico, etc.)
  if (!sessao) {
    const redirectTarget =
      pathname === "/"
        ? "/login"
        : `/login?redirect=${encodeURIComponent(pathname + (search || ""))}`;
    return {
      acao: "redirect",
      destino: redirectTarget,
    };
  }

  // RBAC em páginas exclusivas do perfil 'admin'
  if (
    (pathname.startsWith("/usuarios") || pathname.startsWith("/historico")) &&
    sessao.perfil !== "admin"
  ) {
    return {
      acao: "redirect",
      destino: "/",
    };
  }

  return { acao: "allow" };
}

/**
 * Handler principal do Edge Middleware do Next.js
 */
export async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieHeader = req.headers.get("cookie");
  const decisao = await avaliarRotaMiddleware(url.pathname, url.search, cookieHeader);

  if (decisao.acao === "redirect") {
    return Response.redirect(new URL(decisao.destino, req.url), 307);
  }

  if (decisao.acao === "json") {
    return Response.json(decisao.body, { status: decisao.status });
  }

  // Permite prosseguir definindo o cabeçalho interno do Next.js
  return new Response(null, {
    headers: {
      "x-middleware-next": "1",
    },
  });
}

/**
 * Configuração de rotas interceptadas pelo middleware
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.svg).*)"],
};
