import type { Curso, FaixaRegua } from '@compartilhado/types/dominio'
import type {
  AjusteRegua,
  DeducaoRegua,
  ParPercentualNota
} from '@compartilhado/types/planilha'

/**
 * Conversão de percentual de acerto em nota.
 *
 * Cada período tem uma nota base e um percentual mínimo. A partir do mínimo,
 * cada faixa de dez pontos percentuais vale mais um ponto, até o teto de 10.
 *
 * Abaixo do percentual mínimo a nota é a própria nota base — isto é, quem fez
 * a prova nunca fica com menos que ela. Essa parte não vem do PDF de
 * critérios, que só descreve as faixas a partir do mínimo: vem da aba
 * "Nota TP à partir dos %" da planilha das docentes, onde as células mescladas
 * atribuem a nota base a todos os acertos abaixo da primeira faixa. A planilha
 * é o artefato que elas usam de fato, e é ela que a plataforma reproduz. A
 * divergência em relação ao texto do PDF está registrada em
 * docs/decisoes-tecnicas.md.
 *
 * Quem não fez a prova não tem percentual e, portanto, não tem nota: esse caso
 * é ausência de registro, não nota zero.
 *
 * A fórmula é conferida contra todos os pontos de quebra dos cinco períodos da
 * planilha real — ver tests/notas.test.ts.
 */
export type { AjusteRegua, DeducaoRegua, ParPercentualNota }

export function calcularNota(percentual: number, notaBase: number, percentualMinimo: number): number {
  if (!Number.isFinite(percentual)) return notaBase
  if (percentual < percentualMinimo) return notaBase
  const nota = notaBase + Math.ceil((percentual - percentualMinimo) / 10)
  return Math.min(nota, 10)
}

export function faixaDoPeriodo(regua: FaixaRegua[], periodo: string): FaixaRegua | undefined {
  return regua.find((faixa) => faixa.periodo === periodo)
}

/** Nota de um discente em um período, usando a régua configurada no curso. */
export function notaPorCurso(curso: Curso, periodo: string, percentual: number): number | null {
  const faixa = faixaDoPeriodo(curso.regua, periodo)
  if (!faixa) return null
  return calcularNota(percentual, faixa.notaBase, faixa.percentualMinimo)
}

export interface LinhaDemonstrativa {
  nota: number
  percentualInicial: number
  percentualFinal: number
}

/**
 * Faixas resultantes de uma configuração, para a docente conferir na tela o
 * que a régua significa na prática.
 */
export function demonstrarFaixas(notaBase: number, percentualMinimo: number): LinhaDemonstrativa[] {
  const linhas: LinhaDemonstrativa[] = [
    { nota: notaBase, percentualInicial: 0, percentualFinal: percentualMinimo }
  ]

  let nota = notaBase + 1
  let inicio = percentualMinimo
  while (nota <= 10) {
    linhas.push({ nota, percentualInicial: inicio + 1, percentualFinal: Math.min(inicio + 10, 100) })
    inicio += 10
    nota += 1
  }
  return linhas
}

/**
 * Deduz a régua de um período a partir dos pares (percentual, nota) lidos de
 * uma planilha.
 *
 * Procura as configurações de nota base e percentual mínimo que explicam o
 * maior número de pares e devolve os pares que sobraram, para que o usuário
 * veja o que a planilha diz e o que a regra não explica.
 *
 * A dedução é frequentemente ambígua, e isso não é defeito do algoritmo: se os
 * pares observados não incluírem nenhum valor abaixo do percentual mínimo,
 * deslocar nota base e mínimo juntos produz exatamente as mesmas notas, e
 * várias configurações explicam os mesmos dados. Nesse caso a função devolve
 * todos os candidatos com `ambiguo: true`, e cabe ao usuário escolher — nada é
 * decidido em silêncio. Na planilha real a ambiguidade não aparece, porque as
 * células mescladas registram a nota base desde o primeiro acerto.
 *
 * O percentual mínimo é procurado apenas em múltiplos de dez, que é como a
 * régua do instrumento é escrita.
 */
export function deduzirRegua(pares: ParPercentualNota[]): DeducaoRegua | null {
  if (pares.length === 0) return null

  const ajustes: AjusteRegua[] = []

  for (let notaBase = 1; notaBase <= 10; notaBase += 1) {
    for (let percentualMinimo = 0; percentualMinimo <= 100; percentualMinimo += 10) {
      const divergencias = pares.filter(
        (par) => calcularNota(par.percentual, notaBase, percentualMinimo) !== par.nota
      )
      ajustes.push({
        notaBase,
        percentualMinimo,
        paresConferidos: pares.length - divergencias.length,
        divergencias
      })
    }
  }

  const melhorContagem = Math.max(...ajustes.map((ajuste) => ajuste.paresConferidos))
  const candidatos = ajustes.filter((ajuste) => ajuste.paresConferidos === melhorContagem)
  const melhor = candidatos[0] as AjusteRegua

  return { melhor, candidatos, ambiguo: candidatos.length > 1 }
}
