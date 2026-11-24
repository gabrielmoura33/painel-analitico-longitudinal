import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'
import { randomBytes } from 'node:crypto'

import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CasoDeUsoCursos, cursoInicial } from '@/aplicacao/casos/cursos'
import { CasoDeUsoImportacao } from '@/aplicacao/casos/importacao'
import { CasoDeUsoIndicadores } from '@/aplicacao/casos/indicadores'
import type { AnaliseImportacao } from '@/dominio/modelos/importacao'
import type { Repositorio } from '@/dominio/portas/repositorio'
import { CofreAes } from '@/infraestrutura/cripto/cofre-aes'
import { RepositorioCifrado } from '@/infraestrutura/cripto/repositorio-cifrado'
import { ArmazemMongo } from '@/infraestrutura/mongo/armazem-mongo'
import { ConexaoMongo } from '@/infraestrutura/mongo/conexao'
import { RepositorioMongo } from '@/infraestrutura/mongo/repositorio-mongo'
import { RelogioDoSistema } from '@/infraestrutura/relogio-do-sistema'

/**
 * O ETL inteiro, da planilha real ao painel, rodando na pilha web.
 *
 * É o caminho que mais mudou na transição: no desktop o arquivo vinha de um
 * caminho em disco e era relido na confirmação; aqui ele chega como bytes e
 * vive num armazém temporário entre as duas fases. Um teste que parasse na
 * análise não cobriria justamente a parte nova.
 */

const NOME_PLANILHA = 'PUC COMPLETA Percentuais de acertos do TP - 2025 2 COREU (1) (1) (1).xlsx'

function localizar(nome: string): string | null {
  let pasta = import.meta.dirname
  const topo = parse(pasta).root
  while (true) {
    const tentativa = join(pasta, nome)
    if (existsSync(tentativa)) return tentativa
    if (pasta === topo) return null
    pasta = dirname(pasta)
  }
}

const caminhoPlanilha = localizar(NOME_PLANILHA)

let servidor: MongoMemoryServer
let conexao: ConexaoMongo
let repositorio: Repositorio
let armazem: ArmazemMongo
let cursoId: string

beforeAll(async () => {
  if (!caminhoPlanilha) return
  servidor = await MongoMemoryServer.create()
  conexao = new ConexaoMongo(servidor.getUri(), 'painel-etl')
  repositorio = new RepositorioCifrado(
    new RepositorioMongo(conexao),
    new CofreAes(randomBytes(32), 'teste')
  )
  await repositorio.conectar()
  armazem = new ArmazemMongo(conexao)

  const cursos = new CasoDeUsoCursos(repositorio, new RelogioDoSistema())
  const criado = await cursos.criar({ ...cursoInicial(), nome: 'Enfermagem', sigla: 'ENF' })
  if (!criado.sucesso) throw new Error(criado.mensagem)
  cursoId = criado.curso._id
})

afterAll(async () => {
  if (!caminhoPlanilha) return
  await conexao.fechar()
  await servidor.stop()
})

describe.skipIf(!caminhoPlanilha)('importação da planilha real pela pilha web', () => {
  function importacao(): CasoDeUsoImportacao {
    return new CasoDeUsoImportacao(repositorio, armazem, new RelogioDoSistema())
  }

  async function enviar(): Promise<string> {
    const conteudo = new Uint8Array(readFileSync(caminhoPlanilha as string))
    return armazem.guardar(conteudo, NOME_PLANILHA)
  }

  it('guarda o arquivo enviado e o devolve intacto', async () => {
    const uploadId = await enviar()
    const recuperado = await armazem.obter(uploadId)
    expect(recuperado?.nomeArquivo).toBe(NOME_PLANILHA)
    expect(recuperado?.conteudo.byteLength).toBe(readFileSync(caminhoPlanilha as string).byteLength)
  })

  it('analisa sem gravar nada', async () => {
    const uploadId = await enviar()
    const analise = await importacao().analisar(uploadId, cursoId, '2025/2')

    expect('erro' in analise).toBe(false)
    const dados = analise as AnaliseImportacao
    expect(dados.abas.filter((aba) => aba.tipo === 'desempenho').length).toBeGreaterThan(0)
    expect(dados.resumo.totalDiscentes).toBeGreaterThan(100)

    // Analisar não grava: a base continua vazia de aplicações.
    expect(await repositorio.aplicacoes.contar()).toBe(0)
  })

  it('importa, e o painel passa a responder sobre os dados gravados', async () => {
    const uploadId = await enviar()
    const analise = (await importacao().analisar(
      uploadId,
      cursoId,
      '2025/2'
    )) as AnaliseImportacao
    expect(analise.podeImportar).toBe(true)

    const resultado = await importacao().importar(
      {
        uploadId,
        cursoId,
        rotulo: '2025/2',
        abas: analise.abas
          .filter((aba) => aba.tipo === 'desempenho')
          .map((aba) => ({ nome: aba.nome, periodo: aba.periodoSugerido ?? '' })),
        unificacoes: [],
        substituirAnterior: false
      },
      'usuario-de-teste'
    )

    if (!resultado.sucesso) throw new Error(resultado.mensagem)
    expect(resultado.resumo.totalDiscentes).toBeGreaterThan(100)
    expect(resultado.resumo.totalRegistros).toBeGreaterThan(1000)

    // Sem matrícula na planilha, o reencontro depende do nome — e isso é dito.
    expect(resultado.resumo.discentesSemMatricula).toBe(resultado.resumo.totalDiscentes)

    const indicadores = new CasoDeUsoIndicadores(repositorio)
    const contexto = await indicadores.contexto(cursoId)
    expect(contexto.aplicacaoId).not.toBeNull()

    const visao = await indicadores.visaoGeral(cursoId, contexto.aplicacaoId as string)
    expect(visao?.kpis.percentualMedio).toBeGreaterThan(0)
    expect(visao?.kpis.percentualMedio).toBeLessThanOrEqual(100)
    expect(visao?.porPeriodo.length).toBeGreaterThan(0)
  })

  it('recusa a segunda importação do mesmo arquivo sem substituir', async () => {
    const uploadId = await enviar()
    const analise = (await importacao().analisar(
      uploadId,
      cursoId,
      '2025/2'
    )) as AnaliseImportacao
    expect(analise.aplicacaoExistente).not.toBeNull()

    const resultado = await importacao().importar(
      {
        uploadId,
        cursoId,
        rotulo: '2025/2',
        abas: analise.abas
          .filter((aba) => aba.tipo === 'desempenho')
          .map((aba) => ({ nome: aba.nome, periodo: aba.periodoSugerido ?? '' })),
        unificacoes: [],
        substituirAnterior: false
      },
      'usuario-de-teste'
    )
    expect(resultado.sucesso).toBe(false)
  })

  it('o arquivo expirado dá mensagem em vez de quebrar', async () => {
    const uploadId = await enviar()
    await armazem.descartar(uploadId)

    const analise = await importacao().analisar(uploadId, cursoId, '2026/1')
    expect('erro' in analise).toBe(true)
    expect((analise as { erro: string }).erro).toMatch(/não está mais disponível/)
  })
})
