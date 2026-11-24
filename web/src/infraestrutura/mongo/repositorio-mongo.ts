import type { ClientSession } from 'mongodb'

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
import type { Colecao, Documento, NomeColecao, Repositorio } from '@/dominio/portas/repositorio'
import { ColecaoMongo } from '@/infraestrutura/mongo/colecao-mongo'
import type { ConexaoMongo } from '@/infraestrutura/mongo/conexao'

/**
 * Repositório MongoDB: uma instância por requisição.
 *
 * Ele carrega a sessão de transação em curso, que é estado de uma operação e
 * não do processo. Criar um por requisição é barato — o que custa é o pool de
 * conexões, e esse fica na `ConexaoMongo`, compartilhada.
 */
export class RepositorioMongo implements Repositorio {
  public readonly nome = 'mongo'

  private sessao: ClientSession | undefined

  public readonly cursos: Colecao<Curso>
  public readonly aplicacoes: Colecao<Aplicacao>
  public readonly discentes: Colecao<Discente>
  public readonly questoes: Colecao<Questao>
  public readonly desempenho: Colecao<Desempenho>
  public readonly usuarios: Colecao<Usuario>
  public readonly sessoes: Colecao<Sessao>
  public readonly solicitacoesSenha: Colecao<SolicitacaoSenha>
  public readonly logImportacoes: Colecao<LogImportacao>

  public constructor(private readonly conexao: ConexaoMongo) {
    const colecao = <T extends Documento>(nome: NomeColecao): Colecao<T> =>
      new ColecaoMongo<T>(
        async () => (await this.conexao.obterBanco()).collection<Documento>(nome),
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

  public get descricaoLocalDados(): string {
    return this.conexao.descricao
  }

  public async conectar(): Promise<void> {
    await this.conexao.obterBanco()
  }

  /**
   * Não fecha o pool: ele é do processo, não desta requisição. Encerrar aqui
   * derrubaria as conexões das requisições vizinhas.
   */
  public async desconectar(): Promise<void> {
    this.sessao = undefined
  }

  /**
   * Transação, quando o servidor a oferece.
   *
   * `withTransaction` só existe de fato em conjunto de réplicas — o Atlas é
   * um, um `mongod` avulso não. Onde não houver, a operação roda mesmo assim e
   * o aviso sai no log: recusar a importação seria pior do que executá-la sem
   * a garantia, desde que quem opera saiba que, ali, uma falha no meio pode
   * deixar carga parcial.
   */
  public async transacao<T>(operacao: () => Promise<T>): Promise<T> {
    if (this.sessao) return operacao()

    const cliente = await this.conexao.obterCliente()
    const sessao = cliente.startSession()
    this.sessao = sessao

    try {
      let resultado: T | undefined
      await sessao.withTransaction(async () => {
        resultado = await operacao()
      })
      return resultado as T
    } catch (erro) {
      if (RepositorioMongo.ehFaltaDeSuporteATransacao(erro)) {
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

  private static ehFaltaDeSuporteATransacao(erro: unknown): boolean {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    return (
      mensagem.includes('Transaction numbers are only allowed') ||
      mensagem.includes('does not support transactions') ||
      mensagem.includes('replica set')
    )
  }
}
