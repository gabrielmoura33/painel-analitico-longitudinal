import { randomBytes } from 'node:crypto'

import { MongoClient } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CasoDeUsoAutenticacao, ControleDeTentativas } from '@/aplicacao/casos/autenticacao'
import { CasoDeUsoCursos } from '@/aplicacao/casos/cursos'
import type { Repositorio } from '@/dominio/portas/repositorio'
import { CofreAes } from '@/infraestrutura/cripto/cofre-aes'
import { RepositorioCifrado } from '@/infraestrutura/cripto/repositorio-cifrado'
import { ConexaoMongo } from '@/infraestrutura/mongo/conexao'
import { RepositorioMongo } from '@/infraestrutura/mongo/repositorio-mongo'
import { RelogioDoSistema } from '@/infraestrutura/relogio-do-sistema'
import type { HashDeSenha } from '@/dominio/portas/hash-de-senha'

/**
 * Verificação da transição desktop → web contra um MongoDB de verdade.
 *
 * Os testes do aplicativo desktop rodavam contra o driver de arquivo local.
 * Trocar o banco é justamente o tipo de mudança que passa no compilador e
 * falha em produção, então aqui o banco é real — um `mongod` em memória,
 * sem credencial nem servidor externo.
 */

/** Hash barato: bcrypt a dez rodadas tornaria este arquivo lento sem ensinar nada. */
class HashDeTeste implements HashDeSenha {
  public async gerar(senha: string): Promise<string> {
    return `hash:${senha}`
  }

  public async conferir(senha: string, hash: string): Promise<boolean> {
    return hash === `hash:${senha}`
  }
}

let servidor: MongoMemoryServer
let conexao: ConexaoMongo
let repositorio: Repositorio
let inspetor: MongoClient
const NOME_BANCO = 'painel-teste'

beforeAll(async () => {
  servidor = await MongoMemoryServer.create()
  const url = servidor.getUri()

  conexao = new ConexaoMongo(url, NOME_BANCO)
  repositorio = new RepositorioCifrado(
    new RepositorioMongo(conexao),
    new CofreAes(randomBytes(32), 'teste')
  )
  await repositorio.conectar()

  // Cliente separado, para olhar o que está gravado sem passar pela cifra.
  inspetor = new MongoClient(url)
  await inspetor.connect()
})

afterAll(async () => {
  await inspetor.close()
  await conexao.fechar()
  await servidor.stop()
})

describe('persistência no MongoDB', () => {
  it('grava e relê um documento pelo contrato do repositório', async () => {
    const curso = await repositorio.cursos.inserir({
      nome: 'Enfermagem',
      sigla: 'ENF',
      instituicao: 'PUC Minas',
      campus: 'Coração Eucarístico',
      departamento: 'Enfermagem',
      nomeInstrumento: 'Teste de Progresso',
      estrutura: { totalQuestoes: 35, periodos: ['6º'], componentes: [] },
      areas: [],
      regua: [{ periodo: '6º', notaBase: 5, percentualMinimo: 40 }],
      perfilImportacao: {
        linhaCabecalho: 3,
        linhaMatricula: null,
        colunaQuestao: 'A',
        colunaGabarito: 'B',
        colunaTema: 'C',
        colunaDocente: 'D',
        primeiraColunaAluno: 'E',
        marcadorAcerto: '1',
        linhaTotal: null
      },
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    })

    expect(curso._id).toBeTypeOf('string')
    const relido = await repositorio.cursos.buscarPorId(curso._id)
    expect(relido?.sigla).toBe('ENF')
  })

  it('o identificador continua sendo texto nosso, não ObjectId do Mongo', async () => {
    const curso = await repositorio.cursos.buscarUm({ sigla: 'ENF' })
    const bruto = await inspetor
      .db(NOME_BANCO)
      .collection('cursos')
      .findOne({ _id: curso?._id as never })
    expect(typeof bruto?._id).toBe('string')
  })
})

