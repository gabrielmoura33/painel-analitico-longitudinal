import { randomUUID } from 'node:crypto'

import {
  MongoClient,
  type ClientSession,
  type Db,
  type Filter,
  type Collection as ColecaoDriver
} from 'mongodb'

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

import type { Colecao, Documento, Filtro, NomeColecao, Repositorio } from '../repositorio'

/**
 * Driver MongoDB.
 *
 * É ele que atende ao desenho combinado com o departamento: a interface roda
 * na máquina de cada pessoa, e os dados moram num único banco — hoje em nuvem,
 * amanhã no servidor que a TI da PUC subir. Trocar um pelo outro é trocar a
 * variável `PAINEL_MONGO_URL`; nada no restante do código sabe a diferença.
 *
 * Duas decisões merecem registro:
 *
 * 1. **`_id` continua sendo string nossa.** O Mongo preferiria `ObjectId`, mas
 *    o modelo canônico já usa identificadores de texto, e os dois drivers
 *    precisam produzir documentos idênticos para que uma base gerada no local
 *    possa ser carregada aqui.
 * 2. **A transação é tentada, não presumida.** `transacao()` só existe de fato
 *    em réplica — o Atlas é uma, um `mongod` avulso não. Onde não houver, a
 *    operação roda mesmo assim e o aviso sai no log, porque recusar a
 *    importação seria pior do que executá-la sem a garantia.
 */

/**
 * O filtro do projeto é igualdade de campos, deliberadamente mais estreito do
 * que `Filter` do Mongo. A conversão é segura por construção, e fica aqui, num
 * lugar só, em vez de espalhada por cada chamada.
 */
function comoFiltro(filtro: object): Filter<Documento> {
  return filtro as Filter<Documento>
}

function semUndefined<T extends object>(documento: T): T {
  const limpo: Record<string, unknown> = {}
  for (const [campo, valor] of Object.entries(documento)) {
    if (valor !== undefined) limpo[campo] = valor
  }
  return limpo as T
}

class ColecaoMongo<T extends Documento> implements Colecao<T> {
  constructor(
    private readonly obterColecao: () => ColecaoDriver<Documento>,
    private readonly obterSessao: () => ClientSession | undefined
  ) {}

  private get opcoes(): { session?: ClientSession } {
    const session = this.obterSessao()
    return session ? { session } : {}
  }

  async inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const [inserido] = await this.inserirVarios([documento])
    return inserido as T
  }

  async inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    if (documentos.length === 0) return []

    const comId = documentos.map(
      (documento) => semUndefined({ ...documento, _id: documento._id ?? randomUUID() }) as T
    )
    await this.obterColecao().insertMany(comId as Documento[], this.opcoes)
    return comId
  }

  async buscarPorId(id: string): Promise<T | null> {
    const encontrado = await this.obterColecao().findOne(comoFiltro({ _id: id }), this.opcoes)
    return (encontrado as T | null) ?? null
  }

  async buscarUm(filtro: Filtro<T>): Promise<T | null> {
    const encontrado = await this.obterColecao().findOne(
      comoFiltro(semUndefined(filtro)),
      this.opcoes
    )
    return (encontrado as T | null) ?? null
  }

  async buscar(filtro: Filtro<T> = {}): Promise<T[]> {
    const encontrados = await this.obterColecao()
      .find(comoFiltro(semUndefined(filtro)), this.opcoes)
      .toArray()
    return encontrados as T[]
  }

  async atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null> {
    const atualizado = await this.obterColecao().findOneAndUpdate(
      comoFiltro({ _id: id }),
      { $set: semUndefined(alteracoes) },
      { ...this.opcoes, returnDocument: 'after' }
    )
    return (atualizado as T | null) ?? null
  }

  async remover(filtro: Filtro<T>): Promise<number> {
    const resultado = await this.obterColecao().deleteMany(
      comoFiltro(semUndefined(filtro)),
      this.opcoes
    )
    return resultado.deletedCount ?? 0
  }

  async contar(filtro: Filtro<T> = {}): Promise<number> {
    return this.obterColecao().countDocuments(comoFiltro(semUndefined(filtro)), this.opcoes)
  }
}

