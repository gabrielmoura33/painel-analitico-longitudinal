import { app } from 'electron'

import { podeVerCurso } from '@compartilhado/acesso'
import type { EstadoInicial, InfoSistema } from '@compartilhado/types/ipc'
import type { Repositorio } from '../db'
import { driverConfigurado, origemDaChaveDeDados } from '../db'
import type { ServicoAutenticacao } from '../servicos/autenticacao'
import { escopoDe, registrar, registrarProtegido } from './index'

export function registrarCanaisSistema(
  repositorio: Repositorio,
  autenticacao: ServicoAutenticacao
): void {
  registrar('sistema:info', (): InfoSistema => {
    return {
      versaoAplicacao: app.getVersion(),
      versaoElectron: process.versions.electron ?? 'desconhecida',
      versaoNode: process.versions.node,
      plataforma: process.platform,
      driverPersistencia: driverConfigurado(),
      caminhoDados: repositorio.descricaoLocalDados,
      origemChaveDados: origemDaChaveDeDados()
    }
  })

  registrar('sistema:estado-inicial', async (): Promise<EstadoInicial> => {
    const [totalAplicacoes, totalCursos, precisaConfiguracaoInicial] = await Promise.all([
      repositorio.aplicacoes.contar(),
      repositorio.cursos.contar(),
      autenticacao.precisaConfiguracaoInicial()
    ])

    return {
      sessao: autenticacao.sessaoAtual(),
      precisaConfiguracaoInicial,
      possuiAplicacoes: totalAplicacoes > 0,
      totalCursos
    }
  })

  /*
   * Exige sessão e respeita o escopo: a lista de aplicações revela que cursos
   * existem e quando foram alimentados.
   */
  registrarProtegido('aplicacao:listar', autenticacao, 'qualquer', async ({ cursoId }, usuario) => {
    const escopo = escopoDe(usuario)
    if (cursoId) {
      return podeVerCurso(escopo, cursoId) ? repositorio.aplicacoes.buscar({ cursoId }) : []
    }
    const todas = await repositorio.aplicacoes.buscar()
    return todas.filter((aplicacao) => podeVerCurso(escopo, aplicacao.cursoId))
  })
}
