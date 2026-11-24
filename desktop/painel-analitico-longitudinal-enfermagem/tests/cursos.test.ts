import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { ServicoCursos, cursoInicial } from '../src/main/servicos/cursos'
import type { DadosCurso } from '../src/shared/types/ipc'
import { normalizarRotuloPeriodo } from '../src/shared/periodos'

let pasta: string
let repositorio: RepositorioLocal
let cursos: ServicoCursos

function enfermagem(ajustes: Partial<DadosCurso> = {}): DadosCurso {
  return { ...cursoInicial(), nome: 'Enfermagem', sigla: 'ENF', ...ajustes }
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-cursos-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()
  cursos = new ServicoCursos(repositorio)
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('normalizarRotuloPeriodo', () => {
  it('reduz as variações da planilha à forma curta', () => {
    expect(normalizarRotuloPeriodo('6º P')).toBe('6º')
    expect(normalizarRotuloPeriodo('6º   Período')).toBe('6º')
    expect(normalizarRotuloPeriodo(' 10º P ')).toBe('10º')
  })
})

describe('cadastro de curso', () => {
  it('cadastra com os valores sugeridos', async () => {
    const resultado = await cursos.criar(enfermagem())
    expect(resultado.sucesso).toBe(true)
    if (!resultado.sucesso) return

    expect(resultado.curso.estrutura.totalQuestoes).toBe(35)
    expect(resultado.curso.estrutura.periodos).toEqual(['6º', '7º', '8º', '9º', '10º'])
    expect(resultado.curso.regua).toHaveLength(5)
    expect(resultado.curso.perfilImportacao.primeiraColunaAluno).toBe('E')
  })

  it('normaliza sigla e espaços', async () => {
    const resultado = await cursos.criar(enfermagem({ nome: '  Enfermagem   Noturno ', sigla: 'enf' }))
    expect(resultado.sucesso).toBe(true)
    if (!resultado.sucesso) return
    expect(resultado.curso.nome).toBe('Enfermagem Noturno')
    expect(resultado.curso.sigla).toBe('ENF')
  })

  it('recusa sigla repetida', async () => {
    await cursos.criar(enfermagem())
    const repetido = await cursos.criar(enfermagem({ nome: 'Outro curso' }))
    expect(repetido).toMatchObject({ sucesso: false })
  })
})

describe('validação da estrutura', () => {
  it('recusa componente fora da faixa de questões', async () => {
    const dados = enfermagem()
    dados.estrutura.componentes = [{ nome: 'Geral', questaoInicial: 1, questaoFinal: 40 }]
    const resultado = await cursos.criar(dados)
    expect(resultado).toMatchObject({ sucesso: false })
    if (resultado.sucesso) return
    expect(resultado.mensagem).toMatch(/fora da faixa/)
  })

  it('recusa componentes que se sobrepõem', async () => {
    const dados = enfermagem()
    dados.estrutura.componentes = [
      { nome: 'Geral', questaoInicial: 1, questaoFinal: 10 },
      { nome: 'Específico', questaoInicial: 8, questaoFinal: 35 }
    ]
    const resultado = await cursos.criar(dados)
    expect(resultado).toMatchObject({ sucesso: false })
    if (resultado.sucesso) return
    expect(resultado.mensagem).toMatch(/se sobrep/)
  })

  it('recusa curso sem período', async () => {
    const dados = enfermagem()
    dados.estrutura.periodos = []
    expect(await cursos.criar(dados)).toMatchObject({ sucesso: false })
  })

  it('recusa período repetido', async () => {
    const dados = enfermagem()
    dados.estrutura.periodos = ['6º', '6º']
    expect(await cursos.criar(dados)).toMatchObject({ sucesso: false })
  })
})

describe('validação da régua', () => {
  it('recusa período sem faixa correspondente', async () => {
    const dados = enfermagem()
    dados.regua = dados.regua.filter((faixa) => faixa.periodo !== '9º')
    const resultado = await cursos.criar(dados)
    expect(resultado).toMatchObject({ sucesso: false })
    if (resultado.sucesso) return
    expect(resultado.mensagem).toMatch(/9º/)
  })

  it('recusa nota base fora de 1 a 10 e percentual fora de 0 a 100', async () => {
    const comNota = enfermagem()
    comNota.regua = comNota.regua.map((faixa) =>
      faixa.periodo === '6º' ? { ...faixa, notaBase: 11 } : faixa
    )
    expect(await cursos.criar(comNota)).toMatchObject({ sucesso: false })

    const comPercentual = enfermagem({ sigla: 'EN2' })
    comPercentual.regua = comPercentual.regua.map((faixa) =>
      faixa.periodo === '6º' ? { ...faixa, percentualMinimo: 120 } : faixa
    )
    expect(await cursos.criar(comPercentual)).toMatchObject({ sucesso: false })
  })
})

describe('validação do mapeamento', () => {
  it('recusa coluna que não é letra de planilha', async () => {
    const dados = enfermagem()
    dados.perfilImportacao.colunaTema = '3'
    const resultado = await cursos.criar(dados)
    expect(resultado).toMatchObject({ sucesso: false })
    if (resultado.sucesso) return
    expect(resultado.mensagem).toMatch(/letra de planilha/)
  })

  it('recusa linha de total antes do cabeçalho', async () => {
    const dados = enfermagem()
    dados.perfilImportacao.linhaTotal = 2
    expect(await cursos.criar(dados)).toMatchObject({ sucesso: false })
  })

  it('aceita linha de total ausente', async () => {
    const dados = enfermagem()
    dados.perfilImportacao.linhaTotal = null
    expect(await cursos.criar(dados)).toMatchObject({ sucesso: true })
  })

  it('exige um marcador de acerto', async () => {
    const dados = enfermagem()
    dados.perfilImportacao.marcadorAcerto = '   '
    expect(await cursos.criar(dados)).toMatchObject({ sucesso: false })
  })
})

describe('edição e remoção', () => {
  it('salva alterações e atualiza a data', async () => {
    const criado = await cursos.criar(enfermagem())
    if (!criado.sucesso) throw new Error(criado.mensagem)

    const alterado = await cursos.atualizar(criado.curso._id, {
      ...enfermagem({ nome: 'Enfermagem Integral' })
    })
    expect(alterado.sucesso).toBe(true)
    if (!alterado.sucesso) return
    expect(alterado.curso.nome).toBe('Enfermagem Integral')
    expect(alterado.curso.criadoEm).toBe(criado.curso.criadoEm)
  })

  it('deixa remover curso sem aplicações', async () => {
    const criado = await cursos.criar(enfermagem())
    if (!criado.sucesso) throw new Error(criado.mensagem)
    expect(await cursos.remover(criado.curso._id)).toMatchObject({ sucesso: true })
    expect(await cursos.listar()).toHaveLength(0)
  })

  it('protege curso que já tem aplicação importada', async () => {
    const criado = await cursos.criar(enfermagem())
    if (!criado.sucesso) throw new Error(criado.mensagem)

    await repositorio.aplicacoes.inserir({
      cursoId: criado.curso._id,
      rotulo: '2025/1',
      semestre: 1,
      ano: 2025,
      dataImportacao: new Date().toISOString(),
      importadoPor: 'admin',
      arquivoOriginal: 'planilha.xlsx',
      hashArquivo: 'abc',
      periodos: ['6º'],
      totalDiscentes: 22,
      totalRegistros: 770,
      status: 'concluida'
    })

    const resultado = await cursos.remover(criado.curso._id)
    expect(resultado).toMatchObject({ sucesso: false })
    expect(resultado.mensagem).toMatch(/aplicação/)
  })
})
