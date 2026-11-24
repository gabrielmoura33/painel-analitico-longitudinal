import type { Identificador, PerfilUsuario } from '@/dominio/modelos/dominio'

/**
 * Resultado de uma operação que o usuário pode errar.
 *
 * Erro previsível — senha incorreta, CPF repetido, curso fora do escopo — é
 * valor de retorno, não exceção: a interface precisa mostrá-lo como mensagem,
 * e transformá-lo em exceção faria o caminho normal passar por `catch`.
 * Exceção fica para o que não se espera.
 */
export interface ResultadoOperacao {
  sucesso: boolean
  mensagem?: string
}

export interface SessaoAtual {
  autenticado: boolean
  usuarioId: Identificador | null
  nome: string | null
  perfil: PerfilUsuario | null
  cursosPermitidos: Identificador[]
  primeiroAcesso: boolean
}

export const SESSAO_ANONIMA: SessaoAtual = {
  autenticado: false,
  usuarioId: null,
  nome: null,
  perfil: null,
  cursosPermitidos: [],
  primeiroAcesso: false
}
