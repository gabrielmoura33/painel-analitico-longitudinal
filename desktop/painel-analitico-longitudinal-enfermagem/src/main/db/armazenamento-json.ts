import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { NOMES_COLECOES, type NomeColecao } from './repositorio'

type Banco = Record<NomeColecao, Array<Record<string, unknown>>>

function bancoVazio(): Banco {
  const banco = {} as Banco
  for (const nome of NOMES_COLECOES) banco[nome] = []
  return banco
}

/**
 * Banco de documentos embarcado, arquivo único.
 *
 * Mantém tudo em memória e grava de forma atômica (arquivo temporário +
 * rename), para que uma queda no meio da escrita não deixe o arquivo pela
 * metade. O volume esperado — alguns milhares de documentos por aplicação —
 * cabe folgadamente nessa abordagem.
 */
export class ArmazenamentoJson {
  private dados: Banco = bancoVazio()
  private carregado = false
  private emTransacao = false
  private escritaSuspensa = false

  constructor(private readonly caminhoArquivo: string) {}

  get caminho(): string {
    return this.caminhoArquivo
  }

  carregar(): void {
    if (this.carregado) return
    mkdirSync(dirname(this.caminhoArquivo), { recursive: true })

    if (existsSync(this.caminhoArquivo)) {
      const bruto = readFileSync(this.caminhoArquivo, 'utf8')
      const lido = bruto.trim() === '' ? {} : (JSON.parse(bruto) as Partial<Banco>)
      const banco = bancoVazio()
      for (const nome of NOMES_COLECOES) {
        const colecao = lido[nome]
        if (Array.isArray(colecao)) banco[nome] = colecao
      }
      this.dados = banco
    } else {
      this.dados = bancoVazio()
      this.gravar()
    }
    this.carregado = true
  }

  colecao(nome: NomeColecao): Array<Record<string, unknown>> {
    if (!this.carregado) this.carregar()
    return this.dados[nome]
  }

  novoId(): string {
    return randomUUID()
  }

  /** Persiste o estado atual, a menos que uma transação esteja em curso. */
  sincronizar(): void {
    if (this.escritaSuspensa) return
    this.gravar()
  }

  /**
   * Snapshot antes, descarte depois. Em caso de erro o estado anterior volta
   * integralmente e nada é gravado em disco.
   */
  async transacao<T>(operacao: () => Promise<T>): Promise<T> {
    if (!this.carregado) this.carregar()
    if (this.emTransacao) {
      throw new Error('Já existe uma transação em andamento neste armazenamento.')
    }

    const anterior = structuredClone(this.dados)
    this.emTransacao = true
    this.escritaSuspensa = true

    try {
      const resultado = await operacao()
      this.escritaSuspensa = false
      this.gravar()
      return resultado
    } catch (erro) {
      this.dados = anterior
      this.escritaSuspensa = false
      throw erro
    } finally {
      this.emTransacao = false
    }
  }

  private gravar(): void {
    const temporario = join(dirname(this.caminhoArquivo), `.${randomUUID()}.tmp`)
    try {
      writeFileSync(temporario, JSON.stringify(this.dados, null, 2), 'utf8')
      renameSync(temporario, this.caminhoArquivo)
    } catch (erro) {
      if (existsSync(temporario)) unlinkSync(temporario)
      throw erro
    }
  }
}
