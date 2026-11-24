import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import type { OcorrenciaImportacao } from '@compartilhado/types/dominio'
import type {
  AbaAnalisada,
  AnaliseImportacao,
  CampoGrafia,
  ClusterGrafiaDTO,
  DecisoesImportacao,
  ItemHistorico,
  ResultadoImportacao
} from '@compartilhado/types/importacao'

import type { Repositorio } from '../db'
import { carregar, type AbaParaCarga } from '../etl/carregador'
import { abrirPlanilha, lerMatriz, type MatrizAba } from '../etl/leitor'
import { agruparGrafias, chaveAgrupamento, chaveComparacao } from '../etl/normalizador'
import { reconhecerAbas } from '../etl/reconhecedor'
import { temBloqueio, validarImportacao } from '../etl/validador'

async function hashDoArquivo(caminho: string): Promise<string> {
  const conteudo = await readFile(caminho)
  return createHash('sha256').update(conteudo).digest('hex')
}

/**
 * Orquestra a importação de planilhas.
 *
 * São dois passos separados de propósito: `analisar` nunca grava nada, e
 * `importar` só age sobre decisões que o usuário confirmou na tela.
 */
export class ServicoImportacao {
  constructor(private readonly repositorio: Repositorio) {}

  async analisar(
    caminho: string,
    cursoId: string,
    rotulo: string
  ): Promise<AnaliseImportacao | { erro: string }> {
    const curso = await this.repositorio.cursos.buscarPorId(cursoId)
    if (!curso) return { erro: 'Curso não encontrado.' }

    let workbook
    try {
      workbook = await abrirPlanilha(caminho)
    } catch (erro) {
      return {
        erro:
          'Não consegui abrir esta planilha. Verifique se o arquivo é .xlsx e não está ' +
          `protegido por senha. (${erro instanceof Error ? erro.message : String(erro)})`
      }
    }

    const hashArquivo = await hashDoArquivo(caminho)
    const reconhecidas = reconhecerAbas(workbook, curso.perfilImportacao)

    const abas: AbaAnalisada[] = []
    const matrizes: MatrizAba[] = []
    const periodosEscolhidos = new Map<string, string | null>()

    let totalRegistros = 0
    const discentesUnicos = new Set<string>()

    for (const aba of reconhecidas) {
      if (aba.tipo !== 'desempenho') {
        abas.push({ ...aba, totalQuestoes: 0, totalDiscentes: 0, avisos: [] })
        continue
      }

      const matriz = lerMatriz(workbook, aba.nome, curso.perfilImportacao)
      if (!matriz) continue

      matrizes.push(matriz)
      for (const nome of matriz.discentes) discentesUnicos.add(chaveComparacao(nome))

      totalRegistros += matriz.discentes.length * matriz.questoes.length
      periodosEscolhidos.set(aba.nome, aba.periodoSugerido)

      abas.push({
        ...aba,
        totalQuestoes: matriz.questoes.length,
        totalDiscentes: matriz.discentes.length,
        avisos: matriz.avisos
      })
    }

    const aplicacaoExistente = await this.procurarAplicacaoEquivalente(cursoId, rotulo, hashArquivo)

    const ocorrencias = validarImportacao({
      curso,
      abas,
      periodosEscolhidos,
      aplicacaoExistente,
      rotulo
    })

    const conteudo = this.ocorrenciasDeConteudo(matrizes)
    ocorrencias.push(...conteudo.ocorrencias)
    const clusters = conteudo.clusters

    const periodos = [...periodosEscolhidos.values()].filter((periodo): periodo is string =>
      Boolean(periodo)
    )

    return {
      caminho,
      nomeArquivo: basename(caminho),
      hashArquivo,
      cursoId,
      cursoNome: curso.nome,
      rotulo,
      abas,
      ocorrencias,
      clusters,
      resumo: {
        periodos,
        totalDiscentes: discentesUnicos.size,
        totalQuestoes: abas.reduce((soma, aba) => soma + aba.totalQuestoes, 0),
        totalRegistros
      },
      aplicacaoExistente,
      // O bloqueio por aplicação repetida some quando o usuário opta por substituir.
      podeImportar: !temBloqueio(
        ocorrencias.filter((item) => item.codigo !== 'aplicacao-ja-importada')
      )
    }
  }

