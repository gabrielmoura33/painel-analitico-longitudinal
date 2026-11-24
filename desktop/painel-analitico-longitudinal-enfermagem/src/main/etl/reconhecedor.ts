import type ExcelJS from 'exceljs'

import type { PerfilImportacao } from '@compartilhado/types/dominio'
import { normalizarRotuloPeriodo } from '@compartilhado/periodos'

import { letraParaIndice, valorTexto } from './leitor'

/**
 * Reconhecimento das abas de uma planilha.
 *
 * O resultado é sugestão, nunca veredito: o documento executivo registra que
 * há títulos de aba que não correspondem ao conteúdo, então a interface deixa
 * o usuário corrigir cada linha antes de importar.
 */

export type TipoAba = 'desempenho' | 'regua' | 'modelo' | 'derivada' | 'desconhecida'

export interface AbaReconhecida {
  nome: string
  tipo: TipoAba
  /** Período deduzido do título da aba ou do texto da primeira linha. */
  periodoSugerido: string | null
  motivo: string
}

function deduzirPeriodo(...textos: string[]): string | null {
  for (const texto of textos) {
    const encontrado = texto.match(/(\d{1,2})\s*º/)
    if (encontrado) return normalizarRotuloPeriodo(encontrado[0])
  }
  return null
}

function pareceDesempenho(aba: ExcelJS.Worksheet, perfil: PerfilImportacao): boolean {
  const colunaGabarito = letraParaIndice(perfil.colunaGabarito)
  const primeiraColunaAluno = letraParaIndice(perfil.primeiraColunaAluno)
  const linha = aba.getRow(perfil.linhaCabecalho)

  const rotuloGabarito = valorTexto(linha.getCell(colunaGabarito).value)
  const primeiroNome = valorTexto(linha.getCell(primeiraColunaAluno).value)

  return /gabarito/i.test(rotuloGabarito) && primeiroNome.length > 0
}

export function reconhecerAbas(
  workbook: ExcelJS.Workbook,
  perfil: PerfilImportacao
): AbaReconhecida[] {
  return workbook.worksheets.map((aba) => {
    const nome = aba.name
    const titulo = valorTexto(aba.getRow(1).getCell(1).value)
    const nomeNormalizado = nome.trim().toLowerCase()

    if (nomeNormalizado.startsWith('modelo')) {
      return {
        nome,
        tipo: 'modelo',
        periodoSugerido: null,
        motivo: 'Gabarito de referência, sem respostas de discentes.'
      }
    }

    if (nomeNormalizado.startsWith('nota')) {
      return {
        nome,
        tipo: 'regua',
        periodoSugerido: null,
        motivo: 'Tabela de conversão de acertos em nota. A régua usada é a cadastrada no curso.'
      }
    }

    if (/abaixo|acima|resumo|consolidad/i.test(nomeNormalizado)) {
      return {
        nome,
        tipo: 'derivada',
        periodoSugerido: null,
        motivo: 'Aba derivada de outras. Os indicadores são recalculados pela plataforma.'
      }
    }

    if (pareceDesempenho(aba, perfil)) {
      const periodo = deduzirPeriodo(nome, titulo)
      return {
        nome,
        tipo: 'desempenho',
        periodoSugerido: periodo,
        motivo: periodo
          ? `Matriz de acertos reconhecida; período deduzido do título.`
          : 'Matriz de acertos reconhecida, mas não identifiquei o período. Escolha abaixo.'
      }
    }

    return {
      nome,
      tipo: 'desconhecida',
      periodoSugerido: deduzirPeriodo(nome, titulo),
      motivo: 'Não reconheci a estrutura desta aba com o mapeamento do curso.'
    }
  })
}
