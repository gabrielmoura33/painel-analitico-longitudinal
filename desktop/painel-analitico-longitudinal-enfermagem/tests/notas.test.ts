import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { calcularNota, demonstrarFaixas, deduzirRegua } from '../src/main/etl/notas'
import { PLANILHA_2025, exigir } from './planilhas'

const PLANILHA = PLANILHA_2025

/** Células de percentual são fórmulas: o exceljs devolve { formula, result }. */
function valorNumerico(valor: unknown): number | null {
  if (typeof valor === 'number') return valor
  if (valor && typeof valor === 'object' && 'result' in valor) {
    const resultado = (valor as { result: unknown }).result
    return typeof resultado === 'number' ? resultado : null
  }
  return null
}

const COLUNA_POR_PERIODO: Record<string, number> = { '6º': 3, '7º': 4, '8º': 5, '9º': 6, '10º': 7 }

const REGUA_OFICIAL = [
  { periodo: '6º', notaBase: 5, percentualMinimo: 50 },
  { periodo: '7º', notaBase: 4, percentualMinimo: 40 },
  { periodo: '8º', notaBase: 3, percentualMinimo: 30 },
  { periodo: '9º', notaBase: 2, percentualMinimo: 20 },
  { periodo: '10º', notaBase: 1, percentualMinimo: 10 }
]

describe('calcularNota — regra do PDF de critérios', () => {
  it('atribui a nota base exatamente no percentual mínimo', () => {
    expect(calcularNota(50, 5, 50)).toBe(5)
    expect(calcularNota(10, 1, 10)).toBe(1)
  })

  it('soma um ponto a cada faixa de dez pontos percentuais', () => {
    expect(calcularNota(51, 5, 50)).toBe(6)
    expect(calcularNota(60, 5, 50)).toBe(6)
    expect(calcularNota(61, 5, 50)).toBe(7)
    expect(calcularNota(100, 5, 50)).toBe(10)
  })

  it('usa a nota base como piso de quem fez a prova', () => {
    // Comportamento lido das células mescladas da planilha das docentes.
    expect(calcularNota(49.9, 5, 50)).toBe(5)
    expect(calcularNota(2.86, 5, 50)).toBe(5)
    expect(calcularNota(0, 1, 10)).toBe(1)
  })

  it('nunca passa de 10', () => {
    expect(calcularNota(100, 1, 10)).toBe(10)
    expect(calcularNota(100, 9, 90)).toBe(10)
  })
})

describe('demonstrarFaixas', () => {
  it('descreve as faixas do 6º período como no PDF', () => {
    expect(demonstrarFaixas(5, 50)).toEqual([
      { nota: 5, percentualInicial: 0, percentualFinal: 50 },
      { nota: 6, percentualInicial: 51, percentualFinal: 60 },
      { nota: 7, percentualInicial: 61, percentualFinal: 70 },
      { nota: 8, percentualInicial: 71, percentualFinal: 80 },
      { nota: 9, percentualInicial: 81, percentualFinal: 90 },
      { nota: 10, percentualInicial: 91, percentualFinal: 100 }
    ])
  })
})

describe('deduzirRegua', () => {
  it('avisa que a régua é ambígua quando falta a faixa da nota base', () => {
    // Sem nenhum par abaixo do mínimo, deslocar nota base e mínimo juntos
    // produz as mesmas notas: a planilha não determina a resposta.
    const pares = [
      { percentual: 51.43, nota: 6 },
      { percentual: 62.86, nota: 7 },
      { percentual: 71.43, nota: 8 },
      { percentual: 82.86, nota: 9 },
      { percentual: 91.43, nota: 10 }
    ]
    const deducao = deduzirRegua(pares)
    expect(deducao?.ambiguo).toBe(true)
    expect(deducao?.candidatos.length).toBeGreaterThan(1)
    expect(deducao?.candidatos).toContainEqual(
      expect.objectContaining({ notaBase: 5, percentualMinimo: 50 })
    )
    expect(deducao?.melhor.divergencias).toHaveLength(0)
  })

  it('reconhece a nota base registrada sobre a primeira linha da planilha', () => {
    // A linha de 1 acerto traz a nota base; com o piso correto ela deixa de
    // ser exceção e passa a confirmar a régua.
    const pares = [
      { percentual: 2.86, nota: 5 },
      { percentual: 51.43, nota: 6 },
      { percentual: 91.43, nota: 10 }
    ]
    const deducao = deduzirRegua(pares)
    expect(deducao?.ambiguo).toBe(false)
    expect(deducao?.melhor.notaBase).toBe(5)
    expect(deducao?.melhor.percentualMinimo).toBe(50)
    expect(deducao?.melhor.divergencias).toHaveLength(0)
  })

  it('não esconde o par que a regra não explica', () => {
    const pares = [
      { percentual: 51.43, nota: 6 },
      { percentual: 62.86, nota: 7 },
      { percentual: 71.43, nota: 2 }
    ]
    const deducao = deduzirRegua(pares)
    expect(deducao?.melhor.divergencias).toEqual([{ percentual: 71.43, nota: 2 }])
  })
})

/*
 * Critério de aceite do projeto: a fórmula precisa reproduzir a aba
 * "Nota TP à partir dos %" da planilha real, linha a linha.
 *
 * A aba usa células mescladas: cada nota cobre a faixa inteira de acertos que
 * a recebe. É daí que vem o piso da nota base — em nenhum período a planilha
 * atribui zero a quem fez a prova. A conferência percorre as 35 linhas de
 * acertos nos cinco períodos, 175 comparações no total.
 */
describe('conferência contra a planilha real', () => {
  const existe = PLANILHA !== null

  it.skipIf(!existe)('reproduz todos os pontos de quebra dos cinco períodos', async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(exigir(PLANILHA))

    const aba = workbook.worksheets.find((planilha) => planilha.name.trim().startsWith('Nota TP'))
    expect(aba, 'aba "Nota TP à partir dos %" não encontrada').toBeDefined()
    if (!aba) return

    let conferidos = 0

    for (const [periodo, coluna] of Object.entries(COLUNA_POR_PERIODO)) {
      const faixa = REGUA_OFICIAL.find((item) => item.periodo === periodo)
      expect(faixa).toBeDefined()
      if (!faixa) continue

      for (let linha = 3; linha <= aba.rowCount; linha += 1) {
        const percentual = valorNumerico(aba.getRow(linha).getCell(2).value)
        const nota = valorNumerico(aba.getRow(linha).getCell(coluna).value)
        if (percentual === null || nota === null) continue

        expect(
          calcularNota(percentual, faixa.notaBase, faixa.percentualMinimo),
          `${periodo}, linha ${linha}, ${percentual.toFixed(2)}%`
        ).toBe(nota)
        conferidos += 1
      }
    }

    expect(conferidos).toBe(175)
  })
})
