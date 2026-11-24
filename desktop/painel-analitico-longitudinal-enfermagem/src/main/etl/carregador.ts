import type { Curso, Desempenho, Discente, OcorrenciaImportacao, Questao } from '@compartilhado/types/dominio'
import type { CampoGrafia, ResumoCarga } from '@compartilhado/types/importacao'

import type { Repositorio } from '../db'
import type { MatrizAba } from './leitor'
import { calcularNota, faixaDoPeriodo } from './notas'
import { aparar, chaveAgrupamento, chaveComparacao, proximoPseudonimo } from './normalizador'

export interface AbaParaCarga {
  nome: string
  periodo: string
  matriz: MatrizAba
}

export interface EntradaCarga {
  curso: Curso
  rotulo: string
  arquivo: { caminho: string; nome: string; hash: string }
  importadoPor: string
  abas: AbaParaCarga[]
  unificacoes: Map<CampoGrafia, Map<string, string>>
  ocorrencias: OcorrenciaImportacao[]
  /** Quando verdadeiro, a aplicação anterior equivalente é apagada antes da carga. */
  substituirAnterior: boolean
}

function componenteDaQuestao(curso: Curso, numero: number): string {
  const componente = curso.estrutura.componentes.find(
    (item) => numero >= item.questaoInicial && numero <= item.questaoFinal
  )
  return componente?.nome ?? 'Sem componente'
}

function aplicar(unificacoes: Map<string, string> | undefined, valor: string): string {
  const limpo = aparar(valor)
  return unificacoes?.get(chaveAgrupamento(limpo)) ?? limpo
}

function semestreEAno(rotulo: string): { ano: number; semestre: number } {
  const [ano, semestre] = rotulo.split('/')
  return { ano: Number(ano), semestre: Number(semestre) }
}

/**
 * Carga no modelo canônico.
 *
 * Roda inteira dentro de uma transação: ou a aplicação entra completa, ou o
 * banco fica exatamente como estava. É o que impede uma importação
 * interrompida de deixar meia turma gravada.
 */
