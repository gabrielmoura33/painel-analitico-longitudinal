import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { ServicoCursos, cursoInicial } from '../src/main/servicos/cursos'
import { ServicoImportacao } from '../src/main/servicos/importacao'
import { ServicoIndicadores } from '../src/main/servicos/indicadores'
import type { AnaliseImportacao } from '../src/shared/types/importacao'
import { PLANILHA_2025, PLANILHA_2026, exigir, temPlanilhas } from './planilhas'


let pasta: string
let repositorio: RepositorioLocal
let indicadores: ServicoIndicadores
let cursoId: string
let aplicacao2025 = ''
let aplicacao2026 = ''

// A montagem é cara (importa duas planilhas reais): roda uma vez para o arquivo.
beforeAll(async () => {
  if (!temPlanilhas) return

  pasta = mkdtempSync(join(tmpdir(), 'painel-indic-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()

  const cursos = new ServicoCursos(repositorio)
  const criado = await cursos.criar({ ...cursoInicial(), nome: 'Enfermagem', sigla: 'ENF' })
  if (!criado.sucesso) throw new Error(criado.mensagem)
  cursoId = criado.curso._id

  const importacao = new ServicoImportacao(repositorio)
  indicadores = new ServicoIndicadores(repositorio)

  for (const [caminho, rotulo] of [
    [exigir(PLANILHA_2025), '2025/2'],
    [exigir(PLANILHA_2026), '2026/1']
  ] as const) {
    const analise = (await importacao.analisar(caminho, cursoId, rotulo)) as AnaliseImportacao
    const resultado = await importacao.importar(
      {
        caminho,
        cursoId,
        rotulo,
        abas: analise.abas
          .filter((aba) => aba.tipo === 'desempenho' && aba.periodoSugerido)
          .map((aba) => ({ nome: aba.nome, periodo: aba.periodoSugerido as string })),
        unificacoes: analise.clusters.map((cluster) => ({
          campo: cluster.campo,
          chaves: cluster.chavesVariantes,
          para: cluster.sugestao
        })),
        substituirAnterior: false
      },
      'admin'
    )
    if (!resultado.sucesso) throw new Error(resultado.mensagem)
    if (rotulo === '2025/2') aplicacao2025 = resultado.resumo.aplicacaoId
    else aplicacao2026 = resultado.resumo.aplicacaoId
  }
}, 60_000)

afterAll(() => {
  if (pasta) rmSync(pasta, { recursive: true, force: true })
})

describe.skipIf(!temPlanilhas)('contexto do painel', () => {
  it('escolhe a aplicação mais recente por padrão', async () => {
    const contexto = await indicadores.contexto()
    expect(contexto.cursoId).toBe(cursoId)
    expect(contexto.aplicacoes.map((a) => a.rotulo)).toEqual(['2025/2', '2026/1'])
    expect(contexto.aplicacaoId).toBe(aplicacao2026)
  })

  it('respeita a aplicação escolhida quando ela existe', async () => {
    const contexto = await indicadores.contexto(cursoId, aplicacao2025)
    expect(contexto.aplicacaoId).toBe(aplicacao2025)
  })
})

describe.skipIf(!temPlanilhas)('visão geral', () => {
  it('calcula os indicadores da aplicação de 2025/2', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    expect(visao).not.toBeNull()
    if (!visao) return

    expect(visao.kpis.totalDiscentes).toBe(178)
    expect(visao.kpis.totalQuestoes).toBe(35)
    expect(visao.kpis.percentualMedio).toBeGreaterThan(50)
    expect(visao.kpis.percentualMedio).toBeLessThan(70)
    expect(visao.kpis.acertosMedios).toBeCloseTo((visao.kpis.percentualMedio / 100) * 35, 1)
    expect(visao.kpis.notaMedia).toBeGreaterThan(0)
  })

  it('separa os componentes configurados no curso', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    const nomes = visao?.porComponente.map((item) => item.nome) ?? []
    expect(nomes).toEqual(['Componente Específico', 'Componente Geral'])

    const geral = visao?.porComponente.find((item) => item.nome === 'Componente Geral')
    const especifico = visao?.porComponente.find((item) => item.nome === 'Componente Específico')
    expect(geral?.questoes).toBe(8)
    expect(especifico?.questoes).toBe(27)
    // O diagnóstico do projeto registra o Geral bem acima do Específico.
    expect(geral!.percentual).toBeGreaterThan(especifico!.percentual)
  })

  it('monta a série longitudinal com as duas aplicações', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2026)
    expect(visao?.serie.map((ponto) => ponto.rotulo)).toEqual(['2025/2', '2026/1'])
    expect(visao?.serie[0]?.discentes).toBe(178)
    expect(visao?.serie[1]?.discentes).toBe(144)
  })

  it('compara com a aplicação anterior e não inventa comparação quando não há', async () => {
    const primeira = await indicadores.visaoGeral(cursoId, aplicacao2025)
    expect(primeira?.variacao.percentualMedio).toBeNull()
    expect(primeira?.variacao.notaMedia).toBeNull()

    const segunda = await indicadores.visaoGeral(cursoId, aplicacao2026)
    expect(typeof segunda?.variacao.percentualMedio).toBe('number')
  })

  it('ordena as áreas da pior para a melhor e classifica a situação', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    const areas = visao?.areas ?? []
    expect(areas.length).toBe(35)

    const percentuais = areas.map((area) => area.percentual)
    expect([...percentuais].sort((a, b) => a - b)).toEqual(percentuais)

    for (const area of areas) {
      if (area.percentual < 50) expect(area.situacao).toBe('critica')
      else if (area.percentual < 70) expect(area.situacao).toBe('atencao')
      else expect(area.situacao).toBe('boa')
    }
  })

  it('traz histórico de área só a partir da segunda aplicação', async () => {
    const primeira = await indicadores.visaoGeral(cursoId, aplicacao2025)
    expect(primeira?.areas.every((area) => area.percentualHistorico === null)).toBe(true)

    const segunda = await indicadores.visaoGeral(cursoId, aplicacao2026)
    expect(segunda?.areas.some((area) => area.percentualHistorico !== null)).toBe(true)
  })

  it('distribui as notas somando 100%', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    const faixas = visao?.distribuicaoNotas ?? []
    expect(faixas.length).toBeGreaterThan(0)
    expect(faixas.reduce((soma, faixa) => soma + faixa.percentual, 0)).toBeCloseTo(100, 6)
    expect(faixas.every((faixa) => faixa.nota >= 1 && faixa.nota <= 10)).toBe(true)
  })

  it('agrupa por período os cinco períodos avaliados', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    expect(visao?.porPeriodo.map((linha) => linha.periodo)).toEqual(['6º', '7º', '8º', '9º', '10º'])
    expect(visao?.porPeriodo.reduce((soma, linha) => soma + linha.discentes, 0)).toBe(181)
  })

  it('produz destaques a partir do dado, não de texto fixo', async () => {
    const visao = await indicadores.visaoGeral(cursoId, aplicacao2025)
    const destaques = visao?.destaques ?? []
    expect(destaques.length).toBeGreaterThanOrEqual(3)
    expect(destaques.some((destaque) => destaque.titulo.includes('Componente'))).toBe(true)
  })
})

