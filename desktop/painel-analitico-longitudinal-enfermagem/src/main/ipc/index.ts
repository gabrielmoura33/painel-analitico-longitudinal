import { ipcMain } from 'electron'

import { podeVerCurso, type EscopoUsuario } from '@compartilhado/acesso'
import type { PerfilUsuario, Usuario } from '@compartilhado/types/dominio'
import type { CanalIpc, ContratoIpc } from '@compartilhado/types/ipc'
import type { ServicoAutenticacao } from '../servicos/autenticacao'

type Manipulador<C extends CanalIpc> = (
  entrada: ContratoIpc[C]['entrada']
) => Promise<ContratoIpc[C]['saida']> | ContratoIpc[C]['saida']

type ManipuladorProtegido<C extends CanalIpc> = (
  entrada: ContratoIpc[C]['entrada'],
  usuario: Usuario
) => Promise<ContratoIpc[C]['saida']> | ContratoIpc[C]['saida']

const canaisRegistrados = new Set<string>()

/**
 * Registro tipado de handler. Garante, em tempo de compilação, que o canal
 * existe no contrato e que entrada e saída batem com ele.
 */
export function registrar<C extends CanalIpc>(canal: C, manipulador: Manipulador<C>): void {
  if (canaisRegistrados.has(canal)) {
    throw new Error(`Canal IPC registrado duas vezes: ${canal}`)
  }
  canaisRegistrados.add(canal)

  ipcMain.handle(canal, async (_evento, entrada) => {
    return manipulador(entrada as ContratoIpc[C]['entrada'])
  })
}

/**
 * Registro de canal restrito por perfil.
 *
 * A restrição vive aqui, no processo principal: esconder o item de menu no
 * renderer é cortesia visual, não controle de acesso.
 */
export function registrarProtegido<C extends CanalIpc>(
  canal: C,
  autenticacao: ServicoAutenticacao,
  perfis: PerfilUsuario[] | 'qualquer',
  manipulador: ManipuladorProtegido<C>
): void {
  registrar(canal, (entrada) => {
    const usuario =
      perfis === 'qualquer' ? autenticacao.exigirAutenticado() : autenticacao.exigirPerfil(perfis)
    return manipulador(entrada, usuario)
  })
}

/**
 * Escopo de um usuário, no formato que as regras compartilhadas esperam.
 *
 * `cursosPermitidos` pode faltar nos documentos gravados antes de o escopo
 * existir: ausente, vale "todos", que é como a instalação funcionava.
 */
export function escopoDe(usuario: Usuario): EscopoUsuario {
  return { perfil: usuario.perfil, cursosPermitidos: usuario.cursosPermitidos ?? [] }
}

/** Interrompe a chamada quando o curso está fora do alcance do usuário. */
export function exigirCurso(usuario: Usuario, cursoId: string): void {
  if (!podeVerCurso(escopoDe(usuario), cursoId)) {
    throw new Error('Este curso está fora do seu escopo de acesso.')
  }
}

export function canaisDisponiveis(): string[] {
  return [...canaisRegistrados]
}
