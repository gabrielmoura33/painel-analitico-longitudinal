import type { OcorrenciaImportacao } from '@/dominio/modelos/dominio'

export type TipoAba = 'desempenho' | 'regua' | 'modelo' | 'derivada' | 'desconhecida'

export interface AbaAnalisada {
  nome: string
  tipo: TipoAba
  periodoSugerido: string | null
  motivo: string
  totalQuestoes: number
  totalDiscentes: number
  avisos: string[]
}

export type CampoGrafia = 'docente' | 'tema'

export interface ClusterGrafiaDTO {
  campo: CampoGrafia
  /** Chave de comparação do grupo. */
  chave: string
  /** Chaves de todas as variantes: a unificação é aplicada a cada uma delas. */
  chavesVariantes: string[]
  sugestao: string
  variantes: Array<{ texto: string; ocorrencias: number }>
}

export interface ResumoAnalise {
  periodos: string[]
  totalDiscentes: number
  totalQuestoes: number
  totalRegistros: number
}

export interface AplicacaoExistente {
  _id: string
  rotulo: string
  dataImportacao: string
  totalRegistros: number
}

export interface AnaliseImportacao {
  /** Identificador do arquivo enviado, devolvido pelo upload. */
  uploadId: string
  nomeArquivo: string
  hashArquivo: string
  cursoId: string
  cursoNome: string
  rotulo: string
  abas: AbaAnalisada[]
  ocorrencias: OcorrenciaImportacao[]
  clusters: ClusterGrafiaDTO[]
  resumo: ResumoAnalise
  /** Preenchido quando o mesmo arquivo, ou o mesmo rótulo, já foi importado. */
  aplicacaoExistente: AplicacaoExistente | null
  podeImportar: boolean
}

export interface DecisoesImportacao {
  /** Identificador do arquivo enviado, devolvido pelo upload. */
  uploadId: string
  cursoId: string
  rotulo: string
  /** Somente as abas que o usuário confirmou importar, já com o período final. */
  abas: Array<{ nome: string; periodo: string }>
  unificacoes: Array<{ campo: CampoGrafia; chaves: string[]; para: string }>
  substituirAnterior: boolean
}

export interface ResumoCarga {
  aplicacaoId: string
  periodos: string[]
  discentesNovos: number
  discentesReencontrados: number
  /** Quantos vieram sem código de matrícula e, por isso, foram reconhecidos pelo nome. */
  discentesSemMatricula: number
  totalDiscentes: number
  totalQuestoes: number
  totalRegistros: number
  percentualMedio: number
  notaMedia: number
}

export type ResultadoImportacao =
  | { sucesso: true; resumo: ResumoCarga; ocorrencias: OcorrenciaImportacao[] }
  | { sucesso: false; mensagem: string; ocorrencias?: OcorrenciaImportacao[] }

export interface ItemHistorico {
  _id: string
  cursoId: string
  cursoNome: string
  rotulo: string
  arquivoOriginal: string
  dataImportacao: string
  importadoPor: string
  periodos: string[]
  totalDiscentes: number
  totalRegistros: number
  status: string
  ocorrencias: OcorrenciaImportacao[]
}
