import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { agruparGrafias, chaveComparacao, proximoPseudonimo } from '../src/main/etl/normalizador'
import { ServicoCursos, cursoInicial } from '../src/main/servicos/cursos'
import { ServicoImportacao } from '../src/main/servicos/importacao'
import type { AnaliseImportacao, DecisoesImportacao } from '../src/shared/types/importacao'
import { PLANILHA_2025, PLANILHA_2026, exigir, temPlanilhas } from './planilhas'


let pasta: string
let repositorio: RepositorioLocal
let importacao: ServicoImportacao
let cursoId: string

async function analisar(caminho: string, rotulo: string): Promise<AnaliseImportacao> {
  const analise = await importacao.analisar(caminho, cursoId, rotulo)
  if ('erro' in analise) throw new Error(analise.erro)
  return analise
}

function decisoesDe(analise: AnaliseImportacao, extras: Partial<DecisoesImportacao> = {}): DecisoesImportacao {
  return {
    caminho: analise.caminho,
    cursoId,
    rotulo: analise.rotulo,
    abas: analise.abas
      .filter((aba) => aba.tipo === 'desempenho' && aba.periodoSugerido)
      .map((aba) => ({ nome: aba.nome, periodo: aba.periodoSugerido as string })),
    unificacoes: [],
    substituirAnterior: false,
    ...extras
  }
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-import-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()

  const cursos = new ServicoCursos(repositorio)
  const criado = await cursos.criar({ ...cursoInicial(), nome: 'Enfermagem', sigla: 'ENF' })
  if (!criado.sucesso) throw new Error(criado.mensagem)
  cursoId = criado.curso._id

  importacao = new ServicoImportacao(repositorio)
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('agruparGrafias', () => {
  it('agrupa o que difere em caixa ou acento', () => {
    const clusters = agruparGrafias(['NInon', 'Ninon', 'Ninon', 'Ângela', 'Angela'])
    expect(clusters).toHaveLength(2)
    // A grafia mais frequente é a sugerida.
    expect(clusters.find((c) => c.sugestao === 'Ninon')?.variantes).toHaveLength(2)
  })

  it('não pergunta sobre diferença que é só de espaço', () => {
    // Aparar espaço não muda o que está escrito: é automático, não decisão.
    expect(agruparGrafias(['Mônica ', 'Mônica', ' 8 Juliana', '8 Juliana'])).toHaveLength(0)
  })

  it('propõe juntar o que difere por uma letra, sem decidir sozinho', () => {
    // "Diagósticos" é erro de digitação na origem. Vira proposta, não unificação.
    const clusters = agruparGrafias(['Diagósticos de Enfermagem', 'Diagnósticos de Enfermagem'])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.variantes).toHaveLength(2)
  })

  it('agrupa o nome escrito com o número da questão na frente', () => {
    // A amostra traz "NInon" em uma aba e "1 NInon" em outra.
    const clusters = agruparGrafias(['NInon', 'NInon', '1 NInon', 'Ninon'])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.sugestao).toBe('NInon')
  })

  it('não aproxima textos curtos', () => {
    expect(agruparGrafias(['Ana', 'Ane'])).toHaveLength(0)
  })

  it('ignora quem aparece com uma grafia só', () => {
    expect(agruparGrafias(['Renata', 'Renata', 'Patrícia'])).toHaveLength(0)
  })
})

describe('proximoPseudonimo', () => {
  it('numera a partir de 1 com três dígitos', () => {
    expect(proximoPseudonimo('ENF', 0)).toBe('ENF-001')
    expect(proximoPseudonimo('enf', 41)).toBe('ENF-042')
  })
})

