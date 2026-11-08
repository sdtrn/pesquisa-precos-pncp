import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  COOKIE_NAME,
  DEFAULT_TTL_SECONDS,
  assinarTokenSessao,
  verificarTokenSessao,
  extrairTokenDosCookies,
  type PayloadSessao,
} from "@/lib/server/session-edge";

describe("Task 2: Utilitário de Sessão Edge-Safe HMAC-SHA256", () => {
  const payloadBase: Omit<PayloadSessao, "exp"> = {
    uid: 42,
    email: "admin@pncp.gov.br",
    nome: "Administrador Geral",
    perfil: "admin",
  };

  test("constantes públicas devem ter os valores corretos", () => {
    assert.equal(COOKIE_NAME, "pncp_sessao");
    assert.equal(DEFAULT_TTL_SECONDS, 7 * 24 * 3600);
  });

  test("deve assinar e verificar token com sucesso (fluxo feliz)", async () => {
    const token = await assinarTokenSessao(payloadBase);
    assert.ok(typeof token === "string" && token.length > 0, "token deve ser string não vazia");
    assert.equal(token.split(".").length, 2, "token deve ter exatamente 2 partes (payload.assinatura)");

    const verificado = await verificarTokenSessao(token);
    assert.ok(verificado !== null, "token válido não deve retornar null");
    assert.equal(verificado.uid, 42);
    assert.equal(verificado.email, "admin@pncp.gov.br");
    assert.equal(verificado.nome, "Administrador Geral");
    assert.equal(verificado.perfil, "admin");
    assert.ok(verificado.exp > Math.floor(Date.now() / 1000), "exp deve ser timestamp futuro");
  });

  test("deve aceitar perfil 'consulta' corretamente", async () => {
    const token = await assinarTokenSessao({
      uid: 10,
      email: "leitor@pncp.gov.br",
      nome: "Leitor Órgão",
      perfil: "consulta",
    });
    const verificado = await verificarTokenSessao(token);
    assert.ok(verificado !== null);
    assert.equal(verificado.perfil, "consulta");
  });

  test("deve rejeitar assinatura adulterada", async () => {
    const token = await assinarTokenSessao(payloadBase);
    const [payloadB64, sigB64] = token.split(".");
    // Modifica o primeiro caractere da assinatura
    const firstChar = sigB64[0] === "a" ? "b" : "a";
    const adulterada = firstChar + sigB64.slice(1);
    const tokenAdulterado = `${payloadB64}.${adulterada}`;

    const verificado = await verificarTokenSessao(tokenAdulterado);
    assert.equal(verificado, null, "assinatura adulterada deve ser rejeitada");
  });

  test("deve rejeitar payload adulterado", async () => {
    const token = await assinarTokenSessao(payloadBase);
    const [, sigB64] = token.split(".");

    // Adultera o payload para perfil admin com outro email
    const payloadFalso: PayloadSessao = {
      ...payloadBase,
      email: "hacker@evil.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const payloadFalsoB64 = Buffer.from(JSON.stringify(payloadFalso)).toString("base64url");
    const tokenAdulterado = `${payloadFalsoB64}.${sigB64}`;

    const verificado = await verificarTokenSessao(tokenAdulterado);
    assert.equal(verificado, null, "payload adulterado com assinatura original deve ser rejeitado");
  });

  test("deve rejeitar token expirado (ttl <= 0 ou no passado)", async () => {
    // ttl 0 ou negativo deve gerar token já expirado
    const tokenExpirado = await assinarTokenSessao(payloadBase, -10);
    const verificado = await verificarTokenSessao(tokenExpirado);
    assert.equal(verificado, null, "token expirado no passado deve retornar null");
  });

  test("deve rejeitar tokens malformados e entradas inválidas", async () => {
    assert.equal(await verificarTokenSessao(null), null);
    assert.equal(await verificarTokenSessao(undefined), null);
    assert.equal(await verificarTokenSessao(""), null);
    assert.equal(await verificarTokenSessao("token_sem_ponto"), null);
    assert.equal(await verificarTokenSessao("p1.p2.p3"), null);
    assert.equal(await verificarTokenSessao("!!invalidbase64!!.sig"), null);

    // Payload que não é JSON
    const notJsonB64 = Buffer.from("not a json string").toString("base64url");
    const fakeToken = `${notJsonB64}.fakesig`;
    assert.equal(await verificarTokenSessao(fakeToken), null);

    // Payload com campos inválidos (ex: perfil desconhecido)
    const payloadPerfilInvalido = {
      uid: 1,
      email: "a@b.com",
      nome: "Teste",
      perfil: "superadmin_invalido",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const b64Inv = Buffer.from(JSON.stringify(payloadPerfilInvalido)).toString("base64url");
    assert.equal(await verificarTokenSessao(`${b64Inv}.qualquersig`), null);

    // Payload com uid não numérico
    const payloadUidInvalido = {
      uid: "1",
      email: "a@b.com",
      nome: "Teste",
      perfil: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const b64UidInv = Buffer.from(JSON.stringify(payloadUidInvalido)).toString("base64url");
    assert.equal(await verificarTokenSessao(`${b64UidInv}.qualquersig`), null);
  });

  test("deve suportar secretOverride e falhar quando a chave for diferente", async () => {
    const secret1 = "chave_secreta_teste_alpha_1234567890";
    const secret2 = "chave_secreta_teste_beta_0987654321";

    const token = await assinarTokenSessao(payloadBase, 3600, secret1);
    
    // Verifica com o mesmo secret
    const ok = await verificarTokenSessao(token, secret1);
    assert.ok(ok !== null);
    assert.equal(ok.uid, payloadBase.uid);

    // Verifica com secret diferente (deve falhar)
    const fail = await verificarTokenSessao(token, secret2);
    assert.equal(fail, null, "deve falhar ao verificar com secret diferente");
  });

  test("extrairTokenDosCookies deve extrair pncp_sessao corretamente", () => {
    assert.equal(extrairTokenDosCookies(null), null);
    assert.equal(extrairTokenDosCookies(undefined), null);
    assert.equal(extrairTokenDosCookies(""), null);
    assert.equal(extrairTokenDosCookies("theme=dark; other=123"), null);

    // Cookie isolado
    assert.equal(extrairTokenDosCookies("pncp_sessao=meu_token_123"), "meu_token_123");

    // Cookie no meio de outros
    const multi = "pref=abc; pncp_sessao=token_sessao_meio.sig456; theme=system";
    assert.equal(extrairTokenDosCookies(multi), "token_sessao_meio.sig456");

    // Cookie no final
    const fim = "pref=abc; theme=system; pncp_sessao=token_fim.789";
    assert.equal(extrairTokenDosCookies(fim), "token_fim.789");

    // Cookie com URL encoding
    const encoded = "pncp_sessao=tok%2Eabc%2D123";
    assert.equal(extrairTokenDosCookies(encoded), "tok.abc-123");
  });
});
