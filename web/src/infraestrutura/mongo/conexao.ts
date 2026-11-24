import { MongoClient, type Db } from 'mongodb'

import type { NomeColecao } from '@/dominio/portas/repositorio'

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

/**
 * Dono do cliente MongoDB e do pool de conexões.
 *
 * Existe separado do repositório por uma razão que só apareceu na versão web.
 * No Electron havia um usuário, um processo e uma operação por vez, então o
 * repositório podia guardar a sessão de transação num campo seu. Num servidor
 * que atende requisições concorrentes esse campo é compartilhado: duas
 * importações simultâneas passariam a escrever na sessão uma da outra.
 *
 * A separação resolve isso. O que é caro e deve ser único — o cliente e seu
 * pool — mora aqui, num singleton. O que carrega estado de uma operação — o
 * repositório, com sua sessão — é criado por requisição e descartado com ela.
 *
 * O cache em `globalThis` é para o modo de desenvolvimento do Next, que
 * recarrega módulos a cada alteração: sem ele, cada salvamento de arquivo
 * abriria mais um pool e o servidor esgotaria as conexões do banco.
 */
export class ConexaoMongo {
  private cliente: MongoClient | null = null
  private banco: Db | null = null
  private conectando: Promise<Db> | null = null
  private indicesCriados = false

  public constructor(
    private readonly urlConexao: string,
    private readonly nomeBanco: string
  ) {}

  public async obterBanco(): Promise<Db> {
    if (this.banco) return this.banco
    // Requisições simultâneas na partida a frio compartilham a mesma promessa,
    // em vez de abrirem um cliente cada uma.
    this.conectando ??= this.conectar()
    return this.conectando
  }

  private async conectar(): Promise<Db> {
    const cliente = new MongoClient(this.urlConexao)
    await cliente.connect()
    const banco = cliente.db(this.nomeBanco)

    this.cliente = cliente
    this.banco = banco
    await this.garantirIndices(banco)
    return banco
  }

  private async garantirIndices(banco: Db): Promise<void> {
    if (this.indicesCriados) return
    for (const [nome, chaves] of Object.entries(INDICES)) {
      for (const chave of chaves ?? []) {
        await banco.collection(nome).createIndex(chave)
      }
    }
    this.indicesCriados = true
  }

  public async obterCliente(): Promise<MongoClient> {
    await this.obterBanco()
    if (!this.cliente) throw new Error('Cliente MongoDB indisponível após conectar.')
    return this.cliente
  }

  public async fechar(): Promise<void> {
    await this.cliente?.close()
    this.cliente = null
    this.banco = null
    this.conectando = null
    this.indicesCriados = false
  }

  /** Descrição sem credenciais: a URL carrega usuário e senha do banco. */
  public get descricao(): string {
    try {
      const url = new URL(this.urlConexao)
      return `MongoDB ${url.host}/${this.nomeBanco}`
    } catch {
      return `MongoDB · banco ${this.nomeBanco}`
    }
  }
}

interface CacheGlobal {
  conexaoMongo?: ConexaoMongo
}

const cache = globalThis as unknown as CacheGlobal

/** Conexão única do processo, preservada entre recargas de módulo no dev. */
export function obterConexaoMongo(urlConexao: string, nomeBanco: string): ConexaoMongo {
  cache.conexaoMongo ??= new ConexaoMongo(urlConexao, nomeBanco)
  return cache.conexaoMongo
}
