import type { EstadoInicial } from '@compartilhado/types/ipc'

import { ROTEIRO_JORNADA, passosAplicaveis, type ContextoJornada } from '@compartilhado/jornada'

import { iniciarJornadaGuiada } from '../componentes/tour'

/** Liga o roteiro compartilhado à camada que o desenha sobre as telas. */
function contextoDe(estado: EstadoInicial): ContextoJornada {
  return {
    ehAdmin: estado.sessao.perfil === 'administrador',
    possuiAplicacoes: estado.possuiAplicacoes
  }
}

/** Quantos passos esta pessoa vai ver, já descontado o que não se aplica a ela. */
export function passosDaJornada(estado: EstadoInicial): number {
  return passosAplicaveis(contextoDe(estado)).length
}

export function iniciarJornada(
  estado: EstadoInicial,
  aoTerminar?: (concluiu: boolean) => void
): void {
  iniciarJornadaGuiada(ROTEIRO_JORNADA, contextoDe(estado), aoTerminar)
}
