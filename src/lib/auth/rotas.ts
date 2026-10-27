export const ROTA_ENTRAR = "/entrar";
export const ROTA_CADASTRO = "/cadastro";
export const ROTA_PAINEL = "/painel";

/** Rotas que exigem login do social media. */
const PREFIXOS_PROTEGIDOS = [ROTA_PAINEL];

/** Rotas que não fazem sentido para quem já está logado. */
const ROTAS_SO_DESLOGADO = [ROTA_ENTRAR, ROTA_CADASTRO];

function casaPrefixo(pathname: string, prefixo: string) {
  return pathname === prefixo || pathname.startsWith(`${prefixo}/`);
}

export function rotaProtegida(pathname: string): boolean {
  return PREFIXOS_PROTEGIDOS.some((p) => casaPrefixo(pathname, p));
}

export function rotaSoDeslogado(pathname: string): boolean {
  return ROTAS_SO_DESLOGADO.some((p) => casaPrefixo(pathname, p));
}

/**
 * Aceita apenas caminhos internos ("/painel/..."), para evitar redirecionamento
 * aberto (ex.: ?proximo=https://site-malicioso.com ou //site-malicioso.com).
 */
export function caminhoSeguro(
  valor: string | null | undefined,
  padrao: string = ROTA_PAINEL,
): string {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return padrao;
  }
  try {
    const url = new URL(valor, "http://interno.invalid");
    if (url.origin !== "http://interno.invalid") return padrao;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return padrao;
  }
}
