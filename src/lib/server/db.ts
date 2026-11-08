import pg, { type Pool } from "pg";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const { Pool: PgPool } = pg;

export const ADMIN_PRINCIPAL_EMAIL = "sergiodantastorres@gmail.com";
export const ADMIN_PRINCIPAL_SENHA_INICIAL = "Recife2026@";
export const ADMIN_PRINCIPAL_NOME = "Sérgio Dantas Torres";

export interface UsuarioPncp {
  id: number;
  email: string;
  nome: string;
  perfil: "admin" | "consulta";
  ativo: boolean;
  ultimo_login: string | Date | null;
  criado_em: string | Date;
}

export interface RegistroAuditoriaPncp {
  id: number;
  usuario_id: number | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_perfil: string | null;
  descricao_objeto: string;
  termos_busca: string | null;
  escopo_orgaos: string | null;
  regiao_ou_uf: string | null;
  apenas_municipios_bilionarios: boolean | null;
  status_ata: string | null;
  tipo_data: string | null;
  periodo_pesquisa: string | null;
  criterio_classificacao: string | null;
  modo_normalizacao: string | null;
  total_atas_varridas: number;
  total_encontrados: number;
  total_selecionados: number;
  total_descartados: number;
  media_estimada: number | null;
  unidade_referencia: string | null;
  duracao_segundos: number | null;
  ip_origem: string | null;
  user_agent: string | null;
  status: string;
  erro_mensagem: string | null;
  executado_em: string | Date;
}

export interface RegistroAcessoPncp {
  id: number;
  usuario_id: number | null;
  email_informado: string;
  usuario_nome: string | null;
  evento: string;
  ip_origem: string | null;
  user_agent: string | null;
  detalhes: string | null;
  ocorrido_em: string | Date;
}

export function hashSenha(senhaPlana: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senhaPlana, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verificarSenha(senhaPlana: string, hashArmazenado: string): boolean {
  if (!senhaPlana || !hashArmazenado || typeof hashArmazenado !== "string") {
    return false;
  }
  try {
    const partes = hashArmazenado.split("$");
    if (partes.length !== 3 || partes[0] !== "scrypt") {
      return false;
    }
    const salt = partes[1];
    const hashEsperadoHex = partes[2];
    if (!salt || !hashEsperadoHex || !/^[0-9a-fA-F]+$/.test(hashEsperadoHex)) {
      return false;
    }
    const hashBufferEsperado = Buffer.from(hashEsperadoHex, "hex");
    if (hashBufferEsperado.length < 16) {
      return false;
    }
    const hashCalculado = crypto.scryptSync(senhaPlana, salt, hashBufferEsperado.length);
    if (hashCalculado.length !== hashBufferEsperado.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashCalculado, hashBufferEsperado);
  } catch {
    return false;
  }
}

export function carregarEnvLocal(): void {
  if (process.env.DATABASE_URL && process.env.ADMIN_EMAIL) {
    return;
  }
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const conteudo = fs.readFileSync(envPath, "utf-8");
    for (const linha of conteudo.split(/\r?\n/)) {
      const linhaLimpa = linha.trim();
      if (!linhaLimpa || linhaLimpa.startsWith("#")) continue;
      const idxIgual = linhaLimpa.indexOf("=");
      if (idxIgual === -1) continue;
      const chave = linhaLimpa.substring(0, idxIgual).trim();
      let valor = linhaLimpa.substring(idxIgual + 1).trim();
      if (
        (valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))
      ) {
        valor = valor.slice(1, -1);
      }
      if (!process.env[chave]) {
        process.env[chave] = valor;
      }
    }
  } catch {
    // fallback silencioso
  }
}

let poolInstance: Pool | null = null;