describe.skipIf(!temPlanilhas)('análise da planilha real', () => {
  it('reconhece cada aba pelo que ela é', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const porTipo = (tipo: string): string[] =>
      analise.abas.filter((aba) => aba.tipo === tipo).map((aba) => aba.nome.trim())

    expect(porTipo('desempenho')).toHaveLength(5)
    expect(porTipo('modelo')).toEqual(['MODELO'])
    expect(porTipo('regua')).toEqual(['Nota TP à partir dos %'])
    expect(porTipo('derivada')).toEqual(['Questões abaixo 50%'])
  })

  it('deduz o período de cada aba de desempenho', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const periodos = analise.abas
      .filter((aba) => aba.tipo === 'desempenho')
      .map((aba) => aba.periodoSugerido)
    expect(periodos).toEqual(['6º', '7º', '8º', '9º', '10º'])
  })

  it('conta discentes, questões e registros sem importar nada', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    expect(analise.resumo.totalDiscentes).toBe(178)
    expect(analise.resumo.totalQuestoes).toBe(175)
    expect(analise.resumo.totalRegistros).toBe(6335)
    expect(await repositorio.aplicacoes.contar()).toBe(0)
    expect(await repositorio.desempenho.contar()).toBe(0)
  })

  it('encontra as grafias divergentes de docente da amostra', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const docentes = analise.clusters.filter((cluster) => cluster.campo === 'docente')
    const variantes = docentes.map((cluster) => cluster.variantes.map((v) => v.texto).sort())

    // Cada docente aparece com o nome limpo e com o número da questão na frente.
    const ninon = docentes.find((cluster) => cluster.sugestao.toLowerCase().includes('ninon'))
    expect(ninon?.variantes.map((v) => v.texto)).toEqual(
      expect.arrayContaining(['NInon', 'Ninon'])
    )

    // "Angea" é erro de digitação de "Angela": entra no mesmo grupo, como proposta.
    const angela = docentes.find((cluster) =>
      cluster.variantes.some((v) => v.texto.includes('Angea'))
    )
    expect(angela?.variantes.map((v) => v.texto)).toEqual(
      expect.arrayContaining(['Angea', 'Angela'])
    )
  })

  it('avisa sobre discentes repetidos em mais de um período', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const ocorrencia = analise.ocorrencias.find(
      (item) => item.codigo === 'discente-em-mais-de-um-periodo'
    )
    expect(ocorrencia?.severidade).toBe('atencao')
    expect(ocorrencia?.detalhes).toHaveLength(3)
  })

  it('recusa rótulo de aplicação fora do formato', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), 'segundo semestre')
    expect(analise.podeImportar).toBe(false)
    expect(analise.ocorrencias.some((item) => item.codigo === 'rotulo-invalido')).toBe(true)
  })

  it('informa quais abas ficam de fora', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const ocorrencia = analise.ocorrencias.find((item) => item.codigo === 'abas-ignoradas')
    expect(ocorrencia?.detalhes).toHaveLength(3)
  })
})