describe('criptografia de campos sensíveis', () => {
  it('o nome do discente chega cifrado ao banco e legível à aplicação', async () => {
    const curso = await repositorio.cursos.buscarUm({ sigla: 'ENF' })
    const discente = await repositorio.discentes.inserir({
      cursoId: curso?._id ?? '',
      nomeCompleto: 'Cândida Renata Mota Flávio',
      matricula: '20231234',
      pseudonimo: 'ENF-001',
      ativo: true,
      criadoEm: new Date().toISOString()
    })

    const pelaAplicacao = await repositorio.discentes.buscarPorId(discente._id)
    expect(pelaAplicacao?.nomeCompleto).toBe('Cândida Renata Mota Flávio')

    const bruto = await inspetor
      .db(NOME_BANCO)
      .collection('discentes')
      .findOne({ _id: discente._id as never })
    expect(bruto?.nomeCompleto).toMatch(/^enc:v1:/)
    expect(bruto?.matricula).toMatch(/^enc:v1:/)
    // O pseudônimo é o que as telas coletivas mostram: não é dado sensível.
    expect(bruto?.pseudonimo).toBe('ENF-001')
  })

  it('busca por CPF funciona, porque o campo usa IV determinístico', async () => {
    await repositorio.usuarios.inserir({
      nomeCompleto: 'Pessoa de Teste',
      cpf: '52998224725',
      dataNascimento: '1985-06-12',
      login: 'pessoa.teste',
      senhaHash: 'hash:qualquer',
      perfil: 'professor',
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: false,
      ultimoAcesso: null,
      termoAceitoEm: null,
      criadoEm: new Date().toISOString()
    })

    const encontrado = await repositorio.usuarios.buscarUm({ cpf: '52998224725' })
    expect(encontrado?.login).toBe('pessoa.teste')
  })

  it('filtrar por campo de IV aleatório levanta erro, em vez de devolver lista vazia', async () => {
    await expect(
      repositorio.discentes.buscar({ nomeCompleto: 'Cândida Renata Mota Flávio' })
    ).rejects.toThrow(/IV aleatório/)
  })
})

describe('autenticação por sessão', () => {
  const relogio = new RelogioDoSistema()

  function autenticacao(): CasoDeUsoAutenticacao {
    return new CasoDeUsoAutenticacao(
      repositorio,
      new HashDeTeste(),
      relogio,
      new ControleDeTentativas(),
      14
    )
  }

  it('entra com a senha certa e a sessão resolve de volta o usuário', async () => {
    const casos = autenticacao()
    await repositorio.usuarios.inserir({
      nomeCompleto: 'Administradora',
      cpf: '16899535009',
      dataNascimento: '1980-01-01',
      login: 'admin.painel',
      senhaHash: await new HashDeTeste().gerar('Senha1234'),
      perfil: 'administrador',
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: false,
      ultimoAcesso: null,
      termoAceitoEm: null,
      criadoEm: new Date().toISOString()
    })

    const entrada = await casos.entrar('ADMIN.PAINEL', 'Senha1234', true)
    expect(entrada.sucesso).toBe(true)
    expect(entrada.sessaoId).toBeTypeOf('string')

    const usuario = await casos.usuarioDaSessao(entrada.sessaoId ?? null)
    expect(usuario?.login).toBe('admin.painel')
    expect(usuario?.nomeCompleto).toBe('Administradora')
  })

  it('recusa senha errada com a mesma mensagem de login inexistente', async () => {
    const casos = autenticacao()
    const errada = await casos.entrar('admin.painel', 'ErradaDemais1', false)
    const inexistente = await casos.entrar('nao.existe', 'ErradaDemais1', false)
    expect(errada.sucesso).toBe(false)
    expect(errada.mensagem).toBe(inexistente.mensagem)
  })

  it('bloqueia após tentativas repetidas', async () => {
    const casos = autenticacao()
    for (let i = 0; i < 5; i += 1) await casos.entrar('admin.painel', 'errada', false)
    const bloqueada = await casos.entrar('admin.painel', 'Senha1234', false)
    expect(bloqueada.sucesso).toBe(false)
    expect(bloqueada.mensagem).toMatch(/Muitas tentativas/)
  })

  it('sair invalida a sessão', async () => {
    const casos = autenticacao()
    const entrada = await casos.entrar('admin.painel', 'Senha1234', false)
    await casos.sair(entrada.sessaoId ?? null)
    expect(await casos.usuarioDaSessao(entrada.sessaoId ?? null)).toBeNull()
  })

  it('sessão de usuário desativado deixa de valer', async () => {
    const casos = autenticacao()
    const entrada = await casos.entrar('admin.painel', 'Senha1234', false)
    const usuario = await repositorio.usuarios.buscarUm({ login: 'admin.painel' })
    await repositorio.usuarios.atualizar(usuario?._id ?? '', { ativo: false })

    expect(await casos.usuarioDaSessao(entrada.sessaoId ?? null)).toBeNull()
    await repositorio.usuarios.atualizar(usuario?._id ?? '', { ativo: true })
  })
})

