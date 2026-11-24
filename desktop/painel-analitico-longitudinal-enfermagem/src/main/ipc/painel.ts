import type { ServicoAutenticacao } from '../servicos/autenticacao'
import type { ServicoIndicadores } from '../servicos/indicadores'
import { escopoDe, exigirCurso, registrarProtegido } from './index'

/**
 * Canais dos painéis analíticos.
 *
 * Todos exigem sessão, e nenhum exige perfil de administrador: analisar os
 * indicadores é justamente o que o perfil Professor faz.
 */
export function registrarCanaisPainel(
  autenticacao: ServicoAutenticacao,
  indicadores: ServicoIndicadores
): void {
  registrarProtegido(
    'painel:contexto',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId }, usuario) =>
      indicadores.contexto(cursoId, aplicacaoId, escopoDe(usuario))
  )

  registrarProtegido(
    'painel:visao-geral',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.visaoGeral(cursoId, aplicacaoId)
    }
  )

  registrarProtegido(
    'painel:visao-turma',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId, periodo }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.visaoTurma(cursoId, aplicacaoId, periodo)
    }
  )

  registrarProtegido(
    'painel:visao-areas',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.visaoAreas(cursoId, aplicacaoId)
    }
  )

  registrarProtegido(
    'painel:visao-questoes',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.visaoQuestoes(cursoId, aplicacaoId)
    }
  )

  registrarProtegido(
    'painel:visao-docentes',
    autenticacao,
    'qualquer',
    ({ cursoId, aplicacaoId }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.visaoDocentes(cursoId, aplicacaoId)
    }
  )

  registrarProtegido(
    'painel:buscar-discentes',
    autenticacao,
    'qualquer',
    ({ cursoId, termo }, usuario) => {
      exigirCurso(usuario, cursoId)
      return indicadores.buscarDiscentes(cursoId, termo)
    }
  )

  /*
   * A ficha individual é a única tela que mostra o nome real do discente.
   * Exige sessão, como todas, e o acesso fica registrado no log da aplicação.
   */
  registrarProtegido('painel:visao-discente', autenticacao, 'qualquer', ({ cursoId, discenteId }, usuario) => {
    exigirCurso(usuario, cursoId)
    console.info(
      `[acesso-ficha] usuário ${usuario._id} abriu a ficha do discente ${discenteId} em ${new Date().toISOString()}`
    )
    return indicadores.visaoDiscente(cursoId, discenteId)
  })
}
