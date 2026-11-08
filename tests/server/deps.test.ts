import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 1: Dependências e Configuração de Ambiente", () => {
  test("deve importar Pool do pacote pg", async () => {
    const pgModule = await import("pg");
    const pg = (pgModule.default ?? pgModule) as unknown as { Pool?: unknown };
    assert.ok(pgModule, "módulo pg deve existir");
    assert.equal(typeof pg.Pool, "function", "Pool deve ser uma função/construtor");
  });

  test("deve importar createTransport do pacote nodemailer", async () => {
    const nmModule = await import("nodemailer");
    const nm = (nmModule.default ?? nmModule) as unknown as { createTransport?: unknown };
    assert.ok(nmModule, "módulo nodemailer deve existir");
    assert.equal(typeof nm.createTransport, "function", "createTransport deve ser uma função");
  });

  test("deve garantir que .gitignore ignora arquivos .env", () => {
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    assert.ok(fs.existsSync(gitignorePath), ".gitignore deve existir");
    const content = fs.readFileSync(gitignorePath, "utf-8");
    assert.match(content, /\.env\*/, ".gitignore deve conter padrão para ignorar .env*");
  });

  test("deve conter as variáveis obrigatórias em .env.local", () => {
    const envLocalPath = path.resolve(process.cwd(), ".env.local");
    assert.ok(fs.existsSync(envLocalPath), ".env.local deve existir");
    const content = fs.readFileSync(envLocalPath, "utf-8");
    assert.match(content, /DATABASE_URL=/, "deve definir DATABASE_URL");
    assert.match(content, /SESSION_SECRET=/, "deve definir SESSION_SECRET");
    assert.match(content, /SMTP_HOST=/, "deve definir SMTP_HOST");
    assert.match(content, /SMTP_PORT=/, "deve definir SMTP_PORT");
    assert.match(content, /SMTP_USER=/, "deve definir SMTP_USER");
    assert.match(content, /SMTP_PASS=/, "deve definir SMTP_PASS");
    assert.match(content, /ADMIN_EMAIL=/, "deve definir ADMIN_EMAIL");
  });
});
