/**
 * Rótulos de período.
 *
 * A planilha escreve "6º P", "6º   Período", " 10º P" — variações do mesmo
 * período. A plataforma guarda a forma curta ("6º") e compara por ela.
 */
export function normalizarRotuloPeriodo(rotulo: string): string {
  const numero = rotulo.match(/\d+/)?.[0]
  return numero ? `${numero}º` : rotulo.trim()
}

export function mesmoPeriodo(a: string, b: string): boolean {
  return normalizarRotuloPeriodo(a) === normalizarRotuloPeriodo(b)
}
