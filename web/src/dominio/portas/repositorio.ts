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
} from '@/dominio/modelos/dominio'

/** Documento mínimo: tudo que é persistido tem `_id`. */
export interface Documento {
  _id: string
}

/**
 * Filtro por igualdade de campos. Deliberadamente restrito: é o subconjunto
 * que qualquer driver suporta sem tradução, e o que mantém a porta livre da
 * linguagem de consulta de um banco específico.
 */
export type Filtro<T> = Partial<Record<keyof T, unknown>>

/**
 * Metade de leitura de uma coleção.
 *
 * Existe separada para que um caso de uso que só consulta — os painéis
 * analíticos, por exemplo — declare exatamente isso no construtor. Quem só
 * lê não deve poder escrever por descuido.
 */
export interface ColecaoSomenteLeitura<T extends Documento> {
  buscarPorId(id: string): Promise<T | null>
  buscarUm(filtro: Filtro<T>): Promise<T | null>
  buscar(filtro?: Filtro<T>): Promise<T[]>
  contar(filtro?: Filtro<T>): Promise<number>
}

export interface Colecao<T extends Documento> extends ColecaoSomenteLeitura<T> {
  inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T>
  inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]>
  atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null>
  remover(filtro: Filtro<T>): Promise<number>
}

/**
 * Unidade de trabalho: as coleções e a fronteira transacional que as une.
 *
 * O domínio e os casos de uso conhecem apenas este contrato — nunca o
 * MongoDB. Trocar de banco é escrever outra implementação desta porta, sem
 * tocar em regra de negócio.
 */
export interface Repositorio {
  readonly nome: string
  readonly descricaoLocalDados: string

  readonly cursos: Colecao<Curso>
  readonly aplicacoes: Colecao<Aplicacao>
  readonly discentes: Colecao<Discente>
  readonly questoes: Colecao<Questao>
  readonly desempenho: Colecao<Desempenho>
  readonly usuarios: Colecao<Usuario>
  readonly sessoes: Colecao<Sessao>
  readonly solicitacoesSenha: Colecao<SolicitacaoSenha>
  readonly logImportacoes: Colecao<LogImportacao>

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
