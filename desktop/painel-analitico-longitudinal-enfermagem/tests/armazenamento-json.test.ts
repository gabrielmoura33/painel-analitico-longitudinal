import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'

let pasta: string
let caminho: string
let repositorio: RepositorioLocal

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-teste-'))
  caminho = join(pasta, 'dados.json')
  repositorio = new RepositorioLocal(caminho)
  await repositorio.conectar()
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('RepositorioLocal', () => {
  it('insere e recupera um documento atribuindo _id', async () => {
    const curso = await repositorio.cursos.inserir({
      nome: 'Enfermagem',
      sigla: 'ENF',
      instituicao: 'PUC Minas',
      campus: 'Coração Eucarístico',
      departamento: 'Enfermagem',
      nomeInstrumento: 'Teste de Progresso',
      estrutura: { totalQuestoes: 35, periodos: ['6º'], componentes: [] },
      areas: [],
      regua: [],
      perfilImportacao: {
        linhaCabecalho: 3,
        linhaMatricula: null,
        colunaQuestao: 'A',
        colunaGabarito: 'B',
        colunaTema: 'C',
        colunaDocente: 'D',
        primeiraColunaAluno: 'E',
        marcadorAcerto: '1',
        linhaTotal: 39
      },
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    })

    expect(curso._id).toBeTruthy()
    expect(await repositorio.cursos.buscarPorId(curso._id)).toMatchObject({ sigla: 'ENF' })
    expect(await repositorio.cursos.contar()).toBe(1)
  })

  it('filtra por igualdade de campos', async () => {
    await repositorio.discentes.inserirVarios([
      { cursoId: 'c1', nomeCompleto: 'A', matricula: null, pseudonimo: 'ENF-001', ativo: true, criadoEm: 'x' },
      { cursoId: 'c2', nomeCompleto: 'B', matricula: null, pseudonimo: 'ENF-002', ativo: true, criadoEm: 'x' }
    ])

    const doCurso1 = await repositorio.discentes.buscar({ cursoId: 'c1' })
    expect(doCurso1).toHaveLength(1)
    expect(doCurso1[0]?.pseudonimo).toBe('ENF-001')
  })

  it('devolve cópias, para que o chamador não altere o banco por referência', async () => {
    const criado = await repositorio.discentes.inserir({
      cursoId: 'c1',
      nomeCompleto: 'Maria',
      matricula: null,
      pseudonimo: 'ENF-001',
      ativo: true,
      criadoEm: 'x'
    })

    criado.nomeCompleto = 'ALTERADO FORA DO BANCO'
    const relido = await repositorio.discentes.buscarPorId(criado._id)
    expect(relido?.nomeCompleto).toBe('Maria')
  })

  it('desfaz tudo quando a transação falha', async () => {
    await repositorio.cursos.inserir({
      nome: 'Antes',
      sigla: 'A',
      instituicao: 'PUC',
      campus: '',
      departamento: '',
      nomeInstrumento: 'TP',
      estrutura: { totalQuestoes: 1, periodos: [], componentes: [] },
      areas: [],
      regua: [],
      perfilImportacao: {
        linhaCabecalho: 1,
        linhaMatricula: null,
        colunaQuestao: 'A',
        colunaGabarito: 'B',
        colunaTema: 'C',
        colunaDocente: 'D',
        primeiraColunaAluno: 'E',
        marcadorAcerto: '1',
        linhaTotal: null
      },
      criadoEm: 'x',
      atualizadoEm: 'x'
    })

    await expect(
      repositorio.transacao(async () => {
        await repositorio.discentes.inserirVarios([
          { cursoId: 'c1', nomeCompleto: 'X', matricula: null, pseudonimo: 'P1', ativo: true, criadoEm: 'x' },
          { cursoId: 'c1', nomeCompleto: 'Y', matricula: null, pseudonimo: 'P2', ativo: true, criadoEm: 'x' }
        ])
        throw new Error('falha no meio da carga')
      })
    ).rejects.toThrow('falha no meio da carga')

    expect(await repositorio.discentes.contar()).toBe(0)
    expect(await repositorio.cursos.contar()).toBe(1)

    const emDisco = JSON.parse(readFileSync(caminho, 'utf8')) as Record<string, unknown[]>
    expect(emDisco.discentes).toHaveLength(0)
  })

  it('persiste entre instâncias', async () => {
    await repositorio.usuarios.inserir({
      nomeCompleto: 'Admin',
      cpf: '00000000000',
      dataNascimento: '1990-01-01',
      login: 'admin',
      senhaHash: 'hash',
      perfil: 'administrador',
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: true,
      ultimoAcesso: null,
      termoAceitoEm: null,
      criadoEm: 'x'
    })

    const outra = new RepositorioLocal(caminho)
    await outra.conectar()
    expect(await outra.usuarios.contar()).toBe(1)
  })
})
