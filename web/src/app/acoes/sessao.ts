'use server'

import { redirect } from 'next/navigation'

import type { ResultadoOperacao } from '@/dominio/modelos/resultado'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

/**
 * Ações de sessão.
 *
 * São `server actions`: o navegador chama, o código roda no servidor. É o
 * equivalente ao IPC da versão desktop — com uma diferença que importa, e que
 * vale lembrar sempre que alguém for acrescentar uma ação aqui: no Electron o
 * outro lado do canal era a nossa própria janela; aqui é a internet. Toda
 * ação valida o que recebe e confere a sessão por conta própria.
 */

export async function entrar(
  _estadoAnterior: ResultadoOperacao | null,
  formulario: FormData
): Promise<ResultadoOperacao> {
  const login = String(formulario.get('login') ?? '')
  const senha = String(formulario.get('senha') ?? '')
  const manterConectado = formulario.get('manterConectado') === 'on'

  const container = Container.paraRequisicao()
  const resultado = await container.autenticacao().entrar(login, senha, manterConectado)

  if (!resultado.sucesso || !resultado.sessaoId) {
    return { sucesso: false, mensagem: resultado.mensagem }
  }

  await SessaoHttp.gravar(resultado.sessaoId, resultado.duracaoEmDias ?? 0)
  redirect('/visao-geral')
}

export async function sair(): Promise<void> {
  const container = Container.paraRequisicao()
  await container.autenticacao().sair(await SessaoHttp.identificador())
  await SessaoHttp.apagar()
  redirect('/login')
}

export async function criarPrimeiroAdministrador(
  _estadoAnterior: ResultadoOperacao | null,
  formulario: FormData
): Promise<ResultadoOperacao> {
  const container = Container.paraRequisicao()
  const resultado = await container.autenticacao().criarPrimeiroAdministrador({
    nomeCompleto: String(formulario.get('nomeCompleto') ?? ''),
    cpf: String(formulario.get('cpf') ?? ''),
    dataNascimento: String(formulario.get('dataNascimento') ?? ''),
    login: String(formulario.get('login') ?? ''),
    senha: String(formulario.get('senha') ?? ''),
    aceitouTermo: formulario.get('aceitouTermo') === 'on'
  })

  if (!resultado.sucesso || !resultado.sessaoId) {
    return { sucesso: false, mensagem: resultado.mensagem }
  }

  await SessaoHttp.gravar(resultado.sessaoId, resultado.duracaoEmDias ?? 0)
  redirect('/visao-geral')
}

export async function definirSenha(
  _estadoAnterior: ResultadoOperacao | null,
  formulario: FormData
): Promise<ResultadoOperacao> {
  const usuario = await SessaoHttp.exigirUsuario()
  const container = Container.paraRequisicao()

  const resultado = await container
    .autenticacao()
    .definirSenha(
      usuario,
      String(formulario.get('senhaAtual') ?? ''),
      String(formulario.get('novaSenha') ?? ''),
      formulario.get('aceitouTermo') === 'on'
    )

  if (!resultado.sucesso) return resultado

  // A troca encerrou todas as sessões, inclusive esta: entrar de novo.
  await SessaoHttp.apagar()
  redirect('/login')
}

/**
 * Pedido de redefinição de senha.
 *
 * Responde a mesma coisa exista ou não o login. Dizer "este usuário não
 * existe" transformaria a tela num verificador de contas para quem estivesse
 * tentando descobrir quem tem acesso ao painel.
 */
export async function pedirRedefinicaoDeSenha(
  _estadoAnterior: ResultadoOperacao | null,
  formulario: FormData
): Promise<ResultadoOperacao> {
  const login = String(formulario.get('login') ?? '').trim()
  if (login.length === 0) return { sucesso: false, mensagem: 'Informe seu usuário.' }

  await Container.paraRequisicao().usuarios().registrarSolicitacaoSenha(login)
  return {
    sucesso: true,
    mensagem:
      'Pedido registrado. Procure quem administra o painel para receber a nova senha inicial.'
  }
}
