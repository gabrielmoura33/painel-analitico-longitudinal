/**
 * Normalização de texto.
 *
 * Métodos estáticos porque não há estado a guardar: é vocabulário do domínio,
 * não um colaborador a injetar. `chaveComparacao` é a que mais importa — é
 * ela que faz "Saúde Coletiva", "saude coletiva" e "SAÚDE  COLETIVA" serem a
 * mesma coisa em toda a plataforma.
 */
export class Texto {
  public static aparar(texto: string): string {
    return texto.trim().replace(/\s+/g, ' ')
  }

  /** Chave de comparação: sem acento, sem caixa, sem espaço sobrando. */
  public static chaveComparacao(texto: string): string {
    return Texto.aparar(texto)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
  }
}

/**
 * Rótulos de período.
 *
 * A planilha escreve "6º P", "6º   Período", " 10º P" — variações do mesmo
 * período. A plataforma guarda a forma curta ("6º") e compara por ela.
 */
export class RotuloDePeriodo {
  public static normalizar(rotulo: string): string {
    const numero = rotulo.match(/\d+/)?.[0]
    return numero ? `${numero}º` : rotulo.trim()
  }

  public static saoIguais(a: string, b: string): boolean {
    return RotuloDePeriodo.normalizar(a) === RotuloDePeriodo.normalizar(b)
  }
}
