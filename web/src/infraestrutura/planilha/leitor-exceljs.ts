import ExcelJS from 'exceljs'

import type { PerfilImportacao } from '@/dominio/modelos/dominio'
import type {
  ParPercentualNota,
  PreviaAba,
  ResumoAba
} from '@/dominio/modelos/planilha'

/**
 * Leitura bruta de planilhas .xlsx.
 *
 * Esta camada só lê e descreve o arquivo: não interpreta períodos, não
 * normaliza grafias e não grava nada. O reconhecimento, a validação e a carga
 * pertencem ao pipeline de importação.
 */

/** Células de percentual costumam ser fórmulas: o exceljs devolve { formula, result }. */
export function valorNumerico(valor: unknown): number | null {
  if (typeof valor === 'number') return valor
  if (valor && typeof valor === 'object' && 'result' in valor) {
    const resultado = (valor as { result: unknown }).result
    return typeof resultado === 'number' ? resultado : null
  }
  if (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) {
    return Number(valor)
  }
  return null
}

export function valorTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'object') {
    const registro = valor as Record<string, unknown>
    if ('result' in registro) return valorTexto(registro.result)
    if ('text' in registro) return valorTexto(registro.text)
    if ('richText' in registro && Array.isArray(registro.richText)) {
      // Junta os fragmentos antes de aparar: aparar cada um comeria os espaços internos.
      return registro.richText
        .map((parte) => String((parte as { text?: unknown }).text ?? ''))
        .join('')
        .trim()
    }
  }
  return ''
}

/** Converte "A" em 1, "E" em 5, "AA" em 27. */
export function letraParaIndice(letra: string): number {
  const limpa = letra.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(limpa)) return 0
  let indice = 0
  for (const caractere of limpa) {
    indice = indice * 26 + (caractere.charCodeAt(0) - 64)
  }
  return indice
}

/**
 * Cabeçalhos que encerram a faixa de discentes.
 *
 * Nas planilhas da amostra, depois da última pessoa vêm colunas de resumo
 * ("TOTAL DE ACERTOS", "% DE ACERTOS"). Sem esta checagem elas entrariam como
 * discentes chamados "TOTAL DE ACERTOS", e cada uma inflaria a contagem de
 * registros de desempenho.
 */
const CABECALHO_DE_RESUMO = /^(total|m[eé]dia|percentual|soma|%)/i

export function ehColunaDeResumo(cabecalho: string): boolean {
  return CABECALHO_DE_RESUMO.test(cabecalho.trim())
}

/**
 * Abre a planilha a partir dos bytes recebidos.
 *
 * Recebe conteúdo, e não caminho: na web o arquivo chega por upload e pode
 * nunca tocar o disco do servidor. Era a única suposição do ETL que dependia
 * de haver um sistema de arquivos local, e é aqui que ela deixa de existir.
 */
export async function abrirPlanilha(conteudo: Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(conteudo) as unknown as ArrayBuffer)
  return workbook
}

export function resumirAbas(workbook: ExcelJS.Workbook): ResumoAba[] {
  return workbook.worksheets.map((aba) => ({
    nome: aba.name,
    linhas: aba.rowCount,
    colunas: aba.columnCount,
    titulo: valorTexto(aba.getRow(1).getCell(1).value)
  }))
}

export interface ParesPorPeriodo {
  rotuloPeriodo: string
  coluna: number
  pares: ParPercentualNota[]
}

export interface LeituraRegua {
  aba: string
  periodos: ParesPorPeriodo[]
}

/**
 * Lê a aba de conversão de acertos em nota.
 *
 * Espera uma coluna de percentual e uma coluna por período. Os rótulos de
 * período saem do cabeçalho; as notas, das células abaixo — inclusive as
 * mescladas, que o exceljs replica em cada linha da faixa.
 */
