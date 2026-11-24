import { randomUUID } from 'node:crypto'

import type { ClientSession, Collection as ColecaoDriver, Filter } from 'mongodb'

import type { Colecao, Documento, Filtro } from '@/dominio/portas/repositorio'

/**
 * O filtro do projeto é igualdade de campos, deliberadamente mais estreito do
 * que `Filter` do Mongo: é o subconjunto que qualquer banco atende sem
 * tradução. A conversão é segura por construção e fica num lugar só, em vez de
 * espalhada por cada chamada.
 */
function comoFiltro(filtro: object): Filter<Documento> {
  return filtro as Filter<Documento>
}

/**
 * Remove campos indefinidos antes de gravar.
 *
 * `{ matricula: undefined }` vira um campo ausente no documento, não um campo
 * com valor nulo — a diferença aparece depois, quando um filtro por `null`
 * deixa de encontrar o registro.
 */
function semUndefined<T extends object>(documento: T): T {
  const limpo: Record<string, unknown> = {}
  for (const [campo, valor] of Object.entries(documento)) {
    if (valor !== undefined) limpo[campo] = valor
  }
  return limpo as T
}

/**
 * Uma coleção do MongoDB atrás da porta `Colecao`.
 *
 * Recebe funções, e não o objeto pronto, porque tanto a coleção quanto a
 * sessão de transação só existem depois de conectar e podem mudar durante a
 * vida do repositório: a mesma instância serve consultas fora de transação e
 * dentro dela.
 *
 * O `_id` continua sendo string nossa. O Mongo preferiria `ObjectId`, mas o
 * modelo canônico já usa identificadores de texto, e a base gerada pela versão
 * desktop precisa poder ser carregada aqui sem conversão.
 */
export class ColecaoMongo<T extends Documento> implements Colecao<T> {
  public constructor(
    private readonly obterColecao: () => Promise<ColecaoDriver<Documento>>,
    private readonly obterSessao: () => ClientSession | undefined
  ) {}

  private get opcoes(): { session?: ClientSession } {
    const sessao = this.obterSessao()
    return sessao ? { session: sessao } : {}
  }

  public async inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const [inserido] = await this.inserirVarios([documento])
    return inserido as T
  }

  public async inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    if (documentos.length === 0) return []

    const comId = documentos.map(
      (documento) => semUndefined({ ...documento, _id: documento._id ?? randomUUID() }) as T
    )
    const colecao = await this.obterColecao()
    await colecao.insertMany(comId as Documento[], this.opcoes)
    return comId
  }

  public async buscarPorId(id: string): Promise<T | null> {
    const colecao = await this.obterColecao()
    const encontrado = await colecao.findOne(comoFiltro({ _id: id }), this.opcoes)
    return (encontrado as T | null) ?? null
  }

  public async buscarUm(filtro: Filtro<T>): Promise<T | null> {
    const colecao = await this.obterColecao()
    const encontrado = await colecao.findOne(comoFiltro(semUndefined(filtro)), this.opcoes)
    return (encontrado as T | null) ?? null
  }

  public async buscar(filtro: Filtro<T> = {}): Promise<T[]> {
    const colecao = await this.obterColecao()
    const encontrados = await colecao.find(comoFiltro(semUndefined(filtro)), this.opcoes).toArray()
    return encontrados as T[]
  }

  public async atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null> {
    const colecao = await this.obterColecao()
    const atualizado = await colecao.findOneAndUpdate(
      comoFiltro({ _id: id }),
      { $set: semUndefined(alteracoes) },
      { ...this.opcoes, returnDocument: 'after' }
    )
    return (atualizado as T | null) ?? null
  }

  public async remover(filtro: Filtro<T>): Promise<number> {
    const colecao = await this.obterColecao()
    const resultado = await colecao.deleteMany(comoFiltro(semUndefined(filtro)), this.opcoes)
    return resultado.deletedCount ?? 0
  }

  public async contar(filtro: Filtro<T> = {}): Promise<number> {
    const colecao = await this.obterColecao()
    return colecao.countDocuments(comoFiltro(semUndefined(filtro)), this.opcoes)
  }
}
