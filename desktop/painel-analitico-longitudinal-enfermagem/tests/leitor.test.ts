import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  abrirPlanilha,
  letraParaIndice,
  lerReguaDaPlanilha,
  previsualizarAba,
  resumirAbas,
  valorNumerico,
  valorTexto
} from '../src/main/etl/leitor'
import { deduzirRegua } from '../src/main/etl/notas'
import { PERFIL_IMPORTACAO_SUGERIDO } from '../src/shared/constants'
import { PLANILHA_2025, exigir } from './planilhas'

const PLANILHA = PLANILHA_2025
const existe = PLANILHA !== null

describe('utilitários de leitura', () => {
  it('converte letra de coluna em índice', () => {
    expect(letraParaIndice('A')).toBe(1)
    expect(letraParaIndice('E')).toBe(5)
    expect(letraParaIndice('AA')).toBe(27)
    expect(letraParaIndice('')).toBe(0)
  })

  it('extrai o resultado de células de fórmula', () => {
    expect(valorNumerico({ formula: 'A1/35', result: 42.5 })).toBe(42.5)
    expect(valorNumerico('12')).toBe(12)
    expect(valorNumerico('abc')).toBe(null)
  })

  it('remove espaços sobrando dos textos', () => {
    // A amostra tem docentes gravados como "Meire " e "Mônica ".
    expect(valorTexto('  Meire ')).toBe('Meire')
    expect(valorTexto({ richText: [{ text: 'Saúde ' }, { text: 'Coletiva' }] })).toBe('Saúde Coletiva')
  })
})

describe.skipIf(!existe)('leitura da planilha real', () => {
  it('lista as abas do arquivo', async () => {
    const workbook = await abrirPlanilha(exigir(PLANILHA))
    const abas = resumirAbas(workbook).map((aba) => aba.nome.trim())
    expect(abas).toContain('Final 6º P')
    expect(abas).toContain('Final 10º P')
    expect(abas).toContain('Questões abaixo 50%')
  })

  it('lê a régua e deduz a configuração de cada período sem ambiguidade', async () => {
    const workbook = await abrirPlanilha(exigir(PLANILHA))
    const leitura = lerReguaDaPlanilha(workbook)
    expect(leitura).not.toBeNull()
    if (!leitura) return

    expect(leitura.periodos).toHaveLength(5)

    const esperado: Record<string, { notaBase: number; percentualMinimo: number }> = {
      '6º P': { notaBase: 5, percentualMinimo: 50 },
      '7º P': { notaBase: 4, percentualMinimo: 40 },
      '8º P': { notaBase: 3, percentualMinimo: 30 },
      '9º P': { notaBase: 2, percentualMinimo: 20 },
      '10º P': { notaBase: 1, percentualMinimo: 10 }
    }

    for (const periodo of leitura.periodos) {
      const deducao = deduzirRegua(periodo.pares)
      expect(deducao, periodo.rotuloPeriodo).not.toBeNull()
      if (!deducao) continue

      const alvo = esperado[periodo.rotuloPeriodo.trim()]
      expect(alvo, `período inesperado: ${periodo.rotuloPeriodo}`).toBeDefined()
      expect(deducao.ambiguo, periodo.rotuloPeriodo).toBe(false)
      expect(deducao.melhor.notaBase, periodo.rotuloPeriodo).toBe(alvo?.notaBase)
      expect(deducao.melhor.percentualMinimo, periodo.rotuloPeriodo).toBe(alvo?.percentualMinimo)
      expect(deducao.melhor.divergencias, periodo.rotuloPeriodo).toHaveLength(0)
    }
  })

  it('pré-visualiza a aba do 6º período com o perfil sugerido', async () => {
    const workbook = await abrirPlanilha(exigir(PLANILHA))
    const previa = previsualizarAba(workbook, 'Final 6º P', PERFIL_IMPORTACAO_SUGERIDO)
    expect(previa).not.toBeNull()
    if (!previa) return

    expect(previa.questoes).toHaveLength(35)
    expect(previa.discentes).toHaveLength(38)
    expect(previa.totalRegistros).toBe(38 * 35)

    // As colunas de resumo da planilha não podem virar discentes.
    expect(previa.discentes).not.toContain('TOTAL DE ACERTOS')
    expect(previa.discentes).not.toContain('% DE ACERTOS')
    expect(previa.avisos.join(' ')).toMatch(/Coluna de resumo encontrada/)

    const primeira = previa.questoes[0]
    expect(primeira?.numero).toBe(1)
    expect(primeira?.gabarito).toBe('A')
    expect(primeira?.tema).toBe('Territórios, sociodiversidade e multiculturalismo')
    expect(primeira?.acertos).toBeGreaterThan(0)
  })

  it('para a leitura na coluna de resumo em todos os períodos', async () => {
    const workbook = await abrirPlanilha(exigir(PLANILHA))
    const esperado: Record<string, number> = {
      'Final 6º P': 38,
      'Final 7º P': 30,
      'Final 10º P': 41
    }

    for (const [aba, total] of Object.entries(esperado)) {
      const previa = previsualizarAba(workbook, aba, PERFIL_IMPORTACAO_SUGERIDO)
      expect(previa?.discentes, aba).toHaveLength(total)
      expect(previa?.discentes.some((nome) => /total|%/i.test(nome)), aba).toBe(false)
    }
  })

  it('avisa quando o mapeamento não encontra nada', async () => {
    const workbook = await abrirPlanilha(exigir(PLANILHA))
    const previa = previsualizarAba(workbook, 'Final 6º P', {
      ...PERFIL_IMPORTACAO_SUGERIDO,
      primeiraColunaAluno: 'BZ'
    })
    expect(previa?.discentes).toHaveLength(0)
    expect(previa?.avisos.join(' ')).toMatch(/Nenhum discente encontrado/)
  })
})
