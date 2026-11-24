import type { ServicoAutenticacao } from '../servicos/autenticacao'
import type { ServicoImportacao } from '../servicos/importacao'
import { exigirCurso, registrarProtegido } from './index'

const SOMENTE_ADMIN = ['administrador'] as const

/**
 * Importar é trabalho da coordenação do campus, não só da administração do
 * painel: foi assim que as docentes descreveram a rotina do departamento.
 * Quem importa continua restrito aos cursos do próprio escopo.
 */
const PODE_IMPORTAR = ['administrador', 'coordenador'] as const

export function registrarCanaisImportacao(
  autenticacao: ServicoAutenticacao,
  importacao: ServicoImportacao
): void {
  registrarProtegido(
    'importacao:analisar',
    autenticacao,
    [...PODE_IMPORTAR],
    ({ caminho, cursoId, rotulo }, usuario) => {
      exigirCurso(usuario, cursoId)
      return importacao.analisar(caminho, cursoId, rotulo)
    }
  )

  registrarProtegido(
    'importacao:executar',
    autenticacao,
    [...PODE_IMPORTAR],
    (decisoes, usuario) => {
      exigirCurso(usuario, decisoes.cursoId)
      return importacao.importar(decisoes, usuario._id)
    }
  )

  // O histórico é leitura: qualquer usuário autenticado pode ver o que foi importado.
  registrarProtegido('importacao:historico', autenticacao, 'qualquer', () =>
    importacao.historico()
  )

  registrarProtegido(
    'importacao:excluir',
    autenticacao,
    [...SOMENTE_ADMIN],
    ({ aplicacaoId }) => importacao.excluirAplicacao(aplicacaoId)
  )
}