export function getPool(): Pool {
  carregarEnvLocal();
  if (!poolInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não configurada no ambiente ou .env.local");
    }
    poolInstance = new PgPool({
      connectionString,
      ssl:
        connectionString.includes("sslmode=require") || connectionString.includes("aws.neon.tech")
          ? { rejectUnauthorized: false }
          : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return poolInstance;
}

let inicializado = false;

export async function inicializarBancoPncp(force = false): Promise<void> {
  if (inicializado && !force) return;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Tabela de usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS pncp_usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        perfil VARCHAR(20) NOT NULL DEFAULT 'consulta',
        ativo BOOLEAN NOT NULL DEFAULT FALSE,
        ultimo_login TIMESTAMP WITH TIME ZONE,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2) Tabela de auditoria de consultas no PNCP
    await client.query(`
      CREATE TABLE IF NOT EXISTS pncp_historico_auditoria (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES pncp_usuarios(id) ON DELETE SET NULL,
        usuario_nome VARCHAR(255),
        usuario_email VARCHAR(255),
        usuario_perfil VARCHAR(20),
        descricao_objeto TEXT NOT NULL,
        termos_busca TEXT,
        escopo_orgaos VARCHAR(120),
        regiao_ou_uf VARCHAR(60),
        apenas_municipios_bilionarios BOOLEAN,
        status_ata VARCHAR(60),
        tipo_data VARCHAR(60),
        periodo_pesquisa VARCHAR(100),
        criterio_classificacao VARCHAR(50),
        modo_normalizacao VARCHAR(50),
        total_atas_varridas INT DEFAULT 0,
        total_encontrados INT DEFAULT 0,
        total_selecionados INT DEFAULT 0,
        total_descartados INT DEFAULT 0,
        media_estimada NUMERIC(18,4),
        unidade_referencia VARCHAR(40),
        duracao_segundos NUMERIC(8,2),
        ip_origem VARCHAR(100),
        user_agent VARCHAR(255),
        status VARCHAR(50) DEFAULT 'sucesso',
        erro_mensagem TEXT,
        executado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3) Tabela de logs de acesso e segurança
    await client.query(`
      CREATE TABLE IF NOT EXISTS pncp_acessos_log (
        id SERIAL PRIMARY KEY,
        usuario_id INT REFERENCES pncp_usuarios(id) ON DELETE SET NULL,
        email_informado VARCHAR(255) NOT NULL,
        usuario_nome VARCHAR(255),
        evento VARCHAR(50) NOT NULL,
        ip_origem VARCHAR(100),
        user_agent VARCHAR(255),
        detalhes TEXT,
        ocorrido_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4) Seed idempotente do Administrador Principal
    const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_PRINCIPAL_EMAIL).toLowerCase().trim();
    const adminNome = ADMIN_PRINCIPAL_NOME;
    const senhaHash = hashSenha(ADMIN_PRINCIPAL_SENHA_INICIAL);

    await client.query(
      `
      INSERT INTO pncp_usuarios (email, senha_hash, nome, perfil, ativo)
      VALUES ($1, $2, $3, 'admin', TRUE)
      ON CONFLICT (email) DO UPDATE SET perfil = 'admin', ativo = TRUE;
      `,
      [adminEmail, senhaHash, adminNome]
    );

    await client.query("COMMIT");
    inicializado = true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Mapeadores tipados
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowUsuario(row: any): UsuarioPncp {
  return {
    id: Number(row.id),
    email: row.email,
    nome: row.nome,
    perfil: row.perfil as "admin" | "consulta",
    ativo: Boolean(row.ativo),
    ultimo_login: row.ultimo_login ?? null,
    criado_em: row.criado_em,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowAuditoria(row: any): RegistroAuditoriaPncp {
  return {
    id: Number(row.id),
    usuario_id: row.usuario_id !== null && row.usuario_id !== undefined ? Number(row.usuario_id) : null,
    usuario_nome: row.usuario_nome ?? null,
    usuario_email: row.usuario_email ?? null,
    usuario_perfil: row.usuario_perfil ?? null,
    descricao_objeto: row.descricao_objeto,
    termos_busca: row.termos_busca ?? null,
    escopo_orgaos: row.escopo_orgaos ?? null,
    regiao_ou_uf: row.regiao_ou_uf ?? null,
    apenas_municipios_bilionarios:
      row.apenas_municipios_bilionarios !== null && row.apenas_municipios_bilionarios !== undefined
        ? Boolean(row.apenas_municipios_bilionarios)
        : null,
    status_ata: row.status_ata ?? null,
    tipo_data: row.tipo_data ?? null,
    periodo_pesquisa: row.periodo_pesquisa ?? null,
    criterio_classificacao: row.criterio_classificacao ?? null,
    modo_normalizacao: row.modo_normalizacao ?? null,
    total_atas_varridas: Number(row.total_atas_varridas ?? 0),
    total_encontrados: Number(row.total_encontrados ?? 0),
    total_selecionados: Number(row.total_selecionados ?? 0),
    total_descartados: Number(row.total_descartados ?? 0),
    media_estimada: row.media_estimada !== null && row.media_estimada !== undefined ? Number(row.media_estimada) : null,
    unidade_referencia: row.unidade_referencia ?? null,
    duracao_segundos: row.duracao_segundos !== null && row.duracao_segundos !== undefined ? Number(row.duracao_segundos) : null,
    ip_origem: row.ip_origem ?? null,
    user_agent: row.user_agent ?? null,
    status: row.status ?? "sucesso",
    erro_mensagem: row.erro_mensagem ?? null,
    executado_em: row.executado_em,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowAcesso(row: any): RegistroAcessoPncp {
  return {
    id: Number(row.id),
    usuario_id: row.usuario_id !== null && row.usuario_id !== undefined ? Number(row.usuario_id) : null,
    email_informado: row.email_informado,
    usuario_nome: row.usuario_nome ?? null,
    evento: row.evento,
    ip_origem: row.ip_origem ?? null,
    user_agent: row.user_agent ?? null,
    detalhes: row.detalhes ?? null,
    ocorrido_em: row.ocorrido_em,
  };
}

export async function buscarUsuarioPorEmail(
  email: string
): Promise<(UsuarioPncp & { senha_hash: string }) | null> {
  await inicializarBancoPncp();
  const pool = getPool();
  const res = await pool.query(
    `
    SELECT id, email, nome, perfil, ativo, ultimo_login, criado_em, senha_hash
    FROM pncp_usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1;
    `,
    [email.trim()]
  );

  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    ...mapRowUsuario(row),
    senha_hash: row.senha_hash,
  };
}

export async function buscarUsuarioPorId(id: number): Promise<UsuarioPncp | null> {
  await inicializarBancoPncp();
  const pool = getPool();
  const res = await pool.query(
    `
    SELECT id, email, nome, perfil, ativo, ultimo_login, criado_em
    FROM pncp_usuarios
    WHERE id = $1
    LIMIT 1;
    `,
    [id]
  );

  if (res.rows.length === 0) return null;
  return mapRowUsuario(res.rows[0]);
}

export async function criarSolicitacaoUsuario(dados: {
  nome: string;
  email: string;
  senhaPlana: string;
}): Promise<UsuarioPncp> {
  await inicializarBancoPncp();
  const pool = getPool();
  const emailNorm = dados.email.toLowerCase().trim();
  const hash = hashSenha(dados.senhaPlana);

  const existente = await pool.query(
    "SELECT id FROM pncp_usuarios WHERE LOWER(email) = $1 LIMIT 1;",
    [emailNorm]
  );
  if (existente.rows.length > 0) {
    throw new Error("E-mail já cadastrado no sistema.");
  }

  const res = await pool.query(
    `
    INSERT INTO pncp_usuarios (nome, email, senha_hash, perfil, ativo)
    VALUES ($1, $2, $3, 'consulta', FALSE)
    RETURNING id, email, nome, perfil, ativo, ultimo_login, criado_em;
    `,
    [dados.nome.trim(), emailNorm, hash]
  );
  return mapRowUsuario(res.rows[0]);
}

export async function listarUsuariosPncp(): Promise<UsuarioPncp[]> {
  await inicializarBancoPncp();
  const pool = getPool();
  const res = await pool.query(
    `
    SELECT id, email, nome, perfil, ativo, ultimo_login, criado_em
    FROM pncp_usuarios
    ORDER BY id ASC;
    `
  );
  return res.rows.map(mapRowUsuario);
}

export async function alternarStatusUsuario(
  id: number
): Promise<{ usuario: UsuarioPncp; foiAprovadoAgora: boolean }> {
  await inicializarBancoPncp();
  const pool = getPool();

  const usuarioAtual = await buscarUsuarioPorId(id);
  if (!usuarioAtual) {
    throw new Error("Usuário não encontrado.");
  }

  const emailAdmin = (process.env.ADMIN_EMAIL || ADMIN_PRINCIPAL_EMAIL).toLowerCase().trim();
  if (
    usuarioAtual.email.toLowerCase().trim() === ADMIN_PRINCIPAL_EMAIL.toLowerCase().trim() ||
    usuarioAtual.email.toLowerCase().trim() === emailAdmin
  ) {
    throw new Error("Não é permitido desativar ou alterar o administrador principal.");
  }

  const novoAtivo = !usuarioAtual.ativo;
  const res = await pool.query(
    `
    UPDATE pncp_usuarios
    SET ativo = $1
    WHERE id = $2
    RETURNING id, email, nome, perfil, ativo, ultimo_login, criado_em;
    `,
    [novoAtivo, id]
  );

  return {
    usuario: mapRowUsuario(res.rows[0]),
    foiAprovadoAgora: novoAtivo,
  };
}

export async function alterarPerfilUsuario(
  id: number,
  novoPerfil: "admin" | "consulta"
): Promise<UsuarioPncp> {
  await inicializarBancoPncp();
  const pool = getPool();

  const usuarioAtual = await buscarUsuarioPorId(id);
  if (!usuarioAtual) {
    throw new Error("Usuário não encontrado.");
  }

  const emailAdmin = (process.env.ADMIN_EMAIL || ADMIN_PRINCIPAL_EMAIL).toLowerCase().trim();
  if (
    usuarioAtual.email.toLowerCase().trim() === ADMIN_PRINCIPAL_EMAIL.toLowerCase().trim() ||
    usuarioAtual.email.toLowerCase().trim() === emailAdmin
  ) {
    throw new Error("Não é permitido desativar ou alterar o administrador principal.");
  }

  const res = await pool.query(
    `
    UPDATE pncp_usuarios
    SET perfil = $1
    WHERE id = $2
    RETURNING id, email, nome, perfil, ativo, ultimo_login, criado_em;
    `,
    [novoPerfil, id]
  );

  return mapRowUsuario(res.rows[0]);
}

export async function atualizarUltimoLogin(id: number): Promise<void> {
  await inicializarBancoPncp();
  const pool = getPool();
  await pool.query(
    "UPDATE pncp_usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1;",
    [id]
  );
}

export async function registrarAuditoriaPesquisa(
  dados: Omit<RegistroAuditoriaPncp, "id" | "executado_em">
): Promise<number | null> {
  try {
    await inicializarBancoPncp();
    const pool = getPool();
    const res = await pool.query(
      `
      INSERT INTO pncp_historico_auditoria (
        usuario_id, usuario_nome, usuario_email, usuario_perfil,
        descricao_objeto, termos_busca, escopo_orgaos, regiao_ou_uf,
        apenas_municipios_bilionarios, status_ata, tipo_data, periodo_pesquisa,
        criterio_classificacao, modo_normalizacao, total_atas_varridas,
        total_encontrados, total_selecionados, total_descartados, media_estimada,
        unidade_referencia, duracao_segundos, ip_origem, user_agent, status, erro_mensagem
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25
      ) RETURNING id;
      `,
      [
        dados.usuario_id ?? null,
        dados.usuario_nome ?? null,
        dados.usuario_email ?? null,
        dados.usuario_perfil ?? null,
        dados.descricao_objeto,
        dados.termos_busca ?? null,
        dados.escopo_orgaos ?? null,
        dados.regiao_ou_uf ?? null,
        dados.apenas_municipios_bilionarios ?? null,
        dados.status_ata ?? null,
        dados.tipo_data ?? null,
        dados.periodo_pesquisa ?? null,
        dados.criterio_classificacao ?? null,
        dados.modo_normalizacao ?? null,
        dados.total_atas_varridas ?? 0,
        dados.total_encontrados ?? 0,
        dados.total_selecionados ?? 0,
        dados.total_descartados ?? 0,
        dados.media_estimada ?? null,
        dados.unidade_referencia ?? null,
        dados.duracao_segundos ?? null,
        dados.ip_origem ?? null,
        dados.user_agent ?? null,
        dados.status ?? "sucesso",
        dados.erro_mensagem ?? null,
      ]
    );
    return res.rows[0]?.id ? Number(res.rows[0].id) : null;
  } catch (error) {
    console.error("[db] Falha ao registrar auditoria de pesquisa:", error);
    return null;
  }
}

export async function registrarLogAcesso(
  dados: Omit<RegistroAcessoPncp, "id" | "ocorrido_em">
): Promise<number | null> {
  try {
    await inicializarBancoPncp();
    const pool = getPool();
    const res = await pool.query(
      `
      INSERT INTO pncp_acessos_log (
        usuario_id, email_informado, usuario_nome, evento, ip_origem, user_agent, detalhes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
      `,
      [
        dados.usuario_id ?? null,
        dados.email_informado,
        dados.usuario_nome ?? null,
        dados.evento,
        dados.ip_origem ?? null,
        dados.user_agent ?? null,
        dados.detalhes ?? null,
      ]
    );
    return res.rows[0]?.id ? Number(res.rows[0].id) : null;
  } catch (error) {
    console.error("[db] Falha ao registrar log de acesso:", error);
    return null;
  }
}

export async function listarHistoricoAuditoria(limite = 100): Promise<RegistroAuditoriaPncp[]> {
  await inicializarBancoPncp();
  const pool = getPool();
  const res = await pool.query(
    `
    SELECT *
    FROM pncp_historico_auditoria
    ORDER BY executado_em DESC, id DESC
    LIMIT $1;
    `,
    [Math.max(1, Math.min(limite, 500))]
  );
  return res.rows.map(mapRowAuditoria);
}

export async function listarLogsAcesso(limite = 100): Promise<RegistroAcessoPncp[]> {
  await inicializarBancoPncp();
  const pool = getPool();
  const res = await pool.query(
    `
    SELECT *
    FROM pncp_acessos_log
    ORDER BY ocorrido_em DESC, id DESC
    LIMIT $1;
    `,
    [Math.max(1, Math.min(limite, 500))]
  );
  return res.rows.map(mapRowAcesso);
}
