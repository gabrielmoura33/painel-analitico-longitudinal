import { cursosVisiveis, type EscopoUsuario } from '@compartilhado/acesso'
import { AREA_NAO_MAPEADA, areaDoTema, indiceDeAreas, type IndiceAreas } from '@compartilhado/areas'
import type { Aplicacao, Curso, Desempenho, Discente } from '@compartilhado/types/dominio'
import type {
  AlertaDiscente,
  AreaDoDiscente,
  CelulaMatriz,
  ContextoPainel,
  Dificuldade,
  DiscenteEncontrado,
  LinhaDocente,
  LinhaMatrizArea,
  LinhaQuestao,
  PontoTrajetoria,
  VisaoAreas,
  VisaoDiscente,
  VisaoDocentes,
  VisaoQuestoes,
  DispersaoArea,
  Destaque,
  FaixaDistribuicao,
  LinhaArea,
  LinhaDiscenteTurma,
  LinhaPeriodo,
  PontoSerie,
  ResumoAplicacao,
  SituacaoArea,
  ValorPorComponente,
  VisaoGeral,
  VisaoTurma
} from '@compartilhado/types/indicadores'

import type { Repositorio } from '../db'
import { calcularNota, faixaDoPeriodo } from '../etl/notas'

const LIMITE_CRITICO = 50
const LIMITE_BOM = 70

function media(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length
}

function percentil(ordenados: number[], fracao: number): number {
  if (ordenados.length === 0) return 0
  const posicao = (ordenados.length - 1) * fracao
  const inferior = Math.floor(posicao)
  const superior = Math.ceil(posicao)
  const base = ordenados[inferior] ?? 0
  if (inferior === superior) return base
  const topo = ordenados[superior] ?? base
  return base + (topo - base) * (posicao - inferior)
}

function situacaoDaArea(percentual: number): SituacaoArea {
  if (percentual < LIMITE_CRITICO) return 'critica'
  return percentual < LIMITE_BOM ? 'atencao' : 'boa'
}

function resumir(aplicacao: Aplicacao): ResumoAplicacao {
  return {
    _id: aplicacao._id,
    rotulo: aplicacao.rotulo,
    ano: aplicacao.ano,
    semestre: aplicacao.semestre,
    dataImportacao: aplicacao.dataImportacao
  }
}

/** Resultado de um discente em um período: a unidade de todos os cálculos. */
interface ResultadoDiscente {
  discenteId: string
  periodo: string
  acertos: number
  total: number
  percentual: number
  nota: number
  porComponente: ValorPorComponente[]
}

function agruparResultados(registros: Desempenho[], curso: Curso): ResultadoDiscente[] {
  const porChave = new Map<string, { periodo: string; registros: Desempenho[] }>()

  for (const registro of registros) {
    const chave = `${registro.discenteId}|${registro.periodo}`
    const atual = porChave.get(chave) ?? { periodo: registro.periodo, registros: [] }
    atual.registros.push(registro)
    porChave.set(chave, atual)
  }

  const resultados: ResultadoDiscente[] = []

  for (const [chave, grupo] of porChave) {
    const discenteId = chave.split('|')[0] as string
    const total = grupo.registros.length
    const acertos = grupo.registros.filter((registro) => registro.acerto).length
    const percentual = total > 0 ? (acertos / total) * 100 : 0
    const faixa = faixaDoPeriodo(curso.regua, grupo.periodo)

    const porComponente = new Map<string, { acertos: number; total: number }>()
    for (const registro of grupo.registros) {
      const atual = porComponente.get(registro.componente) ?? { acertos: 0, total: 0 }
      atual.total += 1
      if (registro.acerto) atual.acertos += 1
      porComponente.set(registro.componente, atual)
    }

    resultados.push({
      discenteId,
      periodo: grupo.periodo,
      acertos,
      total,
      percentual,
      nota: faixa ? calcularNota(percentual, faixa.notaBase, faixa.percentualMinimo) : 0,
      porComponente: [...porComponente.entries()].map(([nome, contagem]) => ({
        nome,
        percentual: contagem.total > 0 ? (contagem.acertos / contagem.total) * 100 : 0,
        questoes: contagem.total
      }))
    })
  }

  return resultados
}