export function lerReguaDaPlanilha(
  workbook: ExcelJS.Workbook,
  nomeAba?: string
): LeituraRegua | null {
  const aba = nomeAba
    ? workbook.worksheets.find((planilha) => planilha.name === nomeAba)
    : workbook.worksheets.find((planilha) => planilha.name.trim().toLowerCase().startsWith('nota'))

  if (!aba) return null

  let linhaCabecalho = 0
  let colunaPercentual = 0

  for (let linha = 1; linha <= Math.min(aba.rowCount, 10) && linhaCabecalho === 0; linha += 1) {
    for (let coluna = 1; coluna <= Math.min(aba.columnCount, 15); coluna += 1) {
      const texto = valorTexto(aba.getRow(linha).getCell(coluna).value)
      if (texto === '%' || texto.toLowerCase() === 'percentual') {
        linhaCabecalho = linha
        colunaPercentual = coluna
        break
      }
    }
  }

  if (linhaCabecalho === 0) return null

  const periodos: ParesPorPeriodo[] = []

  for (let coluna = colunaPercentual + 1; coluna <= aba.columnCount; coluna += 1) {
    const rotulo = valorTexto(aba.getRow(linhaCabecalho).getCell(coluna).value)
    if (!rotulo) continue

    const pares: ParPercentualNota[] = []
    for (let linha = linhaCabecalho + 1; linha <= aba.rowCount; linha += 1) {
      const percentual = valorNumerico(aba.getRow(linha).getCell(colunaPercentual).value)
      const nota = valorNumerico(aba.getRow(linha).getCell(coluna).value)
      if (percentual === null || nota === null) continue
      pares.push({ percentual, nota })
    }

    if (pares.length > 0) periodos.push({ rotuloPeriodo: rotulo, coluna, pares })
  }

  return periodos.length > 0 ? { aba: aba.name, periodos } : null
}

export interface QuestaoMatriz {
  numero: number
  gabarito: string
  tema: string
  docente: string
  /** Uma posição por discente, na mesma ordem de `discentes`. */
  acertos: boolean[]
}

export interface MatrizAba {
  aba: string
  titulo: string
  discentes: string[]
  /** Uma posição por discente, na mesma ordem. Vazia quando a planilha não traz matrícula. */
  matriculas: string[]
  questoes: QuestaoMatriz[]
  avisos: string[]
}

/**
 * Lê a matriz discente × questão de uma aba, aplicando o perfil do curso.
 *
 * É a leitura que tanto a pré-visualização quanto a importação usam, para que
 * o que a docente confere na tela seja exatamente o que entra no banco.
 */
