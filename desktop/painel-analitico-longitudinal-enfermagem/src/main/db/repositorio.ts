import type {
  Aplicacao,
  Curso,
  Desempenho,
  Discente,
  LogImportacao,
  Questao,
  Sessao,
  SolicitacaoSenha,
  Usuario
} from '@compartilhado/types/dominio'

/** Documento mínimo: tudo que é persistido tem `_id`. */
export interface Documento {
  _id: string
}

/**
 * Filtro por igualdade de campos. Deliberadamente restrito: é o subconjunto
 * que tanto o driver local quanto o MongoDB suportam sem tradução.
 */
export type Filtro<T> = Partial<Record<keyof T, unknown>>

export interface Colecao<T extends Documento> {
  inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T>
  inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]>
  buscarPorId(id: string): Promise<T | null>
  buscarUm(filtro: Filtro<T>): Promise<T | null>
  buscar(filtro?: Filtro<T>): Promise<T[]>
  atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null>
  remover(filtro: Filtro<T>): Promise<number>
  contar(filtro?: Filtro<T>): Promise<number>
}

/**
 * Interface única de persistência.
 *
 * O restante do sistema conhece apenas este contrato. A escolha entre o driver
 * local embarcado e o MongoDB é configuração, nunca uma decisão espalhada pelo
 * código — é isso que mantém viva a especificação do documento executivo sem
 * exigir um MongoDB instalado na máquina das docentes.
 */
export interface Repositorio {
  readonly nome: string
  readonly descricaoLocalDados: string

  cursos: Colecao<Curso>
  aplicacoes: Colecao<Aplicacao>
  discentes: Colecao<Discente>
  questoes: Colecao<Questao>
  desempenho: Colecao<Desempenho>
  usuarios: Colecao<Usuario>
  sessoes: Colecao<Sessao>
  solicitacoesSenha: Colecao<SolicitacaoSenha>
  logImportacoes: Colecao<LogImportacao>

  conectar(): Promise<void>
  desconectar(): Promise<void>

  /**
   * Executa `operacao` de forma atômica: ou todas as escritas entram, ou
   * nenhuma. A importação de planilha depende disso.
   */
  transacao<T>(operacao: () => Promise<T>): Promise<T>
}

export const NOMES_COLECOES = [
  'cursos',
  'aplicacoes',
  'discentes',
  'questoes',
  'desempenho',
  'usuarios',
  'sessoes',
  'solicitacoesSenha',
  'logImportacoes'
] as const

export type NomeColecao = (typeof NOMES_COLECOES)[number]