export async function carregar(
  repositorio: Repositorio,
  entrada: EntradaCarga
): Promise<ResumoCarga> {
  const { curso, rotulo, arquivo, abas, unificacoes } = entrada
  const unificacoesDocente = unificacoes.get('docente')
  const unificacoesTema = unificacoes.get('tema')

  return repositorio.transacao(async () => {
    if (entrada.substituirAnterior) {
      const anteriores = await repositorio.aplicacoes.buscar({ cursoId: curso._id, rotulo })
      for (const anterior of anteriores) {
        await repositorio.desempenho.remover({ aplicacaoId: anterior._id })
        await repositorio.questoes.remover({ aplicacaoId: anterior._id })
        await repositorio.aplicacoes.remover({ _id: anterior._id })
      }
    }

    const { ano, semestre } = semestreEAno(rotulo)
    const aplicacao = await repositorio.aplicacoes.inserir({
      cursoId: curso._id,
      rotulo,
      semestre,
      ano,
      dataImportacao: new Date().toISOString(),
      importadoPor: entrada.importadoPor,
      arquivoOriginal: arquivo.nome,
      hashArquivo: arquivo.hash,
      periodos: abas.map((aba) => aba.periodo),
      totalDiscentes: 0,
      totalRegistros: 0,
      status: entrada.ocorrencias.some((item) => item.severidade === 'atencao')
        ? 'concluida_com_avisos'
        : 'concluida'
    })

    /*
     * Discentes já conhecidos do curso: é o reencontro que sustenta a série
     * longitudinal.
     *
     * Duas chaves, nesta ordem. A matrícula é a boa: não muda de grafia e
     * distingue homônimos. O nome é a de reserva, para as planilhas anteriores
     * ao pedido feito à coordenação — e é por ela que a matrícula entra, depois,
     * no cadastro de quem já estava aqui.
     */
    const existentes = await repositorio.discentes.buscar({ cursoId: curso._id })
    const porMatricula = new Map<string, Discente>()
    const porNome = new Map<string, Discente>()
    for (const discente of existentes) {
      porNome.set(chaveComparacao(discente.nomeCompleto), discente)
      if (discente.matricula) porMatricula.set(discente.matricula, discente)
    }
    let totalPseudonimos = existentes.length

    let discentesNovos = 0
    let discentesReencontrados = 0
    let discentesSemMatricula = 0
    const discentesDaAplicacao = new Set<string>()

    const questoesParaGravar: Array<Omit<Questao, '_id'> & { _id: string }> = []
    const desempenhosParaGravar: Array<Omit<Desempenho, '_id'>> = []
    const acertosPorDiscente = new Map<string, { acertos: number; total: number; periodo: string }>()

    for (const aba of abas) {
      const idsDiscentes: string[] = []

      for (const [posicao, nome] of aba.matriz.discentes.entries()) {
        const chave = chaveComparacao(nome)
        const matricula = aparar(aba.matriz.matriculas[posicao] ?? '')
        if (!matricula) discentesSemMatricula += 1

        let discente = matricula ? porMatricula.get(matricula) : undefined

        if (!discente) {
          /*
           * O nome é chave de reserva, e só vale quando não há duas matrículas
           * a contradizê-lo: dois homônimos com matrículas diferentes são duas
           * pessoas, e juntá-los somaria a trajetória de uma na da outra.
           */
          const porNomeEncontrado = porNome.get(chave)
          if (porNomeEncontrado && !(matricula && porNomeEncontrado.matricula)) {
            discente = porNomeEncontrado
          }
        }

        if (!discente) {
          discente = await repositorio.discentes.inserir({
            cursoId: curso._id,
            nomeCompleto: aparar(nome),
            matricula: matricula || null,
            pseudonimo: proximoPseudonimo(curso.sigla, totalPseudonimos),
            ativo: true,
            criadoEm: new Date().toISOString()
          })
          totalPseudonimos += 1
          discentesNovos += 1
        } else {
          if (!discentesDaAplicacao.has(discente._id)) discentesReencontrados += 1

          // Reconhecido pelo nome e agora com matrícula: o cadastro antigo ganha a chave boa.
          if (matricula && !discente.matricula) {
            const atualizado = await repositorio.discentes.atualizar(discente._id, { matricula })
            if (atualizado) discente = atualizado
          }
        }

        porNome.set(chave, discente)
        if (discente.matricula) porMatricula.set(discente.matricula, discente)

        idsDiscentes.push(discente._id)
        discentesDaAplicacao.add(discente._id)
        // A chave inclui o período: um discente que aparece em dois períodos da
        // mesma aplicação tem dois resultados, e nenhum apaga o outro.
        acertosPorDiscente.set(`${discente._id}|${aba.periodo}`, {
          acertos: 0,
          total: 0,
          periodo: aba.periodo
        })
      }

      for (const questao of aba.matriz.questoes) {
        const questaoId = `${aplicacao._id}-${aba.periodo}-${questao.numero}`
        const tema = aplicar(unificacoesTema, questao.tema)
        const componente = componenteDaQuestao(curso, questao.numero)

        questoesParaGravar.push({
          _id: questaoId,
          cursoId: curso._id,
          aplicacaoId: aplicacao._id,
          numero: questao.numero,
          gabarito: aparar(questao.gabarito),
          tema,
          docenteResponsavel: aplicar(unificacoesDocente, questao.docente),
          componente
        })

        questao.acertos.forEach((acerto, indice) => {
          const discenteId = idsDiscentes[indice]
          if (!discenteId) return

          desempenhosParaGravar.push({
            cursoId: curso._id,
            aplicacaoId: aplicacao._id,
            discenteId,
            periodo: aba.periodo,
            questaoId,
            numeroQuestao: questao.numero,
            tema,
            componente,
            acerto
          })

          const contagem = acertosPorDiscente.get(`${discenteId}|${aba.periodo}`)
          if (contagem) {
            contagem.total += 1
            if (acerto) contagem.acertos += 1
          }
        })
      }
    }

    await repositorio.questoes.inserirVarios(questoesParaGravar)
    await repositorio.desempenho.inserirVarios(desempenhosParaGravar)

    // Percentual e nota são derivados: ficam no relatório, não no banco.
    let somaPercentual = 0
    let somaNota = 0

    for (const contagem of acertosPorDiscente.values()) {
      const percentual = contagem.total > 0 ? (contagem.acertos / contagem.total) * 100 : 0
      const faixa = faixaDoPeriodo(curso.regua, contagem.periodo)
      somaPercentual += percentual
      somaNota += faixa ? calcularNota(percentual, faixa.notaBase, faixa.percentualMinimo) : 0
    }

    const totalResultados = acertosPorDiscente.size
    const totalDiscentes = discentesDaAplicacao.size
    const resumo: ResumoCarga = {
      aplicacaoId: aplicacao._id,
      periodos: abas.map((aba) => aba.periodo),
      discentesNovos,
      discentesReencontrados,
      discentesSemMatricula,
      totalDiscentes,
      totalQuestoes: questoesParaGravar.length,
      totalRegistros: desempenhosParaGravar.length,
      percentualMedio: totalResultados > 0 ? somaPercentual / totalResultados : 0,
      notaMedia: totalResultados > 0 ? somaNota / totalResultados : 0
    }

    await repositorio.aplicacoes.atualizar(aplicacao._id, {
      totalDiscentes,
      totalRegistros: resumo.totalRegistros
    })

    await repositorio.logImportacoes.inserir({
      aplicacaoId: aplicacao._id,
      cursoId: curso._id,
      arquivoOriginal: arquivo.nome,
      hashArquivo: arquivo.hash,
      executadoPor: entrada.importadoPor,
      executadoEm: new Date().toISOString(),
      ocorrencias: entrada.ocorrencias,
      concluida: true
    })

    return resumo
  })
}
