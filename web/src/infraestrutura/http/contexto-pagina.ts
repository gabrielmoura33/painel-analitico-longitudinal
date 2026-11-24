import 'server-only'

import type { CasoDeUsoIndicadores } from '@/aplicacao/casos/indicadores'
import type { ContextoPainel } from '@/dominio/modelos/indicadores'
import type { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

export interface FiltrosDaUrl {
  curso?: string
  aplicacao?: string
  periodo?: string
  discente?: string
  busca?: string
  aba?: string
  componente?: string
  docente?: string
  criticas?: string
}

export interface ContextoDaPagina {
  escopo: EscopoDeAcesso
  indicadores: CasoDeUsoIndicadores
  contexto: ContextoPainel
}

/**
 * Preâmbulo comum de toda tela analítica: quem está pedindo, que curso e que
 * aplicação.
 *
 * O curso e a aplicação viajam na barra de endereços em vez de ficarem num
 * estado do navegador. É o que torna uma tela do painel compartilhável por
 * link entre as docentes — e o que faz o botão "voltar" funcionar como se
 * espera. Cada página confere o escopo por conta própria, porque o
 * identificador pode ter sido digitado à mão.
 */
export async function contextoDaPagina(filtros: FiltrosDaUrl): Promise<ContextoDaPagina> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  const indicadores = Container.paraRequisicao().indicadores()
  const contexto = await indicadores.contexto(filtros.curso, filtros.aplicacao, escopo)

  if (contexto.cursoId) escopo.exigirCurso(contexto.cursoId)
  return { escopo, indicadores, contexto }
}
