/** Normalização de texto usada nos dois processos. */

export function aparar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/** Chave de comparação: sem acento, sem caixa, sem espaço sobrando. */
export function chaveComparacao(texto: string): string {
  return aparar(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}
