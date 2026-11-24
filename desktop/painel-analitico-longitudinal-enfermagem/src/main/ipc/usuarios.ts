import type { ServicoAutenticacao } from '../servicos/autenticacao'
import type { ServicoUsuarios } from '../servicos/usuarios'
import { registrarProtegido } from './index'

const SOMENTE_ADMIN = ['administrador'] as const

export function registrarCanaisUsuarios(
  autenticacao: ServicoAutenticacao,
  usuarios: ServicoUsuarios
): void {
  registrarProtegido('usuario:listar', autenticacao, [...SOMENTE_ADMIN], (filtro) =>
    usuarios.listar(filtro)
  )

  registrarProtegido('usuario:criar', autenticacao, [...SOMENTE_ADMIN], (dados) =>
    usuarios.criar(dados)
  )

  registrarProtegido(
    'usuario:redefinir-senha',
    autenticacao,
    [...SOMENTE_ADMIN],
    ({ usuarioId }, administrador) => usuarios.redefinirSenha(usuarioId, administrador._id)
  )

  registrarProtegido(
    'usuario:alterar-situacao',
    autenticacao,
    [...SOMENTE_ADMIN],
    async ({ usuarioId, ativo }, administrador) => {
      const resultado = await usuarios.alterarSituacao(usuarioId, ativo, administrador._id)
      return resultado.sucesso && resultado.usuario
        ? { sucesso: true as const, usuario: resultado.usuario }
        : { sucesso: false as const, mensagem: resultado.mensagem ?? 'Operação não concluída.' }
    }
  )

  registrarProtegido(
    'usuario:alterar-escopo',
    autenticacao,
    [...SOMENTE_ADMIN],
    async ({ usuarioId, cursosPermitidos }) => {
      const resultado = await usuarios.alterarEscopo(usuarioId, cursosPermitidos)
      return resultado.sucesso && resultado.usuario
        ? { sucesso: true as const, usuario: resultado.usuario }
        : { sucesso: false as const, mensagem: resultado.mensagem ?? 'Falha ao alterar o escopo.' }
    }
  )

  registrarProtegido(
    'usuario:alterar-perfil',
    autenticacao,
    [...SOMENTE_ADMIN],
    async ({ usuarioId, perfil }, administrador) => {
      const resultado = await usuarios.alterarPerfil(usuarioId, perfil, administrador._id)
      if (resultado.sucesso && resultado.usuario) {
        await autenticacao.recarregarSessao()
        return { sucesso: true as const, usuario: resultado.usuario }
      }
      return { sucesso: false as const, mensagem: resultado.mensagem ?? 'Operação não concluída.' }
    }
  )

  registrarProtegido('usuario:solicitacoes-pendentes', autenticacao, [...SOMENTE_ADMIN], () =>
    usuarios.solicitacoesPendentes()
  )
}
