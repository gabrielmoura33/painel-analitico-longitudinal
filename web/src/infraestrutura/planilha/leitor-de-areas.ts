import type ExcelJS from 'exceljs'

import type { LeituraAreasPlanilha, ParTemaArea } from '@/dominio/modelos/planilha'

import { valorTexto } from '@/infraestrutura/planilha/leitor-exceljs'

/**
 * Leitura da planilha que liga tema a área de conhecimento.
 *
 * A planilha do Teste de Progresso traz um tema por questão — 35 questões, 35
 * temas. As áreas amplas com que as docentes pensam o curso ("Atenção
 * Primária", "Urgência e Emergência", "Saúde Mental") não existem na fonte: a
 * professora Meire fez esse mapeamento à mão, fora do sistema, e o entrega
 * como uma segunda planilha.
 *
 * Digitar esse mapeamento tema a tema no editor de curso não se sustenta —
 * são dezenas de temas por aplicação, repetidos a cada semestre. Esta leitura
 * existe para que o trabalho dela entre de uma vez.
 *
 * Como em todo o resto do projeto, ler não é gravar: esta camada devolve os
 * pares e os avisos, e quem decide o que fazer com eles é a docente, na aba de
 * áreas do curso.
 */

const CABECALHO_TEMA = /^(tema|assunto|conte[uú]do|descri[cç][aã]o)/i
const CABECALHO_AREA = /^([aá]rea|eixo|campo)/i

interface Localizacao {
  linhaCabecalho: number
  colunaTema: number
  colunaArea: number
}

/** Procura, nas primeiras linhas da aba, o par de colunas "tema" e "área". */
function localizarColunas(aba: ExcelJS.Worksheet): Localizacao | null {
  const ultimaLinha = Math.min(aba.rowCount, 10)
  const ultimaColuna = Math.min(aba.columnCount, 30)

  for (let linha = 1; linha <= ultimaLinha; linha += 1) {
    let colunaTema = 0
    let colunaArea = 0

    for (let coluna = 1; coluna <= ultimaColuna; coluna += 1) {
      const texto = valorTexto(aba.getRow(linha).getCell(coluna).value)
      if (!texto) continue
      if (colunaTema === 0 && CABECALHO_TEMA.test(texto)) colunaTema = coluna
      else if (colunaArea === 0 && CABECALHO_AREA.test(texto)) colunaArea = coluna
    }

    if (colunaTema > 0 && colunaArea > 0) {
      return { linhaCabecalho: linha, colunaTema, colunaArea }
    }
  }

  return null
}

/**
 * Lê a primeira aba que tenha uma coluna de tema e uma de área.
 *
 * Devolve `null` quando nenhuma aba traz esse par — caso em que a tela pede o
 * arquivo certo, em vez de importar coisa nenhuma.
 */
export function lerAreasDaPlanilha(
  workbook: ExcelJS.Workbook,
  nomeAba?: string
): LeituraAreasPlanilha | null {
  const candidatas = nomeAba
    ? workbook.worksheets.filter((planilha) => planilha.name === nomeAba)
    : workbook.worksheets

  for (const aba of candidatas) {
    const local = localizarColunas(aba)
    if (!local) continue

    const pares: ParTemaArea[] = []
    const avisos: string[] = []
    let temasSemArea = 0

    for (let linha = local.linhaCabecalho + 1; linha <= aba.rowCount; linha += 1) {
      const tema = valorTexto(aba.getRow(linha).getCell(local.colunaTema).value)
      const area = valorTexto(aba.getRow(linha).getCell(local.colunaArea).value)

      if (!tema) continue
      if (!area) {
        temasSemArea += 1
        continue
      }

      pares.push({ tema, area })
    }

    if (pares.length === 0) continue

    if (temasSemArea > 0) {
      avisos.push(
        `${temasSemArea} linha(s) têm tema sem área preenchida e foram ignoradas.`
      )
    }

    return { aba: aba.name, pares, avisos }
  }

  return null
}