describe.skipIf(!temPlanilhas)('importação da planilha real', () => {
  it('grava a aplicação inteira no modelo canônico', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const resultado = await importacao.importar(decisoesDe(analise), 'admin')

    expect(resultado.sucesso).toBe(true)
    if (!resultado.sucesso) return

    expect(resultado.resumo.periodos).toEqual(['6º', '7º', '8º', '9º', '10º'])
    expect(resultado.resumo.totalDiscentes).toBe(178)
    expect(resultado.resumo.totalQuestoes).toBe(175)
    expect(resultado.resumo.totalRegistros).toBe(6335)

    expect(await repositorio.desempenho.contar()).toBe(6335)
    expect(await repositorio.questoes.contar()).toBe(175)
    expect(await repositorio.discentes.contar()).toBe(178)
    expect(await repositorio.aplicacoes.contar()).toBe(1)
  })

  it('calcula percentual e nota médios compatíveis com o diagnóstico da amostra', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const resultado = await importacao.importar(decisoesDe(analise), 'admin')
    if (!resultado.sucesso) throw new Error(resultado.mensagem)

    // O documento executivo apurou acerto médio de 63% na amostra.
    expect(resultado.resumo.percentualMedio).toBeGreaterThan(55)
    expect(resultado.resumo.percentualMedio).toBeLessThan(70)
    expect(resultado.resumo.notaMedia).toBeGreaterThan(0)
    expect(resultado.resumo.notaMedia).toBeLessThanOrEqual(10)
  })

  it('dá pseudônimo estável a cada discente e marca o componente de cada questão', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    await importacao.importar(decisoesDe(analise), 'admin')

    const discentes = await repositorio.discentes.buscar()
    expect(discentes[0]?.pseudonimo).toBe('ENF-001')
    expect(new Set(discentes.map((d) => d.pseudonimo)).size).toBe(discentes.length)

    const questoes = await repositorio.questoes.buscar()
    const geral = questoes.filter((q) => q.componente === 'Componente Geral')
    const especifico = questoes.filter((q) => q.componente === 'Componente Específico')
    expect(geral).toHaveLength(8 * 5)
    expect(especifico).toHaveLength(27 * 5)
  })

  it('aplica as unificações de grafia confirmadas', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const unificacoes = analise.clusters
      .filter((cluster) => cluster.campo === 'docente')
      .map((cluster) => ({
        campo: cluster.campo,
        chaves: cluster.chavesVariantes,
        para: cluster.sugestao
      }))

    await importacao.importar(decisoesDe(analise, { unificacoes }), 'admin')

    const docentes = new Set(
      (await repositorio.questoes.buscar()).map((questao) => questao.docenteResponsavel)
    )
    expect(docentes.has('NInon')).toBe(false)
    expect(docentes.has('Ninon')).toBe(true)
    expect(docentes.has('Mônica ')).toBe(false)
    expect([...docentes].some((nome) => nome !== nome.trim())).toBe(false)
  })

  it('bloqueia a reimportação do mesmo arquivo', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    await importacao.importar(decisoesDe(analise), 'admin')

    const segunda = await analisar(exigir(PLANILHA_2025), '2025/2')
    expect(segunda.aplicacaoExistente).not.toBeNull()
    expect(segunda.ocorrencias.some((item) => item.codigo === 'aplicacao-ja-importada')).toBe(true)

    const recusada = await importacao.importar(decisoesDe(segunda), 'admin')
    expect(recusada.sucesso).toBe(false)
    expect(await repositorio.desempenho.contar()).toBe(6335)
  })

  it('substitui a importação anterior sem duplicar registros', async () => {
    const primeira = await analisar(exigir(PLANILHA_2025), '2025/2')
    await importacao.importar(decisoesDe(primeira), 'admin')

    const segunda = await analisar(exigir(PLANILHA_2025), '2025/2')
    const resultado = await importacao.importar(
      decisoesDe(segunda, { substituirAnterior: true }),
      'admin'
    )

    expect(resultado.sucesso).toBe(true)
    expect(await repositorio.aplicacoes.contar()).toBe(1)
    expect(await repositorio.desempenho.contar()).toBe(6335)
    expect(await repositorio.questoes.contar()).toBe(175)
    // Os discentes são reencontrados, não recriados.
    expect(await repositorio.discentes.contar()).toBe(178)
  })

  it('acumula a segunda aplicação e reencontra os discentes', async () => {
    const primeira = await analisar(exigir(PLANILHA_2025), '2025/2')
    await importacao.importar(decisoesDe(primeira), 'admin')

    const segunda = await analisar(exigir(PLANILHA_2026), '2026/1')
    expect(segunda.aplicacaoExistente).toBeNull()

    const resultado = await importacao.importar(decisoesDe(segunda), 'admin')
    expect(resultado.sucesso).toBe(true)
    if (!resultado.sucesso) return

    // 144 discentes na segunda aplicação, 116 deles já conhecidos.
    expect(resultado.resumo.totalDiscentes).toBe(144)
    expect(resultado.resumo.discentesReencontrados).toBe(116)
    expect(resultado.resumo.discentesNovos).toBe(28)

    expect(await repositorio.aplicacoes.contar()).toBe(2)
    expect(await repositorio.discentes.contar()).toBe(178 + 28)
    expect(await repositorio.desempenho.contar()).toBe(6335 + 5040)
  })

  it('registra o histórico e remove tudo ao excluir a aplicação', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const resultado = await importacao.importar(decisoesDe(analise), 'admin')
    if (!resultado.sucesso) throw new Error(resultado.mensagem)

    const historico = await importacao.historico()
    expect(historico).toHaveLength(1)
    expect(historico[0]?.cursoNome).toBe('Enfermagem')
    expect(historico[0]?.status).toBe('concluida_com_avisos')
    expect(historico[0]?.ocorrencias.length).toBeGreaterThan(0)

    await importacao.excluirAplicacao(resultado.resumo.aplicacaoId)

    expect(await repositorio.aplicacoes.contar()).toBe(0)
    expect(await repositorio.desempenho.contar()).toBe(0)
    expect(await repositorio.questoes.contar()).toBe(0)
    // Os discentes permanecem: eles pertencem ao curso, não à aplicação.
    expect(await repositorio.discentes.contar()).toBe(178)
  })

  it('recusa arquivo que não é planilha, sem quebrar', async () => {
    const analise = await importacao.analisar(join(import.meta.dirname, '..', 'README.md'), cursoId, '2025/2')
    expect('erro' in analise).toBe(true)
  })
})

describe.skipIf(!temPlanilhas)('discentes sem nenhum acerto', () => {
  it('avisa sobre quem zerou, porque pode ser ausência', async () => {
    const analise = await analisar(exigir(PLANILHA_2025), '2025/2')
    const ocorrencia = analise.ocorrencias.find(
      (item) => item.codigo === 'discente-sem-nenhum-acerto'
    )
    expect(ocorrencia?.severidade).toBe('atencao')
    expect(ocorrencia?.detalhes?.length).toBeGreaterThan(0)
    expect(ocorrencia?.mensagem).toMatch(/nota base/)
  })
})