describe.skipIf(!temPlanilhas)('visão de turma', () => {
  it('traz o primeiro período quando nenhum é pedido', async () => {
    const visao = await indicadores.visaoTurma(cursoId, aplicacao2025)
    expect(visao?.periodo).toBe('6º')
    expect(visao?.periodosDisponiveis).toEqual(['6º', '7º', '8º', '9º', '10º'])
    expect(visao?.kpis.totalDiscentes).toBe(38)
  })

  it('lista discentes pseudonimizados, do maior para o menor acerto', async () => {
    const visao = await indicadores.visaoTurma(cursoId, aplicacao2025, '7º')
    const discentes = visao?.discentes ?? []
    expect(discentes).toHaveLength(30)
    expect(discentes.every((linha) => /^ENF-\d{3}$/.test(linha.pseudonimo))).toBe(true)

    const percentuais = discentes.map((linha) => linha.percentual)
    expect([...percentuais].sort((a, b) => b - a)).toEqual(percentuais)
  })

  it('não expõe nome real em nenhum campo da visão coletiva', async () => {
    const visao = await indicadores.visaoTurma(cursoId, aplicacao2025, '6º')
    expect(JSON.stringify(visao)).not.toMatch(/Alice|Amanda|Beatriz/i)
  })

  it('calcula a variação só para quem já tinha resultado anterior', async () => {
    const primeira = await indicadores.visaoTurma(cursoId, aplicacao2025, '6º')
    expect(primeira?.discentes.every((linha) => linha.variacao === null)).toBe(true)

    const segunda = await indicadores.visaoTurma(cursoId, aplicacao2026, '7º')
    expect(segunda?.discentes.some((linha) => linha.variacao !== null)).toBe(true)
  })

  it('monta histograma que soma o total de discentes do período', async () => {
    const visao = await indicadores.visaoTurma(cursoId, aplicacao2025, '8º')
    const total = visao?.histograma.reduce((soma, faixa) => soma + faixa.quantidade, 0)
    expect(total).toBe(visao?.kpis.totalDiscentes)
  })

  it('descreve a dispersão de cada área com os quartis em ordem', async () => {
    const visao = await indicadores.visaoTurma(cursoId, aplicacao2025, '6º')
    const dispersao = visao?.dispersaoPorArea ?? []
    expect(dispersao).toHaveLength(35)

    for (const area of dispersao) {
      expect(area.minimo).toBeLessThanOrEqual(area.q1)
      expect(area.q1).toBeLessThanOrEqual(area.mediana)
      expect(area.mediana).toBeLessThanOrEqual(area.q3)
      expect(area.q3).toBeLessThanOrEqual(area.maximo)
    }
  })

  it('devolve nulo para aplicação inexistente', async () => {
    expect(await indicadores.visaoTurma(cursoId, 'nao-existe')).toBeNull()
    expect(await indicadores.visaoGeral(cursoId, 'nao-existe')).toBeNull()
  })
})