/** Índices que sustentam as consultas que o painel faz em todas as telas. */
const INDICES: Partial<Record<NomeColecao, Array<Record<string, 1>>>> = {
  aplicacoes: [{ cursoId: 1 }],
  discentes: [{ cursoId: 1 }, { cursoId: 1, matricula: 1 }],
  questoes: [{ aplicacaoId: 1 }, { cursoId: 1 }],
  desempenho: [{ aplicacaoId: 1 }, { cursoId: 1 }, { discenteId: 1 }],
  usuarios: [{ login: 1 }],
  sessoes: [{ usuarioId: 1 }],
  solicitacoesSenha: [{ login: 1 }],
  logImportacoes: [{ cursoId: 1 }]
}

class RepositorioMongo implements Repositorio {
  readonly nome = 'mongo'

  private cliente: MongoClient | null = null
  private banco: Db | null = null
  private sessao: ClientSession | undefined

  readonly cursos: Colecao<Curso>
  readonly aplicacoes: Colecao<Aplicacao>
  readonly discentes: Colecao<Discente>
  readonly questoes: Colecao<Questao>
  readonly desempenho: Colecao<Desempenho>
  readonly usuarios: Colecao<Usuario>
  readonly sessoes: Colecao<Sessao>
  readonly solicitacoesSenha: Colecao<SolicitacaoSenha>
  readonly logImportacoes: Colecao<LogImportacao>

  constructor(
    private readonly urlConexao: string,
    private readonly nomeBanco: string
  ) {
    const colecao = <T extends Documento>(nome: NomeColecao): Colecao<T> =>
      new ColecaoMongo<T>(
        () => {
          if (!this.banco) throw new Error('Repositório MongoDB usado antes de conectar.')
          return this.banco.collection<Documento>(nome)
        },
        () => this.sessao
      )

    this.cursos = colecao<Curso>('cursos')
    this.aplicacoes = colecao<Aplicacao>('aplicacoes')
    this.discentes = colecao<Discente>('discentes')
    this.questoes = colecao<Questao>('questoes')
    this.desempenho = colecao<Desempenho>('desempenho')
    this.usuarios = colecao<Usuario>('usuarios')
    this.sessoes = colecao<Sessao>('sessoes')
    this.solicitacoesSenha = colecao<SolicitacaoSenha>('solicitacoesSenha')
    this.logImportacoes = colecao<LogImportacao>('logImportacoes')
  }

  get descricaoLocalDados(): string {
    // Nunca devolve a URL inteira: ela carrega usuário e senha do banco.
    try {
      const url = new URL(this.urlConexao)
      return `MongoDB ${url.host}/${this.nomeBanco}`
    } catch {
      return `MongoDB · banco ${this.nomeBanco}`
    }
  }

  async conectar(): Promise<void> {
    if (this.cliente) return

    this.cliente = new MongoClient(this.urlConexao)
    await this.cliente.connect()
    this.banco = this.cliente.db(this.nomeBanco)

    for (const [nome, chaves] of Object.entries(INDICES)) {
      for (const chave of chaves ?? []) {
        await this.banco.collection(nome).createIndex(chave)
      }
    }
  }

  async desconectar(): Promise<void> {
    await this.cliente?.close()
    this.cliente = null
    this.banco = null
  }

  async transacao<T>(operacao: () => Promise<T>): Promise<T> {
    if (!this.cliente) throw new Error('Repositório MongoDB usado antes de conectar.')
    if (this.sessao) return operacao()

    const sessao = this.cliente.startSession()
    this.sessao = sessao

    try {
      let resultado: T | undefined
      await sessao.withTransaction(async () => {
        resultado = await operacao()
      })
      return resultado as T
    } catch (erro) {
      /*
       * Implantação sem réplica não tem transação. A importação precisa
       * acontecer de qualquer forma — e quem opera precisa saber que, ali,
       * uma falha no meio pode deixar carga parcial.
       */
      if (ehFaltaDeSuporteATransacao(erro)) {
        console.warn(
          '[mongo] Esta implantação não suporta transações (exige conjunto de réplicas). ' +
            'A operação seguirá sem atomicidade.'
        )
        this.sessao = undefined
        return operacao()
      }
      throw erro
    } finally {
      this.sessao = undefined
      await sessao.endSession()
    }
  }
}

function ehFaltaDeSuporteATransacao(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro)
  return (
    mensagem.includes('Transaction numbers are only allowed') ||
    mensagem.includes('does not support transactions') ||
    mensagem.includes('replica set')
  )
}

export function criarRepositorioMongo(urlConexao: string, nomeBanco?: string): Repositorio {
  return new RepositorioMongo(urlConexao, nomeBanco ?? 'painel-analitico')
}
