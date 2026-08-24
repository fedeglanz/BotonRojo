const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Con la Web Crypto del entorno y no con `node:crypto`.
 *
 * Es la misma aleatoriedad —`getRandomValues` en Node, en el edge y en el
 * navegador— pero deja este módulo utilizable en cualquier sitio. Con el import
 * de `node:crypto`, cualquier componente de cliente que tocara `createSlug`
 * —que es una función de texto, sin nada de criptografía— tumbaba la compilación
 * entera con "Reading from node:crypto is not handled by plugins".
 */
export function createId(size = 21): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < size; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function createSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function createAffiliateCode(): string {
  return createId(8).toLowerCase();
}