describe.skipIf(!temPlanilhas)('áreas de conhecimento', () => {
  it('avisa quando o curso ainda não agrupou os temas', async () => {
    const visao = await indicadores.visaoAreas(cursoId, aplicacao2025)
    expect(visao?.agrupadoPorArea).toBe(false)
    // Sem agrupamento, cada tema da planilha vira uma linha — e são 35.
    expect(visao?.areas).toHaveLength(35)
    expect(visao?.temasSemArea).toBe(35)
  })

  it('agrupa pelos temas cadastrados e reúne o resto em "Sem área definida"', async () => {
    const cursos = new ServicoCursos(repositorio)
    const curso = await cursos.obter(cursoId)
    if (!curso) throw new Error('curso não encontrado')

    const temas = await cursos.temasImportados(cursoId)
    const configurado = await cursos.atualizar(cursoId, {
      nome: curso.nome,
      sigla: curso.sigla,
      instituicao: curso.instituicao,
      campus: curso.campus,
      departamento: curso.departamento,
      nomeInstrumento: curso.nomeInstrumento,
      estrutura: curso.estrutura,
      regua: curso.regua,
      perfilImportacao: curso.perfilImportacao,
      areas: [
        { nome: 'Fundamentos', temas: temas.slice(0, 10) },
        { nome: 'Saúde Coletiva', temas: temas.slice(10, 20) }
      ]
    })
    expect(configurado.sucesso).toBe(true)

    const visao = await indicadores.visaoAreas(cursoId, aplicacao2025)
    expect(visao?.agrupadoPorArea).toBe(true)

    const nomes = visao?.areas.map((area) => area.tema) ?? []
    expect(nomes).toContain('Fundamentos')
    expect(nomes).toContain('Saúde Coletiva')
    expect(nomes).toContain('Sem área definida')
    expect(nomes.length).toBeLessThan(35)

    const fundamentos = visao?.areas.find((area) => area.tema === 'Fundamentos')
    expect(fundamentos?.questoes).toBeGreaterThan(1)
  })

  it('monta a matriz com uma célula por período', async () => {
    const visao = await indicadores.visaoAreas(cursoId, aplicacao2025)
    expect(visao?.periodos).toEqual(['6º', '7º', '8º', '9º', '10º'])
    for (const linha of visao?.matriz ?? []) {
      expect(linha.celulas).toHaveLength(5)
      for (const celula of linha.celulas) {
        if (celula.percentual !== null) {
          expect(celula.percentual).toBeGreaterThanOrEqual(0)
          expect(celula.percentual).toBeLessThanOrEqual(100)
          expect(celula.questoes).toBeGreaterThan(0)
        }
      }
    }
  })

  it('traz a evolução com um ponto por aplicação', async () => {
    const visao = await indicadores.visaoAreas(cursoId, aplicacao2026)
    expect(visao?.evolucao.rotulos).toEqual(['2025/2', '2026/1'])
    for (const serie of visao?.evolucao.series ?? []) {
      expect(serie.valores.map((valor) => valor.rotulo)).toEqual(['2025/2', '2026/1'])
    }
  })

  it('reflete o agrupamento também na visão geral e na dispersão da turma', async () => {
    const geral = await indicadores.visaoGeral(cursoId, aplicacao2025)
    expect(geral?.areas.map((area) => area.tema)).toContain('Fundamentos')

    const turma = await indicadores.visaoTurma(cursoId, aplicacao2025, '6º')
    expect(turma?.dispersaoPorArea.map((area) => area.tema)).toContain('Fundamentos')
  })
})

