import type { FaixaRegua } from '@/dominio/modelos/dominio'
import type { AjusteRegua, DeducaoRegua, ParPercentualNota } from '@/dominio/modelos/planilha'

export interface LinhaDemonstrativa {
  nota: number
  percentualInicial: number
  percentualFinal: number
}

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
 * é o artefato que elas usam de fato, e é ela que a plataforma reproduz.
 *
 * Quem não fez a prova não tem percentual e, portanto, não tem nota: esse caso
 * é ausência de registro, não nota zero.
 *
 * Nenhuma nota é gravada: a régua é aplicada na leitura. Mudar a régua de um
 * curso recalcula todos os painéis na hora, sem reimportar nada — e é por isso
 * que ela é um objeto que o curso carrega, não uma coluna no banco.
 */
export class Regua {
  public constructor(private readonly faixas: readonly FaixaRegua[]) {}

  /** Nota de um percentual dentro de uma faixa já escolhida. */
  public static calcular(percentual: number, notaBase: number, percentualMinimo: number): number {
    if (!Number.isFinite(percentual)) return notaBase
    if (percentual < percentualMinimo) return notaBase
    const nota = notaBase + Math.ceil((percentual - percentualMinimo) / 10)
    return Math.min(nota, 10)
  }

  public faixaDoPeriodo(periodo: string): FaixaRegua | undefined {
    return this.faixas.find((faixa) => faixa.periodo === periodo)
  }

  /** Nota de um discente num período. Nulo quando o período não tem faixa. */
  public notaDoPeriodo(periodo: string, percentual: number): number | null {
    const faixa = this.faixaDoPeriodo(periodo)
    if (!faixa) return null
    return Regua.calcular(percentual, faixa.notaBase, faixa.percentualMinimo)
  }

  /** Quem alcançou o mínimo esperado para o período. */
  public alcancaMinimo(periodo: string, percentual: number): boolean | null {
    const faixa = this.faixaDoPeriodo(periodo)
    if (!faixa) return null
    return percentual >= faixa.percentualMinimo
  }

  /**
   * Faixas resultantes de uma configuração, para a docente conferir na tela o
   * que a régua significa na prática.
   */
  public static demonstrarFaixas(notaBase: number, percentualMinimo: number): LinhaDemonstrativa[] {
    const linhas: LinhaDemonstrativa[] = [
      { nota: notaBase, percentualInicial: 0, percentualFinal: percentualMinimo }
    ]

    let nota = notaBase + 1
    let inicio = percentualMinimo
    while (nota <= 10) {
      linhas.push({
        nota,
        percentualInicial: inicio + 1,
        percentualFinal: Math.min(inicio + 10, 100)
      })
      inicio += 10
      nota += 1
    }
    return linhas
  }
}

/**
 * Deduz a régua de um período a partir dos pares (percentual, nota) lidos de
 * uma planilha.
 *
 * Classe à parte porque é outra responsabilidade: `Regua` aplica uma regra
 * conhecida, o dedutor descobre qual regra explica os dados. Juntá-las faria
 * de `Regua` dois objetos com um nome só.
 *
 * A dedução é frequentemente ambígua, e isso não é defeito do algoritmo: se os
 * pares observados não incluírem nenhum valor abaixo do percentual mínimo,
 * deslocar nota base e mínimo juntos produz exatamente as mesmas notas. Nesse
 * caso devolve todos os candidatos com `ambiguo: true`, e cabe ao usuário
 * escolher — nada é decidido em silêncio.
 */
export class DedutorDeRegua {
  /** A régua do instrumento é escrita em múltiplos de dez. */
  private static readonly PASSO_PERCENTUAL = 10

  public deduzir(pares: readonly ParPercentualNota[]): DeducaoRegua | null {
    if (pares.length === 0) return null

    const ajustes: AjusteRegua[] = []

    for (let notaBase = 1; notaBase <= 10; notaBase += 1) {
      for (
        let percentualMinimo = 0;
        percentualMinimo <= 100;
        percentualMinimo += DedutorDeRegua.PASSO_PERCENTUAL
      ) {
        const divergencias = pares.filter(
          (par) => Regua.calcular(par.percentual, notaBase, percentualMinimo) !== par.nota
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
}