function percentuaisPorComponente(registros: Desempenho[]): ValorPorComponente[] {
  const porComponente = new Map<string, { acertos: number; total: number; questoes: Set<number> }>()

  for (const registro of registros) {
    const atual = porComponente.get(registro.componente) ?? {
      acertos: 0,
      total: 0,
      questoes: new Set<number>()
    }
    atual.total += 1
    atual.questoes.add(registro.numeroQuestao)
    if (registro.acerto) atual.acertos += 1
    porComponente.set(registro.componente, atual)
  }

  return [...porComponente.entries()]
    .map(([nome, dados]) => ({
      nome,
      percentual: dados.total > 0 ? (dados.acertos / dados.total) * 100 : 0,
      questoes: dados.questoes.size
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * Agrupa o desempenho pela área de conhecimento do curso.
 *
 * Quando o curso ainda não cadastrou as áreas, o agrupamento cai no tema da
 * planilha — que é por questão. A tela diz qual dos dois está em uso, para que
 * ninguém leia "área" achando que são as faixas amplas do curso.
 */
function percentuaisPorArea(
  registros: Desempenho[],
  indice: IndiceAreas
): Map<string, { percentual: number; questoes: number; respondentes: number }> {
  const porArea = new Map<string, { acertos: number; total: number; questoes: Set<number> }>()

  for (const registro of registros) {
    const area = indice.size > 0 ? areaDoTema(indice, registro.tema) : registro.tema
    const atual = porArea.get(area) ?? { acertos: 0, total: 0, questoes: new Set<number>() }
    atual.total += 1
    atual.questoes.add(registro.numeroQuestao)
    if (registro.acerto) atual.acertos += 1
    porArea.set(area, atual)
  }

  return new Map(
    [...porArea.entries()].map(([area, dados]) => [
      area,
      {
        percentual: dados.total > 0 ? (dados.acertos / dados.total) * 100 : 0,
        questoes: dados.questoes.size,
        respondentes: dados.questoes.size > 0 ? dados.total / dados.questoes.size : 0
      }
    ])
  )
}

/**
 * Indicadores dos painéis.
 *
 * Tudo é derivado do modelo canônico na hora da consulta: o banco guarda
 * apenas o fato "acertou ou não". Nenhum número aqui é lido de planilha
 * pronta, e nenhum indicador é inventado quando a fonte não o sustenta.
 */
export class ServicoIndicadores {
  constructor(private readonly repositorio: Repositorio) {}

  /**
   * Curso e aplicação em foco, mais as listas que alimentam o seletor global.
   *
   * O escopo recorta a lista de cursos antes de qualquer escolha: um curso
   * fora do alcance não pode nem virar o curso padrão de quem entrou.
   */
  async contexto(
    cursoIdPreferido?: string,
    aplicacaoIdPreferida?: string,
    escopo?: EscopoUsuario
  ): Promise<ContextoPainel> {
    const todos = await this.repositorio.cursos.buscar()
    const cursos = escopo ? cursosVisiveis(escopo, todos) : todos
    const cursoId =
      cursoIdPreferido && cursos.some((curso) => curso._id === cursoIdPreferido)
        ? cursoIdPreferido
        : (cursos[0]?._id ?? null)

    const aplicacoes = cursoId ? await this.aplicacoesOrdenadas(cursoId) : []
    const aplicacaoId =
      aplicacaoIdPreferida && aplicacoes.some((item) => item._id === aplicacaoIdPreferida)
        ? aplicacaoIdPreferida
        : (aplicacoes.at(-1)?._id ?? null)

    return {
      cursoId,
      aplicacaoId,
      cursos: cursos.map((curso) => ({ _id: curso._id, nome: curso.nome, sigla: curso.sigla })),
      aplicacoes
    }
  }

  async visaoGeral(cursoId: string, aplicacaoId: string): Promise<VisaoGeral | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!curso || !aplicacao) return null

    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId })
    const resultados = agruparResultados(registros, curso)

    const todasAplicacoes = await this.aplicacoesOrdenadas(cursoId)
    const serie = await this.serieHistorica(curso, todasAplicacoes)
    const indiceAtual = serie.findIndex((ponto) => ponto.rotulo === aplicacao.rotulo)
    const anterior = indiceAtual > 0 ? serie[indiceAtual - 1] : undefined
    const atual = serie[indiceAtual]

    const areas = await this.areasComHistorico(curso, aplicacao, todasAplicacoes, registros)
    const porComponente = percentuaisPorComponente(registros)

    const porPeriodo = this.agruparPorPeriodo(resultados, curso)
    const distribuicaoNotas = this.distribuir(resultados)

    return {
      cursoNome: curso.nome,
      aplicacao: resumir(aplicacao),
      kpis: {
        percentualMedio: media(resultados.map((resultado) => resultado.percentual)),
        acertosMedios: media(resultados.map((resultado) => resultado.acertos)),
        totalQuestoes: curso.estrutura.totalQuestoes,
        notaMedia: media(resultados.map((resultado) => resultado.nota)),
        totalDiscentes: new Set(resultados.map((resultado) => resultado.discenteId)).size,
        areasCriticas: areas.filter((area) => area.situacao === 'critica').length
      },
      porComponente,
      variacao: {
        percentualMedio:
          anterior && atual ? atual.percentualMedio - anterior.percentualMedio : null,
        notaMedia: anterior && atual ? atual.notaMedia - anterior.notaMedia : null
      },
      serie,
      porPeriodo,
      distribuicaoNotas,
      destaques: this.montarDestaques(areas, porComponente, resultados, anterior, atual),
      areas
    }
  }

  async visaoTurma(
    cursoId: string,
    aplicacaoId: string,
    periodoPreferido?: string
  ): Promise<VisaoTurma | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!curso || !aplicacao) return null

    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId })
    const resultados = agruparResultados(registros, curso)

    const periodosDisponiveis = [...new Set(resultados.map((resultado) => resultado.periodo))].sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
    )
    const periodo =
      periodoPreferido && periodosDisponiveis.includes(periodoPreferido)
        ? periodoPreferido
        : (periodosDisponiveis[0] ?? '')

    const doPeriodo = resultados.filter((resultado) => resultado.periodo === periodo)
    const registrosDoPeriodo = registros.filter((registro) => registro.periodo === periodo)

    const discentes = await this.repositorio.discentes.buscar({ cursoId })
    const porId = new Map<string, Discente>(discentes.map((discente) => [discente._id, discente]))
    const anteriores = await this.percentuaisDaAplicacaoAnterior(curso, aplicacao)

    const faixa = faixaDoPeriodo(curso.regua, periodo)
    const minimo = faixa?.percentualMinimo ?? 0

    const linhas: LinhaDiscenteTurma[] = doPeriodo
      .map((resultado) => {
        const anterior = anteriores.get(resultado.discenteId)
        return {
          discenteId: resultado.discenteId,
          pseudonimo: porId.get(resultado.discenteId)?.pseudonimo ?? '—',
          acertos: resultado.acertos,
          totalQuestoes: resultado.total,
          percentual: resultado.percentual,
          nota: resultado.nota,
          variacao: anterior === undefined ? null : resultado.percentual - anterior,
          porComponente: resultado.porComponente
        }
      })
      .sort((a, b) => b.percentual - a.percentual)

    return {
      cursoNome: curso.nome,
      aplicacao: resumir(aplicacao),
      periodo,
      periodosDisponiveis,
      kpis: {
        totalDiscentes: doPeriodo.length,
        acertosMedios: media(doPeriodo.map((resultado) => resultado.acertos)),
        totalQuestoes: curso.estrutura.totalQuestoes,
        percentualMedio: media(doPeriodo.map((resultado) => resultado.percentual)),
        notaMedia: media(doPeriodo.map((resultado) => resultado.nota)),
        percentualAcimaDoMinimo:
          doPeriodo.length > 0
            ? (doPeriodo.filter((resultado) => resultado.percentual >= minimo).length /
                doPeriodo.length) *
              100
            : 0
      },
      histograma: this.histograma(doPeriodo),
      dispersaoPorArea: this.dispersao(registrosDoPeriodo, indiceDeAreas(curso.areas ?? [])),
      discentes: linhas,
      comparativoPeriodos: this.agruparPorPeriodo(resultados, curso)
    }
  }

  // ---------- Fase 6 ----------

  async visaoAreas(cursoId: string, aplicacaoId: string): Promise<VisaoAreas | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!curso || !aplicacao) return null

    const indice = indiceDeAreas(curso.areas ?? [])
    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId })
    const todas = await this.aplicacoesOrdenadas(cursoId)

    const areas = await this.areasComHistorico(curso, aplicacao, todas, registros)
    const periodos = [...new Set(registros.map((registro) => registro.periodo))].sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
    )

    const matriz: LinhaMatrizArea[] = areas.map((area) => {
      const celulas: CelulaMatriz[] = periodos.map((periodo) => {
        const doPeriodo = registros.filter(
          (registro) =>
            registro.periodo === periodo &&
            (indice.size > 0 ? areaDoTema(indice, registro.tema) : registro.tema) === area.tema
        )
        const questoes = new Set(doPeriodo.map((registro) => registro.numeroQuestao)).size
        return {
          periodo,
          percentual:
            doPeriodo.length > 0
              ? (doPeriodo.filter((registro) => registro.acerto).length / doPeriodo.length) * 100
              : null,
          questoes,
          respondentes: questoes > 0 ? doPeriodo.length / questoes : 0
        }
      })
      return { area: area.tema, percentualGeral: area.percentual, celulas }
    })

    const series = new Map<string, Array<{ rotulo: string; percentual: number | null }>>()
    for (const item of todas) {
      const deOutra = await this.repositorio.desempenho.buscar({ aplicacaoId: item._id })
      const percentuais = percentuaisPorArea(deOutra, indice)
      for (const area of areas) {
        const valor = percentuais.get(area.tema)
        series.set(area.tema, [
          ...(series.get(area.tema) ?? []),
          { rotulo: item.rotulo, percentual: valor ? valor.percentual : null }
        ])
      }
    }

    const temasDaAplicacao = new Set(registros.map((registro) => registro.tema))
    const temasSemArea =
      indice.size === 0
        ? temasDaAplicacao.size
        : [...temasDaAplicacao].filter((tema) => areaDoTema(indice, tema) === AREA_NAO_MAPEADA)
            .length

    return {
      cursoNome: curso.nome,
      aplicacao: resumir(aplicacao),
      agrupadoPorArea: indice.size > 0,
      temasSemArea,
      areas,
      periodos,
      matriz,
      evolucao: {
        rotulos: todas.map((item) => item.rotulo),
        series: [...series.entries()].map(([area, valores]) => ({ area, valores }))
      }
    }
  }

  async visaoQuestoes(cursoId: string, aplicacaoId: string): Promise<VisaoQuestoes | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!curso || !aplicacao) return null

    const indice = indiceDeAreas(curso.areas ?? [])
    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId })
    const questoes = await this.repositorio.questoes.buscar({ aplicacaoId })

    const periodos = [...new Set(registros.map((registro) => registro.periodo))].sort(
      (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
    )

    const porNumero = new Map<number, Desempenho[]>()
    for (const registro of registros) {
      porNumero.set(registro.numeroQuestao, [
        ...(porNumero.get(registro.numeroQuestao) ?? []),
        registro
      ])
    }

    const linhas: LinhaQuestao[] = [...porNumero.entries()]
      .map(([numero, doNumero]) => {
        const referencia = questoes.find((questao) => questao.numero === numero)
        const percentual =
          doNumero.length > 0
            ? (doNumero.filter((registro) => registro.acerto).length / doNumero.length) * 100
            : 0

        const porPeriodo = periodos.map((periodo) => {
          const doPeriodo = doNumero.filter((registro) => registro.periodo === periodo)
          return {
            periodo,
            percentual:
              doPeriodo.length > 0
                ? (doPeriodo.filter((registro) => registro.acerto).length / doPeriodo.length) * 100
                : null
          }
        })

        const aplicados = porPeriodo.filter((item) => item.percentual !== null)

        return {
          numero,
          tema: referencia?.tema ?? doNumero[0]?.tema ?? '',
          area: indice.size > 0 ? areaDoTema(indice, referencia?.tema ?? '') : (referencia?.tema ?? ''),
          gabarito: referencia?.gabarito ?? '',
          docente: referencia?.docenteResponsavel ?? '',
          componente: referencia?.componente ?? '',
          percentual,
          dificuldade: (percentual < 50 ? 'dificil' : percentual < 70 ? 'media' : 'facil') as Dificuldade,
          porPeriodo,
          criticaEmTodosOsPeriodos:
            aplicados.length > 0 && aplicados.every((item) => (item.percentual ?? 0) < 50)
        }
      })
      .sort((a, b) => a.percentual - b.percentual)

    return {
      cursoNome: curso.nome,
      aplicacao: resumir(aplicacao),
      periodos,
      questoes: linhas,
      totalCriticas: linhas.filter((linha) => linha.criticaEmTodosOsPeriodos).length,
      distribuicaoAlternativasDisponivel: false
    }
  }

  async buscarDiscentes(cursoId: string, termo: string): Promise<DiscenteEncontrado[]> {
    const busca = termo.trim().toLowerCase()
    if (busca.length < 2) return []

    const discentes = await this.repositorio.discentes.buscar({ cursoId })
    const registros = await this.repositorio.desempenho.buscar({ cursoId })

    const aplicacoesPorDiscente = new Map<string, Set<string>>()
    for (const registro of registros) {
      const atual = aplicacoesPorDiscente.get(registro.discenteId) ?? new Set<string>()
      atual.add(registro.aplicacaoId)
      aplicacoesPorDiscente.set(registro.discenteId, atual)
    }

    return discentes
      .filter(
        (discente) =>
          discente.nomeCompleto.toLowerCase().includes(busca) ||
          discente.pseudonimo.toLowerCase().includes(busca) ||
          (discente.matricula ?? '').toLowerCase().includes(busca)
      )
      .slice(0, 25)
      .map((discente) => ({
        _id: discente._id,
        nomeCompleto: discente.nomeCompleto,
        matricula: discente.matricula,
        pseudonimo: discente.pseudonimo,
        aplicacoes: aplicacoesPorDiscente.get(discente._id)?.size ?? 0
      }))
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'))
  }

  async visaoDiscente(cursoId: string, discenteId: string): Promise<VisaoDiscente | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const discente = await this.repositorio.discentes.buscarPorId(discenteId)
    if (!curso || !discente) return null

    const indice = indiceDeAreas(curso.areas ?? [])
    const aplicacoes = await this.aplicacoesOrdenadas(cursoId)
    const trajetoria: PontoTrajetoria[] = []
    const areasPorAplicacao = new Map<string, Map<string, number>>()
    const turmaPorAplicacao = new Map<string, Map<string, number>>()

    for (const aplicacao of aplicacoes) {
      const registros = await this.repositorio.desempenho.buscar({ aplicacaoId: aplicacao._id })
      const doDiscente = registros.filter((registro) => registro.discenteId === discenteId)
      if (doDiscente.length === 0) continue

      const periodo = doDiscente[0]?.periodo ?? ''
      const acertos = doDiscente.filter((registro) => registro.acerto).length
      const percentual = (acertos / doDiscente.length) * 100
      const faixa = faixaDoPeriodo(curso.regua, periodo)

      const daTurma = registros.filter((registro) => registro.periodo === periodo)
      const resultadosTurma = agruparResultados(daTurma, curso)

      trajetoria.push({
        rotulo: aplicacao.rotulo,
        periodo,
        acertos,
        total: doDiscente.length,
        percentual,
        nota: faixa ? calcularNota(percentual, faixa.notaBase, faixa.percentualMinimo) : 0,
        percentualDaTurma: media(resultadosTurma.map((resultado) => resultado.percentual))
      })

      areasPorAplicacao.set(
        aplicacao.rotulo,
        new Map(
          [...percentuaisPorArea(doDiscente, indice).entries()].map(([area, dados]) => [
            area,
            dados.percentual
          ])
        )
      )
      turmaPorAplicacao.set(
        aplicacao.rotulo,
        new Map(
          [...percentuaisPorArea(daTurma, indice).entries()].map(([area, dados]) => [
            area,
            dados.percentual
          ])
        )
      )
    }

    const rotulos = trajetoria.map((ponto) => ponto.rotulo)
    const nomesAreas = [
      ...new Set([...areasPorAplicacao.values()].flatMap((mapa) => [...mapa.keys()]))
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

    const areas: AreaDoDiscente[] = nomesAreas.map((area) => {
      const valores = rotulos.map((rotulo) => ({
        rotulo,
        percentual: areasPorAplicacao.get(rotulo)?.get(area) ?? null
      }))
      const comValor = valores.filter((item) => item.percentual !== null)
      const ultimo = comValor.at(-1)?.percentual ?? null
      const penultimo = comValor.at(-2)?.percentual ?? null
      const ultimoRotulo = rotulos.at(-1)

      return {
        area,
        valores,
        ultimoPercentual: ultimo,
        mediaDaTurma: ultimoRotulo ? (turmaPorAplicacao.get(ultimoRotulo)?.get(area) ?? null) : null,
        variacao: ultimo !== null && penultimo !== null ? ultimo - penultimo : null
      }
    })

    const alertas: AlertaDiscente[] = []
    for (const area of areas) {
      if (area.ultimoPercentual !== null && area.ultimoPercentual < 50) {
        alertas.push({
          tipo: 'atencao',
          titulo: area.area,
          detalhe: `${area.ultimoPercentual.toFixed(0)}% de acerto na última aplicação.`
        })
      }
      if (area.variacao !== null && area.variacao <= -20) {
        alertas.push({
          tipo: 'atencao',
          titulo: `Queda em ${area.area}`,
          detalhe: `${Math.abs(area.variacao).toFixed(0)} pontos percentuais abaixo da aplicação anterior.`
        })
      }
      if (area.variacao !== null && area.variacao >= 20) {
        alertas.push({
          tipo: 'evolucao',
          titulo: `Avanço em ${area.area}`,
          detalhe: `${area.variacao.toFixed(0)} pontos percentuais acima da aplicação anterior.`
        })
      }
    }

    const ultimoPonto = trajetoria.at(-1)
    let ultimo: VisaoDiscente['ultimo'] = null

    if (ultimoPonto) {
      const aplicacao = aplicacoes.find((item) => item.rotulo === ultimoPonto.rotulo)
      const registros = aplicacao
        ? await this.repositorio.desempenho.buscar({ aplicacaoId: aplicacao._id })
        : []
      const daTurma = agruparResultados(
        registros.filter((registro) => registro.periodo === ultimoPonto.periodo),
        curso
      )
      const abaixo = daTurma.filter(
        (resultado) => resultado.percentual < ultimoPonto.percentual
      ).length

      ultimo = {
        rotulo: ultimoPonto.rotulo,
        acertos: ultimoPonto.acertos,
        totalQuestoes: ultimoPonto.total,
        percentual: ultimoPonto.percentual,
        nota: ultimoPonto.nota,
        percentil: daTurma.length > 0 ? (abaixo / daTurma.length) * 100 : 0,
        porComponente: percentuaisPorComponente(
          registros.filter((registro) => registro.discenteId === discenteId)
        )
      }
    }

    return {
      cursoNome: curso.nome,
      nomeCompleto: discente.nomeCompleto,
      matricula: discente.matricula,
      pseudonimo: discente.pseudonimo,
      trajetoria,
      areas,
      alertas: alertas.slice(0, 12),
      ultimo
    }
  }

  async visaoDocentes(cursoId: string, aplicacaoId: string): Promise<VisaoDocentes | null> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!curso || !aplicacao) return null

    const indice = indiceDeAreas(curso.areas ?? [])
    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId })
    const questoes = await this.repositorio.questoes.buscar({ aplicacaoId })

    const percentualPorNumero = new Map<number, number>()
    const porNumero = new Map<number, Desempenho[]>()
    for (const registro of registros) {
      porNumero.set(registro.numeroQuestao, [
        ...(porNumero.get(registro.numeroQuestao) ?? []),
        registro
      ])
    }
    for (const [numero, lista] of porNumero) {
      percentualPorNumero.set(
        numero,
        lista.length > 0 ? (lista.filter((registro) => registro.acerto).length / lista.length) * 100 : 0
      )
    }

    const porDocente = new Map<string, Map<number, { tema: string }>>()
    for (const questao of questoes) {
      const docente = questao.docenteResponsavel || 'Sem docente informado'
      const atual = porDocente.get(docente) ?? new Map()
      atual.set(questao.numero, { tema: questao.tema })
      porDocente.set(docente, atual)
    }

    const docentes: LinhaDocente[] = [...porDocente.entries()]
      .map(([docente, questoesDoDocente]) => {
        const detalhes = [...questoesDoDocente.entries()].map(([numero, dados]) => ({
          numero,
          tema: dados.tema,
          percentual: percentualPorNumero.get(numero) ?? 0
        }))
        const ordenadas = [...detalhes].sort((a, b) => a.percentual - b.percentual)

        return {
          docente,
          questoes: detalhes.length,
          percentualMedio: media(detalhes.map((item) => item.percentual)),
          pior: ordenadas[0] ?? null,
          melhor: ordenadas.at(-1) ?? null,
          areas: [
            ...new Set(
              detalhes.map((item) => (indice.size > 0 ? areaDoTema(indice, item.tema) : item.tema))
            )
          ].sort((a, b) => a.localeCompare(b, 'pt-BR'))
        }
      })
      .sort((a, b) => a.percentualMedio - b.percentualMedio)

    return { cursoNome: curso.nome, aplicacao: resumir(aplicacao), docentes }
  }

  private async aplicacoesOrdenadas(cursoId: string): Promise<ResumoAplicacao[]> {
    const aplicacoes = await this.repositorio.aplicacoes.buscar({ cursoId })
    return aplicacoes
      .sort((a, b) => a.ano - b.ano || a.semestre - b.semestre)
      .map(resumir)
  }

  private async serieHistorica(curso: Curso, aplicacoes: ResumoAplicacao[]): Promise<PontoSerie[]> {
    const serie: PontoSerie[] = []

    for (const aplicacao of aplicacoes) {
      const registros = await this.repositorio.desempenho.buscar({ aplicacaoId: aplicacao._id })
      const resultados = agruparResultados(registros, curso)
      serie.push({
        rotulo: aplicacao.rotulo,
        percentualMedio: media(resultados.map((resultado) => resultado.percentual)),
        notaMedia: media(resultados.map((resultado) => resultado.nota)),
        discentes: new Set(resultados.map((resultado) => resultado.discenteId)).size
      })
    }

    return serie
  }

  private async areasComHistorico(
    curso: Curso,
    aplicacao: Aplicacao,
    todas: ResumoAplicacao[],
    registrosAtuais: Desempenho[]
  ): Promise<LinhaArea[]> {
    const indice = indiceDeAreas(curso.areas ?? [])
    const atuais = percentuaisPorArea(registrosAtuais, indice)

    const anteriores = todas.filter(
      (item) =>
        item.ano < aplicacao.ano || (item.ano === aplicacao.ano && item.semestre < aplicacao.semestre)
    )

    const historico = new Map<string, number[]>()
    for (const anterior of anteriores) {
      const registros = await this.repositorio.desempenho.buscar({ aplicacaoId: anterior._id })
      for (const [area, dados] of percentuaisPorArea(registros, indice)) {
        historico.set(area, [...(historico.get(area) ?? []), dados.percentual])
      }
    }

    return [...atuais.entries()]
      .map(([area, dados]) => {
        const anteriores = historico.get(area)
        const percentualHistorico = anteriores && anteriores.length > 0 ? media(anteriores) : null
        return {
          tema: area,
          questoes: dados.questoes,
          percentual: dados.percentual,
          percentualHistorico,
          variacao: percentualHistorico === null ? null : dados.percentual - percentualHistorico,
          situacao: situacaoDaArea(dados.percentual)
        }
      })
      .sort((a, b) => a.percentual - b.percentual)
  }

  private async percentuaisDaAplicacaoAnterior(
    curso: Curso,
    aplicacao: Aplicacao
  ): Promise<Map<string, number>> {
    const todas = await this.aplicacoesOrdenadas(curso._id)
    const anteriores = todas.filter(
      (item) =>
        item.ano < aplicacao.ano || (item.ano === aplicacao.ano && item.semestre < aplicacao.semestre)
    )
    const ultima = anteriores.at(-1)
    if (!ultima) return new Map()

    const registros = await this.repositorio.desempenho.buscar({ aplicacaoId: ultima._id })
    const resultados = agruparResultados(registros, curso)
    return new Map(resultados.map((resultado) => [resultado.discenteId, resultado.percentual]))
  }

  private agruparPorPeriodo(resultados: ResultadoDiscente[], _curso: Curso): LinhaPeriodo[] {
    const porPeriodo = new Map<string, ResultadoDiscente[]>()
    for (const resultado of resultados) {
      porPeriodo.set(resultado.periodo, [...(porPeriodo.get(resultado.periodo) ?? []), resultado])
    }

    return [...porPeriodo.entries()]
      .map(([periodo, lista]) => ({
        periodo,
        percentualMedio: media(lista.map((resultado) => resultado.percentual)),
        notaMedia: media(lista.map((resultado) => resultado.nota)),
        discentes: lista.length
      }))
      .sort((a, b) => Number.parseInt(a.periodo, 10) - Number.parseInt(b.periodo, 10))
  }

  private distribuir(resultados: ResultadoDiscente[]): FaixaDistribuicao[] {
    const contagem = new Map<number, number>()
    for (const resultado of resultados) {
      contagem.set(resultado.nota, (contagem.get(resultado.nota) ?? 0) + 1)
    }

    const total = resultados.length
    return [...contagem.entries()]
      .map(([nota, quantidade]) => ({
        nota,
        quantidade,
        percentual: total > 0 ? (quantidade / total) * 100 : 0
      }))
      .sort((a, b) => a.nota - b.nota)
  }

  private histograma(resultados: ResultadoDiscente[]): Array<{ faixa: string; quantidade: number }> {
    const faixas = [
      { faixa: '0–19%', minimo: 0, maximo: 20 },
      { faixa: '20–39%', minimo: 20, maximo: 40 },
      { faixa: '40–59%', minimo: 40, maximo: 60 },
      { faixa: '60–79%', minimo: 60, maximo: 80 },
      { faixa: '80–100%', minimo: 80, maximo: 100.01 }
    ]

    return faixas.map((faixa) => ({
      faixa: faixa.faixa,
      quantidade: resultados.filter(
        (resultado) => resultado.percentual >= faixa.minimo && resultado.percentual < faixa.maximo
      ).length
    }))
  }

  /**
   * Dispersão por área: mostra a heterogeneidade da turma, que é a dor
   * descrita no diagnóstico do projeto — a média esconde quem está longe dela.
   */
  private dispersao(registros: Desempenho[], indice: IndiceAreas): DispersaoArea[] {
    const porTema = new Map<string, Map<string, { acertos: number; total: number }>>()

    for (const registro of registros) {
      const area = indice.size > 0 ? areaDoTema(indice, registro.tema) : registro.tema
      const doTema = porTema.get(area) ?? new Map()
      const doDiscente = doTema.get(registro.discenteId) ?? { acertos: 0, total: 0 }
      doDiscente.total += 1
      if (registro.acerto) doDiscente.acertos += 1
      doTema.set(registro.discenteId, doDiscente)
      porTema.set(area, doTema)
    }

    return [...porTema.entries()]
      .map(([tema, porDiscente]) => {
        const percentuais = [...porDiscente.values()]
          .map((dados) => (dados.total > 0 ? (dados.acertos / dados.total) * 100 : 0))
          .sort((a, b) => a - b)

        return {
          tema,
          minimo: percentuais[0] ?? 0,
          q1: percentil(percentuais, 0.25),
          mediana: percentil(percentuais, 0.5),
          q3: percentil(percentuais, 0.75),
          maximo: percentuais.at(-1) ?? 0,
          media: media(percentuais)
        }
      })
      .sort((a, b) => a.media - b.media)
  }

  private montarDestaques(
    areas: LinhaArea[],
    porComponente: ValorPorComponente[],
    resultados: ResultadoDiscente[],
    anterior: PontoSerie | undefined,
    atual: PontoSerie | undefined
  ): Destaque[] {
    const destaques: Destaque[] = []

    if (anterior && atual) {
      const diferenca = atual.percentualMedio - anterior.percentualMedio
      destaques.push({
        tipo: diferenca >= 0 ? 'acima' : 'atencao',
        titulo: `${atual.percentualMedio.toFixed(1)}% contra ${anterior.percentualMedio.toFixed(1)}% em ${anterior.rotulo}`,
        detalhe:
          diferenca >= 0
            ? `Acerto médio subiu ${diferenca.toFixed(1)} ponto(s) percentual(is).`
            : `Acerto médio caiu ${Math.abs(diferenca).toFixed(1)} ponto(s) percentual(is).`
      })
    }

    const criticas = areas.filter((area) => area.situacao === 'critica')
    if (criticas.length > 0) {
      const pior = criticas[0] as LinhaArea
      destaques.push({
        tipo: 'atencao',
        titulo: `${criticas.length} área(s) abaixo de ${LIMITE_CRITICO}% de acerto`,
        detalhe: `A menor é "${pior.tema}", com ${pior.percentual.toFixed(1)}%.`
      })
    }

    const melhor = areas.at(-1)
    if (melhor) {
      destaques.push({
        tipo: 'destaque',
        titulo: `Maior acerto: ${melhor.tema} (${melhor.percentual.toFixed(1)}%)`,
        detalhe: `Calculado sobre ${melhor.questoes} questão(ões) da aplicação.`
      })
    }

    if (porComponente.length >= 2) {
      const ordenados = [...porComponente].sort((a, b) => b.percentual - a.percentual)
      const maior = ordenados[0] as ValorPorComponente
      const menor = ordenados.at(-1) as ValorPorComponente
      destaques.push({
        tipo: 'atencao',
        titulo: `${maior.nome} ${maior.percentual.toFixed(1)}% × ${menor.nome} ${menor.percentual.toFixed(1)}%`,
        detalhe: `Diferença de ${(maior.percentual - menor.percentual).toFixed(1)} pontos percentuais entre os componentes.`
      })
    }

    const abaixoDoMinimo = resultados.filter((resultado) => resultado.percentual < LIMITE_CRITICO)
    if (abaixoDoMinimo.length > 0) {
      destaques.push({
        tipo: 'atencao',
        titulo: `${abaixoDoMinimo.length} resultado(s) abaixo de ${LIMITE_CRITICO}% de acerto`,
        detalhe: `De ${resultados.length} resultados avaliados nesta aplicação.`
      })
    }

    return destaques
  }
}