describe.skipIf(!temPlanilhas)('questões', () => {
  it('descreve cada questão com acerto por período e dificuldade', async () => {
    const visao = await indicadores.visaoQuestoes(cursoId, aplicacao2025)
    expect(visao?.questoes).toHaveLength(35)

    const percentuais = visao?.questoes.map((questao) => questao.percentual) ?? []
    expect([...percentuais].sort((a, b) => a - b)).toEqual(percentuais)

    for (const questao of visao?.questoes ?? []) {
      expect(questao.porPeriodo).toHaveLength(5)
      if (questao.percentual < 50) expect(questao.dificuldade).toBe('dificil')
      else if (questao.percentual < 70) expect(questao.dificuldade).toBe('media')
      else expect(questao.dificuldade).toBe('facil')
    }
  })

  it('marca as questões abaixo de 50% em todos os períodos', async () => {
    const visao = await indicadores.visaoQuestoes(cursoId, aplicacao2025)
    const criticas = visao?.questoes.filter((questao) => questao.criticaEmTodosOsPeriodos) ?? []
    expect(visao?.totalCriticas).toBe(criticas.length)
    expect(criticas.length).toBeGreaterThan(0)

    for (const questao of criticas) {
      for (const ponto of questao.porPeriodo) {
        if (ponto.percentual !== null) expect(ponto.percentual).toBeLessThan(50)
      }
    }
  })

  it('declara que a distribuição de alternativas não existe na fonte', async () => {
    const visao = await indicadores.visaoQuestoes(cursoId, aplicacao2025)
    expect(visao?.distribuicaoAlternativasDisponivel).toBe(false)
  })
})

