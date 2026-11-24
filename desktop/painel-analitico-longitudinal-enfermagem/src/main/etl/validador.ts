import type { Curso, OcorrenciaImportacao } from '@compartilhado/types/dominio'
import type { AbaAnalisada, AplicacaoExistente } from '@compartilhado/types/importacao'

/**
 * Validação de uma planilha contra o perfil do curso.
 *
 * O princípio vem do documento executivo: a rotina reporta o que não conseguiu
 * resolver, em vez de recusar o arquivo. Só é bloqueante o que torna a
 * importação impossível ou ambígua.
 */

export interface ContextoValidacao {
  curso: Curso
  abas: AbaAnalisada[]
  /** Período escolhido para cada aba de desempenho, por nome de aba. */
  periodosEscolhidos: Map<string, string | null>
  aplicacaoExistente: AplicacaoExistente | null
  rotulo: string
}

export function validarImportacao(contexto: ContextoValidacao): OcorrenciaImportacao[] {
  const ocorrencias: OcorrenciaImportacao[] = []
  const { curso, abas, periodosEscolhidos, aplicacaoExistente, rotulo } = contexto

  const deDesempenho = abas.filter((aba) => aba.tipo === 'desempenho')

  if (deDesempenho.length === 0) {
    ocorrencias.push({
      severidade: 'bloqueante',
      codigo: 'sem-aba-de-desempenho',
      mensagem:
        'Nenhuma aba com matriz de acertos foi reconhecida. ' +
        'Confira o mapeamento de colunas do curso antes de importar.'
    })
  }

  if (!/^\d{4}\/[12]$/.test(rotulo.trim())) {
    ocorrencias.push({
      severidade: 'bloqueante',
      codigo: 'rotulo-invalido',
      mensagem: `Informe a aplicação no formato ano/semestre, como "2025/1". Recebido: "${rotulo}".`
    })
  }

  if (aplicacaoExistente) {
    ocorrencias.push({
      severidade: 'bloqueante',
      codigo: 'aplicacao-ja-importada',
      mensagem:
        `Esta aplicação já foi importada em ` +
        `${new Date(aplicacaoExistente.dataImportacao).toLocaleString('pt-BR')} ` +
        `(${aplicacaoExistente.totalRegistros} registros). ` +
        'Substitua a importação anterior ou cancele.'
    })
  }

  const periodosUsados = new Map<string, string[]>()

  for (const aba of deDesempenho) {
    const periodo = periodosEscolhidos.get(aba.nome) ?? null

    if (!periodo) {
      ocorrencias.push({
        severidade: 'bloqueante',
        codigo: 'periodo-nao-definido',
        mensagem: `A aba "${aba.nome}" está sem período. Escolha qual período ela representa.`
      })
      continue
    }

    if (!curso.estrutura.periodos.includes(periodo)) {
      ocorrencias.push({
        severidade: 'bloqueante',
        codigo: 'periodo-nao-cadastrado',
        mensagem:
          `O período "${periodo}" da aba "${aba.nome}" não está cadastrado em ${curso.nome}. ` +
          'Cadastre-o em Cursos e réguas ou escolha outro período.'
      })
      continue
    }

    periodosUsados.set(periodo, [...(periodosUsados.get(periodo) ?? []), aba.nome])
  }

  for (const [periodo, nomesAbas] of periodosUsados) {
    if (nomesAbas.length > 1) {
      ocorrencias.push({
        severidade: 'bloqueante',
        codigo: 'periodo-repetido',
        mensagem: `O período ${periodo} foi atribuído a mais de uma aba.`,
        detalhes: nomesAbas
      })
    }
  }

  for (const aba of deDesempenho) {
    if (aba.totalQuestoes !== curso.estrutura.totalQuestoes) {
      ocorrencias.push({
        severidade: 'atencao',
        codigo: 'quantidade-de-questoes-diferente',
        mensagem:
          `A aba "${aba.nome}" tem ${aba.totalQuestoes} questões, e o curso está ` +
          `configurado para ${curso.estrutura.totalQuestoes}.`
      })
    }

    if (aba.totalDiscentes === 0) {
      ocorrencias.push({
        severidade: 'bloqueante',
        codigo: 'aba-sem-discentes',
        mensagem: `A aba "${aba.nome}" não tem nenhum discente reconhecido.`
      })
    }

    for (const aviso of [...new Set(aba.avisos)]) {
      ocorrencias.push({
        severidade: 'informativa',
        codigo: 'aviso-de-leitura',
        mensagem: `${aba.nome}: ${aviso}`
      })
    }
  }

  const ignoradas = abas.filter((aba) => aba.tipo !== 'desempenho')
  if (ignoradas.length > 0) {
    ocorrencias.push({
      severidade: 'informativa',
      codigo: 'abas-ignoradas',
      mensagem: `${ignoradas.length} aba(s) não entram na importação.`,
      detalhes: ignoradas.map((aba) => `${aba.nome} — ${aba.motivo}`)
    })
  }

  return ocorrencias
}

export function temBloqueio(ocorrencias: OcorrenciaImportacao[]): boolean {
  return ocorrencias.some((ocorrencia) => ocorrencia.severidade === 'bloqueante')
}

export function contarPorSeveridade(
  ocorrencias: OcorrenciaImportacao[]
): Record<'bloqueante' | 'atencao' | 'informativa', number> {
  return {
    bloqueante: ocorrencias.filter((item) => item.severidade === 'bloqueante').length,
    atencao: ocorrencias.filter((item) => item.severidade === 'atencao').length,
    informativa: ocorrencias.filter((item) => item.severidade === 'informativa').length
  }
}