describe('escopo de cursos imposto no servidor', () => {
  it('a listagem devolve só o que o escopo alcança', async () => {
    const casos = new CasoDeUsoCursos(repositorio, new RelogioDoSistema())
    const todos = await casos.listar()
    expect(todos.length).toBeGreaterThan(0)

    const { EscopoDeAcesso } = await import('@/dominio/regras/escopo-de-acesso')
    const restrito = await casos.listar(new EscopoDeAcesso('professor', ['curso-inexistente']))
    expect(restrito).toHaveLength(0)
  })
})

describe('cursos gravados antes de campos novos existirem', () => {
  /**
   * Regressão encontrada ao migrar a base do desktop e tentar salvar o curso
   * pela tela: documentos anteriores ao campo `linhaMatricula` não têm a
   * chave, e `undefined` não é `null`. A validação lia "ausente" como
   * "preenchido com lixo" e recusava salvar — reclamando de um campo que
   * ninguém tinha tocado, num curso que ninguém tinha editado.
   */
  it('aceita salvar um curso cujo perfil de importação não traz linhaMatricula', async () => {
    const perfilAntigo = {
      linhaCabecalho: 3,
      colunaQuestao: 'A',
      colunaGabarito: 'B',
      colunaTema: 'C',
      colunaDocente: 'D',
      primeiraColunaAluno: 'E',
      marcadorAcerto: '1',
      linhaTotal: 39
    }

    const curso = await repositorio.cursos.inserir({
      nome: 'Curso Antigo',
      sigla: 'ANT',
      instituicao: 'PUC Minas',
      campus: '',
      departamento: '',
      nomeInstrumento: 'Teste de Progresso',
      estrutura: { totalQuestoes: 35, periodos: ['6º'], componentes: [] },
      areas: [],
      regua: [{ periodo: '6º', notaBase: 5, percentualMinimo: 40 }],
      // Exatamente como a base migrada: sem a chave.
      perfilImportacao: perfilAntigo as never,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    })

    const gravado = await repositorio.cursos.buscarPorId(curso._id)
    expect(gravado?.perfilImportacao.linhaMatricula).toBeUndefined()

    const casos = new CasoDeUsoCursos(repositorio, new RelogioDoSistema())
    const resultado = await casos.atualizar(curso._id, {
      nome: 'Curso Antigo',
      sigla: 'ANT',
      instituicao: 'PUC Minas',
      campus: 'Betim',
      departamento: 'Enfermagem',
      nomeInstrumento: 'Teste de Progresso',
      estrutura: gravado?.estrutura ?? { totalQuestoes: 35, periodos: ['6º'], componentes: [] },
      areas: [],
      regua: gravado?.regua ?? [],
      perfilImportacao: gravado?.perfilImportacao as never
    })

    expect(resultado).toMatchObject({ sucesso: true })

    const depois = await repositorio.cursos.buscarPorId(curso._id)
    expect(depois?.campus).toBe('Betim')
    // A ausência vira nulo, que é o valor documentado de "sem matrícula".
    expect(depois?.perfilImportacao.linhaMatricula).toBeNull()
  })
})