export function lerMatriz(
  workbook: ExcelJS.Workbook,
  nomeAba: string,
  perfil: PerfilImportacao
): MatrizAba | null {
  const aba = workbook.worksheets.find((planilha) => planilha.name === nomeAba)
  if (!aba) return null

  const avisos: string[] = []
  const colunaQuestao = letraParaIndice(perfil.colunaQuestao)
  const colunaGabarito = letraParaIndice(perfil.colunaGabarito)
  const colunaTema = letraParaIndice(perfil.colunaTema)
  const colunaDocente = letraParaIndice(perfil.colunaDocente)
  const primeiraColunaAluno = letraParaIndice(perfil.primeiraColunaAluno)

  const discentes: string[] = []
  const matriculas: string[] = []
  const colunasDiscente: number[] = []
  const colunasResumo: string[] = []
  let vaziasSeguidas = 0

  for (let coluna = primeiraColunaAluno; coluna <= aba.columnCount; coluna += 1) {
    const nome = valorTexto(aba.getRow(perfil.linhaCabecalho).getCell(coluna).value)

    if (!nome) {
      vaziasSeguidas += 1
      // Três colunas vazias seguidas encerram a faixa de discentes.
      if (vaziasSeguidas >= 3) break
      continue
    }

    // Colunas de resumo encerram a faixa: depois delas não há mais pessoas.
    if (ehColunaDeResumo(nome)) {
      colunasResumo.push(nome)
      break
    }

    vaziasSeguidas = 0
    discentes.push(nome)
    colunasDiscente.push(coluna)
  }

  if (colunasResumo.length > 0) {
    avisos.push(
      `Coluna de resumo encontrada ("${colunasResumo.join('", "')}"): ` +
        'a leitura de discentes parou nela.'
    )
  }

  /*
   * Matrícula: na planilha os discentes são colunas, então o código não é mais
   * uma coluna — é uma linha a mais no cabeçalho, uma célula sob cada pessoa.
   * Enquanto o perfil não apontar essa linha, a lista sai vazia e o reencontro
   * entre semestres continua por nome.
   */
  if (perfil.linhaMatricula !== null) {
    const linha = aba.getRow(perfil.linhaMatricula)
    for (const coluna of colunasDiscente) {
      matriculas.push(valorTexto(linha.getCell(coluna).value))
    }

    const vazias = matriculas.filter((matricula) => matricula === '').length
    if (vazias > 0) {
      avisos.push(
        `${vazias} discente(s) sem matrícula na linha ${perfil.linhaMatricula}: ` +
          'esses continuam sendo reconhecidos pelo nome.'
      )
    }

    const preenchidas = matriculas.filter((matricula) => matricula !== '')
    const repetidas = preenchidas.filter(
      (matricula, indice) => preenchidas.indexOf(matricula) !== indice
    )
    if (repetidas.length > 0) {
      avisos.push(`Matrícula repetida nesta aba: ${[...new Set(repetidas)].join(', ')}.`)
    }
  }

  const ultimaLinha = perfil.linhaTotal ? perfil.linhaTotal - 1 : aba.rowCount
  const questoes: QuestaoMatriz[] = []

  for (let linha = perfil.linhaCabecalho + 1; linha <= ultimaLinha; linha += 1) {
    const numero = valorNumerico(aba.getRow(linha).getCell(colunaQuestao).value)
    if (numero === null) continue

    const acertos = colunasDiscente.map((coluna) => {
      // Célula vazia é erro: é assim que a planilha registra.
      return valorTexto(aba.getRow(linha).getCell(coluna).value) === perfil.marcadorAcerto
    })

    const tema = valorTexto(aba.getRow(linha).getCell(colunaTema).value)
    const docente = valorTexto(aba.getRow(linha).getCell(colunaDocente).value)
    if (!tema) avisos.push(`Questão ${numero}: sem tema.`)
    if (!docente) avisos.push(`Questão ${numero}: sem docente responsável.`)

    questoes.push({
      numero,
      gabarito: valorTexto(aba.getRow(linha).getCell(colunaGabarito).value),
      tema,
      docente,
      acertos
    })
  }

  if (discentes.length === 0) {
    avisos.push(
      `Nenhum discente encontrado a partir da coluna ${perfil.primeiraColunaAluno}, ` +
        `linha ${perfil.linhaCabecalho}. Confira o mapeamento.`
    )
  }
  if (questoes.length === 0) {
    avisos.push(`Nenhuma questão encontrada na coluna ${perfil.colunaQuestao}.`)
  }

  return {
    aba: aba.name,
    titulo: valorTexto(aba.getRow(1).getCell(1).value),
    discentes,
    matriculas,
    questoes,
    avisos
  }
}

/**
 * Aplica um perfil de importação a uma aba e descreve o que seria lido.
 *
 * Serve à aba de mapeamento de colunas: a docente confere contra um arquivo
 * real antes de importar qualquer coisa. Nada é gravado aqui.
 */
export function previsualizarAba(
  workbook: ExcelJS.Workbook,
  nomeAba: string,
  perfil: PerfilImportacao
): PreviaAba | null {
  const matriz = lerMatriz(workbook, nomeAba, perfil)
  if (!matriz) return null

  return {
    aba: matriz.aba,
    titulo: matriz.titulo,
    discentes: matriz.discentes,
    matriculas: matriz.matriculas,
    questoes: matriz.questoes.map((questao) => ({
      numero: questao.numero,
      gabarito: questao.gabarito,
      tema: questao.tema,
      docente: questao.docente,
      acertos: questao.acertos.filter(Boolean).length
    })),
    totalRegistros: matriz.discentes.length * matriz.questoes.length,
    avisos: matriz.avisos
  }
}