describe.skipIf(!temPlanilhas)('ficha do discente', () => {
  it('encontra por nome e por pseudônimo', async () => {
    const porPseudonimo = await indicadores.buscarDiscentes(cursoId, 'ENF-001')
    expect(porPseudonimo).toHaveLength(1)

    const alvo = porPseudonimo[0]
    if (!alvo) throw new Error('discente não encontrado')

    const porNome = await indicadores.buscarDiscentes(cursoId, alvo.nomeCompleto.split(' ')[0] ?? '')
    expect(porNome.some((item) => item._id === alvo._id)).toBe(true)
  })

  it('ignora busca curta demais', async () => {
    expect(await indicadores.buscarDiscentes(cursoId, 'a')).toHaveLength(0)
  })

  it('monta a trajetória de quem fez as duas aplicações', async () => {
    const candidatos = await indicadores.buscarDiscentes(cursoId, 'ENF-0')
    const reencontrado = candidatos.find((item) => item.aplicacoes === 2)
    expect(reencontrado, 'nenhum discente com duas aplicações').toBeDefined()
    if (!reencontrado) return

    const visao = await indicadores.visaoDiscente(cursoId, reencontrado._id)
    expect(visao?.nomeCompleto).toBe(reencontrado.nomeCompleto)
    expect(visao?.trajetoria).toHaveLength(2)
    expect(visao?.trajetoria.map((ponto) => ponto.rotulo)).toEqual(['2025/2', '2026/1'])

    for (const ponto of visao?.trajetoria ?? []) {
      expect(ponto.total).toBe(35)
      expect(ponto.percentual).toBeCloseTo((ponto.acertos / 35) * 100, 6)
      expect(ponto.percentualDaTurma).toBeGreaterThan(0)
    }

    expect(visao?.ultimo?.rotulo).toBe('2026/1')
    expect(visao?.ultimo?.percentil).toBeGreaterThanOrEqual(0)
    expect(visao?.ultimo?.percentil).toBeLessThanOrEqual(100)
  })

  it('compara cada área com a média da turma', async () => {
    const candidatos = await indicadores.buscarDiscentes(cursoId, 'ENF-0')
    const alvo = candidatos.find((item) => item.aplicacoes === 2)
    if (!alvo) return

    const visao = await indicadores.visaoDiscente(cursoId, alvo._id)
    expect(visao?.areas.length).toBeGreaterThan(0)
    expect(visao?.areas.some((area) => area.mediaDaTurma !== null)).toBe(true)
  })
})

describe.skipIf(!temPlanilhas)('docentes responsáveis', () => {
  it('agrupa as questões por autoria, já com as grafias unificadas', async () => {
    const visao = await indicadores.visaoDocentes(cursoId, aplicacao2025)
    const nomes = visao?.docentes.map((docente) => docente.docente) ?? []

    expect(nomes.length).toBeGreaterThan(5)
    expect(nomes).not.toContain('NInon')
    expect(nomes.some((nome) => nome !== nome.trim())).toBe(false)
    // Nenhum nome carrega o número da questão que a planilha colou na frente.
    expect(nomes.some((nome) => /^\d/.test(nome))).toBe(false)

    // Cada uma das 35 questões tem exatamente um docente responsável.
    const total = visao?.docentes.reduce((soma, docente) => soma + docente.questoes, 0)
    expect(total).toBe(35)
  })

  it('aponta a melhor e a pior questão de cada docente', async () => {
    const visao = await indicadores.visaoDocentes(cursoId, aplicacao2025)
    for (const docente of visao?.docentes ?? []) {
      expect(docente.pior).not.toBeNull()
      expect(docente.melhor).not.toBeNull()
      if (docente.pior && docente.melhor) {
        expect(docente.pior.percentual).toBeLessThanOrEqual(docente.melhor.percentual)
      }
    }
  })

  it('ordena do menor para o maior acerto médio', async () => {
    const visao = await indicadores.visaoDocentes(cursoId, aplicacao2025)
    const medias = visao?.docentes.map((docente) => docente.percentualMedio) ?? []
    expect([...medias].sort((a, b) => a - b)).toEqual(medias)
  })
})
