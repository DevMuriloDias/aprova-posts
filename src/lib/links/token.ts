import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 32 bytes aleatórios (256 bits) em base64url: 43 caracteres. */
const BYTES_DO_TOKEN = 32;
const FORMATO_DO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function gerarToken(): string {
  return randomBytes(BYTES_DO_TOKEN).toString("base64url");
}

/** Só o hash vai para o banco. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Descarta na hora URLs malformadas, sem consultar o banco. */
export function tokenTemFormatoValido(token: string): boolean {
  return FORMATO_DO_TOKEN.test(token);
}

export function urlDoLink(siteUrl: string, token: string): string {
  return new URL(`/a/${token}`, siteUrl).toString();
}
