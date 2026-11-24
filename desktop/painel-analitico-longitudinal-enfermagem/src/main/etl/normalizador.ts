import { aparar, chaveComparacao } from '@compartilhado/texto'

/**
 * Normalização de texto vindo da planilha.
 *
 * A amostra real traz o mesmo docente escrito de formas diferentes — "Meire "
 * com espaço à direita, "NInon" com caixa trocada — e temas com espaços
 * sobrando. Nada disso será corrigido na origem: as docentes informaram que a
 * planilha é a fonte permanente.
 *
 * A regra do projeto: aparar espaços é automático, porque não muda o que está
 * escrito; unificar grafias diferentes exige confirmação humana, porque é
 * decisão sobre o significado.
 */

export { aparar, chaveComparacao } from '@compartilhado/texto'

/**
 * Chave usada para agrupar grafias candidatas a serem a mesma coisa.
 *
 * Além de ignorar caixa, acento e espaço, ignora um número no começo do texto.
 * A amostra traz o mesmo docente como "NInon" em uma aba e "1 NInon" em outra:
 * alguém digitou o número da questão junto do nome. Agrupar não é unificar —
 * a troca continua dependendo de confirmação humana.
 */
export function chaveAgrupamento(texto: string): string {
  return chaveComparacao(texto).replace(/^\d+\s+/, '')
}

/**
 * Duas chaves diferem por no máximo uma edição (inserção, remoção ou troca de
 * um caractere)? Só vale para textos com alguma extensão, para não aproximar
 * nomes curtos que por acaso se parecem.
 */
export function distanciaDeUm(a: string, b: string): boolean {
  if (a === b) return false
  if (Math.min(a.length, b.length) < 5) return false
  if (Math.abs(a.length - b.length) > 1) return false

  const [curta, longa] = a.length <= b.length ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let diferencas = 0

  while (i < curta.length && j < longa.length) {
    if (curta[i] === longa[j]) {
      i += 1
      j += 1
      continue
    }
    diferencas += 1
    if (diferencas > 1) return false
    if (curta.length === longa.length) i += 1
    j += 1
  }

  return true
}

export interface ClusterGrafia {
  /** Grafia proposta como forma única. */
  sugestao: string
  /** Todas as formas encontradas, com quantas vezes cada uma aparece. */
  variantes: Array<{ texto: string; ocorrencias: number }>
}

/**
 * Agrupa grafias que provavelmente são a mesma coisa.
 *
 * Só agrupa o que coincide depois de ignorar caixa, acento e espaço — é uma
 * diferença de digitação, não de conteúdo. "Diagósticos" e "Diagnósticos"
 * continuam separados, porque unir as duas é uma decisão de quem conhece o
 * instrumento, não do programa.
 */
export function agruparGrafias(valores: string[]): ClusterGrafia[] {
  const grupos = new Map<string, Map<string, number>>()

  for (const valor of valores) {
    const original = valor.trim()
    if (!original) continue

    const chave = chaveAgrupamento(original)
    const variantes = grupos.get(chave) ?? new Map<string, number>()
    variantes.set(original, (variantes.get(original) ?? 0) + 1)
    grupos.set(chave, variantes)
  }

  /*
   * Segunda passada: junta grupos que diferem por um caractere só. É o caso da
   * amostra, que traz "Angea" onde deveria haver "Angela" — erro de digitação
   * na origem, que não será corrigido lá. Continua sendo proposta: nada é
   * unificado sem confirmação.
   */
  const chaves = [...grupos.keys()]
  const destino = new Map<string, string>(chaves.map((chave) => [chave, chave]))

  for (let i = 0; i < chaves.length; i += 1) {
    for (let j = i + 1; j < chaves.length; j += 1) {
      const primeira = chaves[i] as string
      const segunda = chaves[j] as string
      if (destino.get(segunda) !== segunda) continue
      if (distanciaDeUm(primeira, segunda)) {
        destino.set(segunda, destino.get(primeira) as string)
      }
    }
  }

  const unidos = new Map<string, Map<string, number>>()
  for (const [chave, variantes] of grupos) {
    const alvo = destino.get(chave) ?? chave
    const atual = unidos.get(alvo) ?? new Map<string, number>()
    for (const [texto, ocorrencias] of variantes) {
      atual.set(texto, (atual.get(texto) ?? 0) + ocorrencias)
    }
    unidos.set(alvo, atual)
  }

  const clusters: ClusterGrafia[] = []

  for (const variantes of unidos.values()) {
    if (variantes.size < 2) continue

    /*
     * A grafia sugerida é a mais frequente; em caso de empate, prefere-se a
     * que não começa com número, que é a forma limpa do nome.
     */
    const comecaComNumero = (texto: string): number => (/^\d/.test(texto) ? 1 : 0)
    const lista = [...variantes.entries()]
      .map(([texto, ocorrencias]) => ({ texto, ocorrencias }))
      .sort(
        (a, b) =>
          b.ocorrencias - a.ocorrencias ||
          comecaComNumero(a.texto) - comecaComNumero(b.texto) ||
          a.texto.localeCompare(b.texto, 'pt-BR')
      )

    clusters.push({ sugestao: aparar(lista[0]?.texto ?? ''), variantes: lista })
  }

  return clusters.sort((a, b) => a.sugestao.localeCompare(b.sugestao, 'pt-BR'))
}

/** Aplica as unificações confirmadas pelo usuário. */
export function aplicarUnificacoes(valor: string, unificacoes: Map<string, string>): string {
  return unificacoes.get(chaveAgrupamento(valor)) ?? aparar(valor)
}

/**
 * Pseudônimo de discente: sigla do curso e um número sequencial estável.
 *
 * O pseudônimo é atribuído na primeira aparição e nunca muda — é ele que
 * sustenta a série longitudinal sem expor nomes nas visões coletivas.
 */
export function proximoPseudonimo(sigla: string, quantidadeExistente: number): string {
  return `${sigla.toUpperCase()}-${String(quantidadeExistente + 1).padStart(3, '0')}`
}
