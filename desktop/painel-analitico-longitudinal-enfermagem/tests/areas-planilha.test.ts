import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'

import { lerAreasDaPlanilha } from '../src/main/etl/areas'
import { areaDoTema, indiceDeAreas, mesclarAreas } from '../src/shared/areas'
import type { AreaConhecimento } from '../src/shared/types/dominio'

function planilha(linhas: Array<Array<string | null>>, nome = 'Áreas'): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const aba = workbook.addWorksheet(nome)
  for (const linha of linhas) aba.addRow(linha)
  return workbook
}

describe('lerAreasDaPlanilha', () => {
  it('encontra as colunas de tema e área pelo cabeçalho', () => {
    const leitura = lerAreasDaPlanilha(
      planilha([
        ['Mapeamento feito pela coordenação', null],
        ['Tema', 'Área'],
        ['Parada cardiorrespiratória', 'Urgência e Emergência'],
        ['Pré-natal de risco habitual', 'Saúde da Mulher']
      ])
    )

    expect(leitura?.aba).toBe('Áreas')
    expect(leitura?.pares).toEqual([
      { tema: 'Parada cardiorrespiratória', area: 'Urgência e Emergência' },
      { tema: 'Pré-natal de risco habitual', area: 'Saúde da Mulher' }
    ])
  })

  it('aceita "assunto" e "eixo" como sinônimos de tema e área', () => {
    const leitura = lerAreasDaPlanilha(
      planilha([
        ['Assunto', 'Eixo'],
        ['Consulta de enfermagem', 'Atenção Primária']
      ])
    )
    expect(leitura?.pares).toHaveLength(1)
  })

  it('avisa sobre linhas com tema e sem área, em vez de inventar uma', () => {
    const leitura = lerAreasDaPlanilha(
      planilha([
        ['Tema', 'Área'],
        ['Sepse', 'CTI'],
        ['Tema órfão', null]
      ])
    )

    expect(leitura?.pares).toHaveLength(1)
    expect(leitura?.avisos.join(' ')).toContain('sem área preenchida')
  })

  it('devolve nulo quando nenhuma aba tem o par de colunas', () => {
    expect(lerAreasDaPlanilha(planilha([['Questão', 'Gabarito'], [1, 'A'] as never]))).toBeNull()
  })
})

describe('mesclarAreas', () => {
  const atuais: AreaConhecimento[] = [{ nome: 'Gestão', temas: ['Dimensionamento de pessoal'] }]

  it('cria as áreas da planilha e atribui os temas', () => {
    const resultado = mesclarAreas(atuais, [
      { tema: 'Sepse', area: 'CTI' },
      { tema: 'Triagem', area: 'Urgência' }
    ])

    expect(resultado.areasNovas).toEqual(['CTI', 'Urgência'])
    expect(resultado.temasAtribuidos).toBe(2)
    expect(areaDoTema(indiceDeAreas(resultado.areas), 'Sepse')).toBe('CTI')
    // O que a planilha não menciona continua onde estava.
    expect(areaDoTema(indiceDeAreas(resultado.areas), 'Dimensionamento de pessoal')).toBe('Gestão')
  })

  it('a planilha manda: um tema já atribuído muda de área e isso é relatado', () => {
    const resultado = mesclarAreas(atuais, [
      { tema: 'Dimensionamento de pessoal', area: 'Administração em Enfermagem' }
    ])

    expect(resultado.temasMovidos).toEqual(['Dimensionamento de pessoal'])
    expect(areaDoTema(indiceDeAreas(resultado.areas), 'Dimensionamento de pessoal')).toBe(
      'Administração em Enfermagem'
    )
    expect(resultado.areas.find((area) => area.nome === 'Gestão')?.temas).toEqual([])
  })

  it('prevalece a grafia da importação, para não duplicar o tema', () => {
    const resultado = mesclarAreas([], [{ tema: 'sepse  ', area: 'CTI' }], ['Sepse'])

    expect(resultado.areas[0]?.temas).toEqual(['Sepse'])
    expect(resultado.temasDesconhecidos).toEqual([])
  })

  it('aponta tema da planilha que nenhuma importação trouxe', () => {
    const resultado = mesclarAreas([], [{ tema: 'Tema inexistente', area: 'CTI' }], ['Sepse'])

    expect(resultado.temasDesconhecidos).toEqual(['Tema inexistente'])
    expect(resultado.temasSemArea).toEqual(['Sepse'])
  })

  it('não duplica área por diferença de caixa ou acento', () => {
    const resultado = mesclarAreas(
      [{ nome: 'Urgência', temas: [] }],
      [{ tema: 'Sepse', area: 'URGENCIA' }]
    )

    expect(resultado.areas).toHaveLength(1)
    expect(resultado.areasNovas).toEqual([])
  })
})
