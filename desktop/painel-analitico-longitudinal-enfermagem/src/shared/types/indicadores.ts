/** Indicadores calculados sobre o modelo canônico. */

export interface ResumoAplicacao {
  _id: string
  rotulo: string
  ano: number
  semestre: number
  dataImportacao: string
}

export interface ValorPorComponente {
  nome: string
  percentual: number
  questoes: number
}

export interface PontoSerie {
  rotulo: string
  percentualMedio: number
  notaMedia: number
  discentes: number
}

export interface LinhaPeriodo {
  periodo: string
  percentualMedio: number
  notaMedia: number
  discentes: number
}

export interface FaixaDistribuicao {
  nota: number
  quantidade: number
  percentual: number
}

export type SituacaoArea = 'critica' | 'atencao' | 'boa'

export interface LinhaArea {
  tema: string
  questoes: number
  percentual: number
  /** Média da mesma área nas aplicações anteriores; nulo quando não há histórico. */
  percentualHistorico: number | null
  variacao: number | null
  situacao: SituacaoArea
}

export type TipoDestaque = 'acima' | 'atencao' | 'destaque'

export interface Destaque {
  tipo: TipoDestaque
  titulo: string
  detalhe: string
}

export interface VisaoGeral {
  cursoNome: string
  aplicacao: ResumoAplicacao
  kpis: {
    percentualMedio: number
    acertosMedios: number
    totalQuestoes: number
    notaMedia: number
    totalDiscentes: number
    areasCriticas: number
  }
  porComponente: ValorPorComponente[]
  variacao: { percentualMedio: number | null; notaMedia: number | null }
  serie: PontoSerie[]
  porPeriodo: LinhaPeriodo[]
  distribuicaoNotas: FaixaDistribuicao[]
  destaques: Destaque[]
  areas: LinhaArea[]
}

export interface DispersaoArea {
  tema: string
  minimo: number
  q1: number
  mediana: number
  q3: number
  maximo: number
  media: number
}

export interface LinhaDiscenteTurma {
  discenteId: string
  pseudonimo: string
  acertos: number
  totalQuestoes: number
  percentual: number
  nota: number
  /** Diferença em pontos percentuais para a aplicação anterior do mesmo discente. */
  variacao: number | null
  porComponente: ValorPorComponente[]
}

export interface VisaoTurma {
  cursoNome: string
  aplicacao: ResumoAplicacao
  periodo: string
  periodosDisponiveis: string[]
  kpis: {
    totalDiscentes: number
    acertosMedios: number
    totalQuestoes: number
    percentualMedio: number
    notaMedia: number
    percentualAcimaDoMinimo: number
  }
  histograma: Array<{ faixa: string; quantidade: number }>
  dispersaoPorArea: DispersaoArea[]
  discentes: LinhaDiscenteTurma[]
  comparativoPeriodos: LinhaPeriodo[]
}

export interface ContextoPainel {
  cursoId: string | null
  aplicacaoId: string | null
  cursos: Array<{ _id: string; nome: string; sigla: string }>
  aplicacoes: ResumoAplicacao[]
}

/* ---------- Fase 6: áreas, questões, discente e docentes ---------- */

export interface CelulaMatriz {
  periodo: string
  percentual: number | null
  questoes: number
  respondentes: number
}

export interface LinhaMatrizArea {
  area: string
  percentualGeral: number
  celulas: CelulaMatriz[]
}

export interface PontoEvolucaoArea {
  area: string
  valores: Array<{ rotulo: string; percentual: number | null }>
}

export interface VisaoAreas {
  cursoNome: string
  aplicacao: ResumoAplicacao
  /** Falso quando o curso ainda não cadastrou o agrupamento de temas. */
  agrupadoPorArea: boolean
  temasSemArea: number
  areas: LinhaArea[]
  periodos: string[]
  matriz: LinhaMatrizArea[]
  evolucao: { rotulos: string[]; series: PontoEvolucaoArea[] }
}

export type Dificuldade = 'facil' | 'media' | 'dificil'

export interface LinhaQuestao {
  numero: number
  tema: string
  area: string
  gabarito: string
  docente: string
  componente: string
  percentual: number
  dificuldade: Dificuldade
  porPeriodo: Array<{ periodo: string; percentual: number | null }>
  /** Abaixo de 50% de acerto em todos os períodos em que foi aplicada. */
  criticaEmTodosOsPeriodos: boolean
}

export interface VisaoQuestoes {
  cursoNome: string
  aplicacao: ResumoAplicacao
  periodos: string[]
  questoes: LinhaQuestao[]
  totalCriticas: number
  /**
   * A planilha registra apenas se o discente acertou, nunca a alternativa que
   * ele marcou. A distribuição de alternativas pedida no levantamento não é
   * calculável com esta fonte.
   */
  distribuicaoAlternativasDisponivel: false
}

export interface DiscenteEncontrado {
  _id: string
  nomeCompleto: string
  matricula: string | null
  pseudonimo: string
  aplicacoes: number
}

export interface PontoTrajetoria {
  rotulo: string
  periodo: string
  acertos: number
  total: number
  percentual: number
  nota: number
  percentualDaTurma: number
}

export interface AreaDoDiscente {
  area: string
  valores: Array<{ rotulo: string; percentual: number | null }>
  ultimoPercentual: number | null
  mediaDaTurma: number | null
  variacao: number | null
}

export interface AlertaDiscente {
  tipo: 'atencao' | 'evolucao'
  titulo: string
  detalhe: string
}

export interface VisaoDiscente {
  cursoNome: string
  nomeCompleto: string
  matricula: string | null
  pseudonimo: string
  trajetoria: PontoTrajetoria[]
  areas: AreaDoDiscente[]
  alertas: AlertaDiscente[]
  ultimo: {
    rotulo: string
    acertos: number
    totalQuestoes: number
    percentual: number
    nota: number
    percentil: number
    porComponente: ValorPorComponente[]
  } | null
}

export interface LinhaDocente {
  docente: string
  questoes: number
  percentualMedio: number
  melhor: { numero: number; tema: string; percentual: number } | null
  pior: { numero: number; tema: string; percentual: number } | null
  areas: string[]
}

export interface VisaoDocentes {
  cursoNome: string
  aplicacao: ResumoAplicacao
  docentes: LinhaDocente[]
}
