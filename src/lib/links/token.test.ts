import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gerarToken, hashDoToken, tokenTemFormatoValido, urlDoLink } from "./token";

describe("token do link mágico", () => {
  it("tem 256 bits aleatórios em base64url (43 caracteres, seguro para URL)", () => {
    const token = gerarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("não se repete", () => {
    const tokens = new Set(Array.from({ length: 1000 }, gerarToken));
    expect(tokens.size).toBe(1000);
  });

  it("o hash é SHA-256 em hex, no formato aceito pelo banco", () => {
    const token = gerarToken();
    const hash = hashDoToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hash).not.toContain(token);
  });

  it("valida o formato antes de ir ao banco", () => {
    expect(tokenTemFormatoValido(gerarToken())).toBe(true);
    for (const ruim of ["", "curto", `${gerarToken()}x`, "a".repeat(42) + "!", "../../etc/passwd"]) {
      expect(tokenTemFormatoValido(ruim)).toBe(false);
    }
  });

  it("monta a URL pública /a/<token>", () => {
    expect(urlDoLink("https://app.exemplo.com", "abc")).toBe("https://app.exemplo.com/a/abc");
    expect(urlDoLink("http://localhost:3000/", "abc")).toBe("http://localhost:3000/a/abc");
  });
});
