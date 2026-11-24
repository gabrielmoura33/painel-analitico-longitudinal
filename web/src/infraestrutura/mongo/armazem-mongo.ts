import { randomUUID } from 'node:crypto'

import { Binary } from 'mongodb'

import type { ArmazemDeUpload } from '@/dominio/portas/armazem-de-upload'
import type { ConexaoMongo } from '@/infraestrutura/mongo/conexao'

interface DocumentoUpload {
  _id: string
  nomeArquivo: string
  conteudo: Binary
  expiraEm: Date
}

/**
 * Arquivos enviados, guardados no próprio MongoDB com prazo de validade.
 *
 * As planilhas do Teste de Progresso têm poucos megabytes, bem abaixo do
 * limite de 16 MB por documento, então não compensa a complexidade do GridFS.
 *
 * O índice TTL é o que impede a coleção de virar um depósito de planilhas
 * abandonadas por quem desistiu no meio do assistente: o próprio banco apaga
 * o que passou da hora, sem rotina de limpeza para alguém esquecer de rodar.
 */
export class ArmazemMongo implements ArmazemDeUpload {
  private static readonly COLECAO = 'uploadsImportacao'
  private static readonly VALIDADE_MINUTOS = 60

  private indiceCriado = false

  public constructor(private readonly conexao: ConexaoMongo) {}

  private async colecao(): Promise<ReturnType<Awaited<ReturnType<ConexaoMongo['obterBanco']>>['collection']>> {
    const banco = await this.conexao.obterBanco()
    const colecao = banco.collection(ArmazemMongo.COLECAO)
    if (!this.indiceCriado) {
      await colecao.createIndex({ expiraEm: 1 }, { expireAfterSeconds: 0 })
      this.indiceCriado = true
    }
    return colecao
  }

  public async guardar(conteudo: Uint8Array, nomeArquivo: string): Promise<string> {
    const colecao = await this.colecao()
    const id = randomUUID()
    await colecao.insertOne({
      _id: id,
      nomeArquivo,
      conteudo: new Binary(conteudo),
      expiraEm: new Date(Date.now() + ArmazemMongo.VALIDADE_MINUTOS * 60_000)
    } as never)
    return id
  }

  public async obter(id: string): Promise<{ conteudo: Uint8Array; nomeArquivo: string } | null> {
    const colecao = await this.colecao()
    const documento = (await colecao.findOne({ _id: id as never })) as DocumentoUpload | null
    if (!documento) return null
    return {
      conteudo: new Uint8Array(documento.conteudo.buffer),
      nomeArquivo: documento.nomeArquivo
    }
  }

  public async descartar(id: string): Promise<void> {
    const colecao = await this.colecao()
    await colecao.deleteOne({ _id: id as never })
  }
}
