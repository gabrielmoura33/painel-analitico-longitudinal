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

import { ArmazenamentoJson } from '../armazenamento-json'
import type { Colecao, Documento, Filtro, NomeColecao, Repositorio } from '../repositorio'

function corresponde<T extends Documento>(documento: Record<string, unknown>, filtro: Filtro<T>): boolean {
  for (const [campo, esperado] of Object.entries(filtro)) {
    if (esperado === undefined) continue
    if (documento[campo] !== esperado) return false
  }
  return true
}

class ColecaoLocal<T extends Documento> implements Colecao<T> {
  constructor(
    private readonly armazenamento: ArmazenamentoJson,
    private readonly nome: NomeColecao
  ) {}

  private get registros(): Array<Record<string, unknown>> {
    return this.armazenamento.colecao(this.nome)
  }

  async inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    const [inserido] = await this.inserirVarios([documento])
    // inserirVarios sempre devolve um item por entrada recebida.
    return inserido as T
  }

  async inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    const criados = documentos.map((documento) => ({
      ...documento,
      _id: documento._id ?? this.armazenamento.novoId()
    })) as T[]

    this.registros.push(...(criados as unknown as Array<Record<string, unknown>>))
    this.armazenamento.sincronizar()
    return structuredClone(criados)
  }

  async buscarPorId(id: string): Promise<T | null> {
    const encontrado = this.registros.find((registro) => registro._id === id)
    return encontrado ? (structuredClone(encontrado) as T) : null
  }

  async buscarUm(filtro: Filtro<T>): Promise<T | null> {
    const encontrado = this.registros.find((registro) => corresponde<T>(registro, filtro))
    return encontrado ? (structuredClone(encontrado) as T) : null
  }

  async buscar(filtro: Filtro<T> = {}): Promise<T[]> {
    const encontrados = this.registros.filter((registro) => corresponde<T>(registro, filtro))
    return structuredClone(encontrados) as T[]
  }

  async atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null> {
    const indice = this.registros.findIndex((registro) => registro._id === id)
    if (indice === -1) return null

    const atual = this.registros[indice] as Record<string, unknown>
    const atualizado = { ...atual, ...alteracoes, _id: id }
    this.registros[indice] = atualizado
    this.armazenamento.sincronizar()
    return structuredClone(atualizado) as unknown as T
  }

  async remover(filtro: Filtro<T>): Promise<number> {
    const mantidos = this.registros.filter((registro) => !corresponde<T>(registro, filtro))
    const removidos = this.registros.length - mantidos.length
    if (removidos > 0) {
      this.registros.splice(0, this.registros.length, ...mantidos)
      this.armazenamento.sincronizar()
    }
    return removidos
  }

  async contar(filtro: Filtro<T> = {}): Promise<number> {
    return this.registros.filter((registro) => corresponde<T>(registro, filtro)).length
  }
}

/**
 * Driver padrão da aplicação: banco embarcado, sem instalação e sem serviço.
 * É o que permite às docentes operarem o painel sem equipe técnica.
 */
export class RepositorioLocal implements Repositorio {
  readonly nome = 'local'
  private readonly armazenamento: ArmazenamentoJson

  readonly cursos: Colecao<Curso>
  readonly aplicacoes: Colecao<Aplicacao>
  readonly discentes: Colecao<Discente>
  readonly questoes: Colecao<Questao>
  readonly desempenho: Colecao<Desempenho>
  readonly usuarios: Colecao<Usuario>
  readonly sessoes: Colecao<Sessao>
  readonly solicitacoesSenha: Colecao<SolicitacaoSenha>
  readonly logImportacoes: Colecao<LogImportacao>

  constructor(caminhoArquivo: string) {
    const armazenamento = new ArmazenamentoJson(caminhoArquivo)
    this.armazenamento = armazenamento

    this.cursos = new ColecaoLocal<Curso>(armazenamento, 'cursos')
    this.aplicacoes = new ColecaoLocal<Aplicacao>(armazenamento, 'aplicacoes')
    this.discentes = new ColecaoLocal<Discente>(armazenamento, 'discentes')
    this.questoes = new ColecaoLocal<Questao>(armazenamento, 'questoes')
    this.desempenho = new ColecaoLocal<Desempenho>(armazenamento, 'desempenho')
    this.usuarios = new ColecaoLocal<Usuario>(armazenamento, 'usuarios')
    this.sessoes = new ColecaoLocal<Sessao>(armazenamento, 'sessoes')
    this.solicitacoesSenha = new ColecaoLocal<SolicitacaoSenha>(armazenamento, 'solicitacoesSenha')
    this.logImportacoes = new ColecaoLocal<LogImportacao>(armazenamento, 'logImportacoes')
  }

  get descricaoLocalDados(): string {
    return this.armazenamento.caminho
  }

  async conectar(): Promise<void> {
    this.armazenamento.carregar()
  }

  async desconectar(): Promise<void> {
    this.armazenamento.sincronizar()
  }

  async transacao<T>(operacao: () => Promise<T>): Promise<T> {
    return this.armazenamento.transacao(operacao)
  }
}