  async importar(decisoes: DecisoesImportacao, usuarioId: string): Promise<ResultadoImportacao> {
    const curso = await this.repositorio.cursos.buscarPorId(decisoes.cursoId)
    if (!curso) return { sucesso: false, mensagem: 'Curso não encontrado.' }
    if (decisoes.abas.length === 0) {
      return { sucesso: false, mensagem: 'Selecione ao menos uma aba para importar.' }
    }

    const hashArquivo = await hashDoArquivo(decisoes.caminho)
    const existente = await this.procurarAplicacaoEquivalente(
      decisoes.cursoId,
      decisoes.rotulo,
      hashArquivo
    )

    if (existente && !decisoes.substituirAnterior) {
      return {
        sucesso: false,
        mensagem:
          'Esta aplicação já foi importada. Marque a opção de substituir a importação ' +
          'anterior para prosseguir.'
      }
    }

    const workbook = await abrirPlanilha(decisoes.caminho)
    const abas: AbaParaCarga[] = []

    for (const escolha of decisoes.abas) {
      const matriz = lerMatriz(workbook, escolha.nome, curso.perfilImportacao)
      if (!matriz) {
        return { sucesso: false, mensagem: `A aba "${escolha.nome}" não foi encontrada no arquivo.` }
      }
      abas.push({ nome: escolha.nome, periodo: escolha.periodo, matriz })
    }

    const periodosEscolhidos = new Map<string, string | null>(
      decisoes.abas.map((aba) => [aba.nome, aba.periodo])
    )

    const ocorrencias = validarImportacao({
      curso,
      abas: abas.map((aba) => ({
        nome: aba.nome,
        tipo: 'desempenho' as const,
        periodoSugerido: aba.periodo,
        motivo: '',
        totalQuestoes: aba.matriz.questoes.length,
        totalDiscentes: aba.matriz.discentes.length,
        avisos: aba.matriz.avisos
      })),
      periodosEscolhidos,
      aplicacaoExistente: decisoes.substituirAnterior ? null : existente,
      rotulo: decisoes.rotulo
    })

    ocorrencias.push(...this.ocorrenciasDeConteudo(abas.map((aba) => aba.matriz)).ocorrencias)

    if (temBloqueio(ocorrencias)) {
      return {
        sucesso: false,
        mensagem: 'A importação não pode seguir enquanto houver ocorrências bloqueantes.',
        ocorrencias
      }
    }

    const unificacoes = new Map<CampoGrafia, Map<string, string>>()
    for (const unificacao of decisoes.unificacoes) {
      const mapa = unificacoes.get(unificacao.campo) ?? new Map<string, string>()
      for (const chave of unificacao.chaves) mapa.set(chave, unificacao.para)
      unificacoes.set(unificacao.campo, mapa)
    }

    try {
      const resumo = await carregar(this.repositorio, {
        curso,
        rotulo: decisoes.rotulo,
        arquivo: {
          caminho: decisoes.caminho,
          nome: basename(decisoes.caminho),
          hash: hashArquivo
        },
        importadoPor: usuarioId,
        abas,
        unificacoes,
        ocorrencias,
        substituirAnterior: decisoes.substituirAnterior
      })

      return { sucesso: true, resumo, ocorrencias }
    } catch (erro) {
      // A transação já desfez tudo: o banco está como estava antes.
      return {
        sucesso: false,
        mensagem: `A importação falhou e nada foi gravado. (${
          erro instanceof Error ? erro.message : String(erro)
        })`,
        ocorrencias
      }
    }
  }

  async historico(): Promise<ItemHistorico[]> {
    const [aplicacoes, cursos, logs] = await Promise.all([
      this.repositorio.aplicacoes.buscar(),
      this.repositorio.cursos.buscar(),
      this.repositorio.logImportacoes.buscar()
    ])

    const nomeDoCurso = new Map(cursos.map((curso) => [curso._id, curso.nome]))
    const logPorAplicacao = new Map(logs.map((log) => [log.aplicacaoId, log]))

    return aplicacoes
      .map((aplicacao) => ({
        _id: aplicacao._id,
        cursoId: aplicacao.cursoId,
        cursoNome: nomeDoCurso.get(aplicacao.cursoId) ?? 'Curso removido',
        rotulo: aplicacao.rotulo,
        arquivoOriginal: aplicacao.arquivoOriginal,
        dataImportacao: aplicacao.dataImportacao,
        importadoPor: aplicacao.importadoPor,
        periodos: aplicacao.periodos,
        totalDiscentes: aplicacao.totalDiscentes,
        totalRegistros: aplicacao.totalRegistros,
        status: aplicacao.status,
        ocorrencias: logPorAplicacao.get(aplicacao._id)?.ocorrencias ?? []
      }))
      .sort((a, b) => b.dataImportacao.localeCompare(a.dataImportacao))
  }

  /** Remove uma aplicação e tudo que veio com ela. */
  async excluirAplicacao(aplicacaoId: string): Promise<{ sucesso: boolean; mensagem?: string }> {
    const aplicacao = await this.repositorio.aplicacoes.buscarPorId(aplicacaoId)
    if (!aplicacao) return { sucesso: false, mensagem: 'Importação não encontrada.' }

    await this.repositorio.transacao(async () => {
      await this.repositorio.desempenho.remover({ aplicacaoId })
      await this.repositorio.questoes.remover({ aplicacaoId })
      await this.repositorio.logImportacoes.remover({ aplicacaoId })
      await this.repositorio.aplicacoes.remover({ _id: aplicacaoId })
    })

    return { sucesso: true }
  }

