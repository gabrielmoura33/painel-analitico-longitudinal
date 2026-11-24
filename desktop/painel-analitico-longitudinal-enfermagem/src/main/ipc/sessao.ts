import type { ServicoAutenticacao } from '../servicos/autenticacao'
import type { ServicoUsuarios } from '../servicos/usuarios'
import { registrar, registrarProtegido } from './index'

export function registrarCanaisSessao(
  autenticacao: ServicoAutenticacao,
  usuarios: ServicoUsuarios
): void {
  registrar('sessao:atual', () => autenticacao.sessaoAtual())

  registrar('sessao:entrar', ({ login, senha, manterConectado }) =>
    autenticacao.entrar(login, senha, manterConectado)
  )

  registrar('sessao:sair', () => autenticacao.sair())

  registrar('sessao:criar-primeiro-administrador', (dados) =>
    autenticacao.criarPrimeiroAdministrador(dados)
  )

  registrarProtegido(
    'sessao:definir-senha',
    autenticacao,
    'qualquer',
    ({ senhaAtual, novaSenha, aceitouTermo }) =>
      autenticacao.definirSenha(senhaAtual, novaSenha, aceitouTermo)
  )

  registrar('senha:solicitar-redefinicao', async ({ login }) => {
    await usuarios.registrarSolicitacaoSenha(login)
    // Resposta sempre idêntica: não revela quais logins existem.
    return {
      sucesso: true,
      mensagem: 'Se o usuário existir, o administrador será notificado do pedido.'
    }
  })
}
