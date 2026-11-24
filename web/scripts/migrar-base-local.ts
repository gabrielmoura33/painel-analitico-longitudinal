/**
 * Carrega no MongoDB a base do aplicativo desktop.
 *
 * Serve a dois propósitos: levar para a versão web o que já foi importado nas
 * máquinas, e dar dados reais para testar a transição sem depender de
 * reimportar planilhas.
 *
 * Passa pelo repositório da aplicação, e não direto no banco, de propósito: é
 * assim que os campos sensíveis saem cifrados com a chave configurada. Gravar
 * direto deixaria nome e matrícula em claro no servidor.
 *
 *   PAINEL_MONGO_URL=... PAINEL_CHAVE_DADOS=... \
 *     npx tsx scripts/migrar-base-local.ts <caminho-do-painel-analitico.json>
 */
import { readFileSync } from 'node:fs'

import type { Documento, NomeColecao, Repositorio } from '../src/dominio/portas/repositorio'
import { NOMES_COLECOES } from '../src/dominio/portas/repositorio'
import { Configuracao } from '../src/infraestrutura/configuracao'
import { CofreAes } from '../src/infraestrutura/cripto/cofre-aes'
import { RepositorioCifrado } from '../src/infraestrutura/cripto/repositorio-cifrado'
import { ConexaoMongo } from '../src/infraestrutura/mongo/conexao'
import { RepositorioMongo } from '../src/infraestrutura/mongo/repositorio-mongo'

type BaseLocal = Partial<Record<NomeColecao, Documento[]>>

async function principal(): Promise<void> {
  const caminho = process.argv[2]
  if (!caminho) {
    throw new Error('Informe o caminho do arquivo painel-analitico.json.')
  }

  const configuracao = Configuracao.apartirDoAmbiente()
  const conexao = new ConexaoMongo(configuracao.urlMongo, configuracao.bancoMongo)
  const repositorio: Repositorio = new RepositorioCifrado(
    new RepositorioMongo(conexao),
    CofreAes.apartirDoAmbiente(configuracao.chaveDeDados)
  )

  await repositorio.conectar()
  const base = JSON.parse(readFileSync(caminho, 'utf8')) as BaseLocal

  console.log(`Destino: ${repositorio.descricaoLocalDados}\n`)

  for (const nome of NOMES_COLECOES) {
    const documentos = base[nome] ?? []
    const colecao = repositorio[nome]

    const jaExistem = await colecao.contar()
    if (jaExistem > 0) {
      console.log(`  ${nome}: ${jaExistem} documento(s) já no destino, pulando`)
      continue
    }
    if (documentos.length === 0) {
      console.log(`  ${nome}: vazia na origem`)
      continue
    }

    /*
     * Em lotes: desempenho tem dezenas de milhares de linhas, e um insertMany
     * único estoura o limite de 16 MB por operação do MongoDB.
     */
    const TAMANHO_LOTE = 2000
    for (let inicio = 0; inicio < documentos.length; inicio += TAMANHO_LOTE) {
      const lote = documentos.slice(inicio, inicio + TAMANHO_LOTE)
      await colecao.inserirVarios(lote as never)
    }
    console.log(`  ${nome}: ${documentos.length} documento(s) migrado(s)`)
  }

  await conexao.fechar()
  console.log('\nMigração concluída.')
}

principal().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