  /**
   * Ocorrências que dependem de olhar o conteúdo das abas juntas: grafias
   * divergentes e discentes repetidos entre períodos.
   *
   * É calculado tanto na análise quanto na importação, para que o registro
   * gravado no histórico seja o mesmo que a docente viu na tela.
   */
  private ocorrenciasDeConteudo(matrizes: MatrizAba[]): {
    clusters: ClusterGrafiaDTO[]
    ocorrencias: OcorrenciaImportacao[]
  } {
    const docentes: string[] = []
    const temas: string[] = []
    const periodosPorDiscente = new Map<string, string[]>()

    for (const matriz of matrizes) {
      for (const questao of matriz.questoes) {
        if (questao.docente) docentes.push(questao.docente)
        if (questao.tema) temas.push(questao.tema)
      }
      for (const nome of matriz.discentes) {
        const chave = chaveComparacao(nome)
        periodosPorDiscente.set(chave, [...(periodosPorDiscente.get(chave) ?? []), matriz.aba])
      }
    }

    const clusters: ClusterGrafiaDTO[] = [
      ...this.clusters('docente', docentes),
      ...this.clusters('tema', temas)
    ]
    const ocorrencias: OcorrenciaImportacao[] = []

    if (clusters.length > 0) {
      ocorrencias.push({
        severidade: 'atencao',
        codigo: 'grafias-divergentes',
        mensagem:
          `${clusters.length} grafia(s) parecem se referir à mesma coisa escrita de formas ` +
          'diferentes. Confirme a unificação antes de importar.',
        detalhes: clusters.map(
          (cluster) => `${cluster.campo}: ${cluster.variantes.map((v) => `"${v.texto}"`).join(' / ')}`
        )
      })
    }

    const semNenhumAcerto: string[] = []
    for (const matriz of matrizes) {
      matriz.discentes.forEach((nome, indice) => {
        const acertou = matriz.questoes.some((questao) => questao.acertos[indice])
        if (!acertou) semNenhumAcerto.push(`${nome} (${matriz.aba})`)
      })
    }

    if (semNenhumAcerto.length > 0) {
      ocorrencias.push({
        severidade: 'atencao',
        codigo: 'discente-sem-nenhum-acerto',
        mensagem:
          `${semNenhumAcerto.length} discente(s) não acertaram nenhuma questão. ` +
          'Pode ser ausência na prova registrada como coluna vazia — e, pela régua do curso, ' +
          'essas pessoas ainda recebem a nota base. Confira antes de importar.',
        detalhes: semNenhumAcerto
      })
    }

    const repetidos = [...periodosPorDiscente.entries()].filter(([, abas]) => abas.length > 1)
    if (repetidos.length > 0) {
      ocorrencias.push({
        severidade: 'atencao',
        codigo: 'discente-em-mais-de-um-periodo',
        mensagem:
          `${repetidos.length} discente(s) aparecem em mais de uma aba desta mesma aplicação. ` +
          'Os dois resultados serão importados; confira se não é homônimo ou repetição.',
        detalhes: repetidos.map(([, abas]) => abas.join(', '))
      })
    }

    return { clusters, ocorrencias }
  }

  private clusters(campo: CampoGrafia, valores: string[]): ClusterGrafiaDTO[] {
    return agruparGrafias(valores).map((cluster) => ({
      campo,
      chave: chaveAgrupamento(cluster.sugestao),
      // Todas as chaves do grupo, para que a unificação alcance também as
      // variantes que só se aproximam por uma letra.
      chavesVariantes: [...new Set(cluster.variantes.map((v) => chaveAgrupamento(v.texto)))],
      sugestao: cluster.sugestao,
      variantes: cluster.variantes
    }))
  }

  /** Mesmo arquivo no mesmo curso, ou mesmo rótulo de aplicação no mesmo curso. */
  private async procurarAplicacaoEquivalente(
    cursoId: string,
    rotulo: string,
    hashArquivo: string
  ): Promise<AnaliseImportacao['aplicacaoExistente']> {
    const aplicacoes = await this.repositorio.aplicacoes.buscar({ cursoId })
    const encontrada = aplicacoes.find(
      (aplicacao) => aplicacao.hashArquivo === hashArquivo || aplicacao.rotulo === rotulo
    )

    return encontrada
      ? {
          _id: encontrada._id,
          rotulo: encontrada.rotulo,
          dataImportacao: encontrada.dataImportacao,
          totalRegistros: encontrada.totalRegistros
        }
      : null
  }
}
