import { ehPerfilValido } from '@compartilhado/acesso'
import type { PerfilUsuario, SolicitacaoSenha, Usuario } from '@compartilhado/types/dominio'
import type {
  FiltroUsuarios,
  NovoUsuario,
  ResultadoCriacaoUsuario,
  UsuarioResumo
} from '@compartilhado/types/ipc'
import {
  normalizarLogin,
  somenteDigitos,
  validarCpf,
  validarDataNascimento,
  validarLogin,
  validarNomeCompleto
} from '@compartilhado/validacao'

import type { Repositorio } from '../db'
import { gerarHash, gerarSenhaInicial } from './senhas'

/** O renderer nunca recebe hash de senha nem CPF em listagem. */
export function resumir(usuario: Usuario): UsuarioResumo {
  return {
    _id: usuario._id,
    nomeCompleto: usuario.nomeCompleto,
    login: usuario.login,
    perfil: usuario.perfil,
    cursosPermitidos: usuario.cursosPermitidos ?? [],
    ativo: usuario.ativo,
    primeiroAcesso: usuario.primeiroAcesso,
    ultimoAcesso: usuario.ultimoAcesso,
    criadoEm: usuario.criadoEm
  }
}

function semAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export class ServicoUsuarios {
  constructor(private readonly repositorio: Repositorio) {}

  async listar(filtro: FiltroUsuarios = {}): Promise<UsuarioResumo[]> {
    const todos = await this.repositorio.usuarios.buscar()
    const busca = filtro.busca ? semAcentos(filtro.busca.trim()) : ''

    return todos
      .filter((usuario) => {
        if (filtro.perfil && usuario.perfil !== filtro.perfil) return false
        if (filtro.ativo !== undefined && usuario.ativo !== filtro.ativo) return false
        if (!busca) return true
        return (
          semAcentos(usuario.nomeCompleto).includes(busca) ||
          usuario.login.includes(busca)
        )
      })
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'))
      .map(resumir)
  }

  async criar(dados: NovoUsuario): Promise<ResultadoCriacaoUsuario> {
    const problema = await this.validar(dados)
    if (problema) return { sucesso: false, mensagem: problema }

    const senhaInicial = gerarSenhaInicial()
    const usuario = await this.repositorio.usuarios.inserir({
      nomeCompleto: dados.nomeCompleto.trim().replace(/\s+/g, ' '),
      cpf: somenteDigitos(dados.cpf),
      dataNascimento: dados.dataNascimento,
      login: normalizarLogin(dados.login),
      senhaHash: await gerarHash(senhaInicial),
      perfil: dados.perfil,
      cursosPermitidos: dados.perfil === 'administrador' ? [] : [...new Set(dados.cursosPermitidos)],
      ativo: true,
      // Obriga a troca de senha e o aceite do termo no primeiro login.
      primeiroAcesso: true,
      ultimoAcesso: null,
      termoAceitoEm: null,
      criadoEm: new Date().toISOString()
    })

    await this.atenderSolicitacoesDe(usuario.login, null)
    return { sucesso: true, usuario: resumir(usuario), senhaInicial }
  }

  async redefinirSenha(
    usuarioId: string,
    administradorId: string
  ): Promise<ResultadoCriacaoUsuario> {
    const usuario = await this.repositorio.usuarios.buscarPorId(usuarioId)
    if (!usuario) return { sucesso: false, mensagem: 'Usuário não encontrado.' }

    const senhaInicial = gerarSenhaInicial()
    const atualizado = await this.repositorio.usuarios.atualizar(usuarioId, {
      senhaHash: await gerarHash(senhaInicial),
      primeiroAcesso: true
    })
    if (!atualizado) return { sucesso: false, mensagem: 'Não foi possível redefinir a senha.' }

    // A sessão lembrada do usuário deixa de valer assim que a senha muda.
    await this.repositorio.sessoes.remover({ usuarioId })
    await this.atenderSolicitacoesDe(usuario.login, administradorId)

    return { sucesso: true, usuario: resumir(atualizado), senhaInicial }
  }

  async alterarSituacao(
    usuarioId: string,
    ativo: boolean,
    solicitanteId: string
  ): Promise<{ sucesso: boolean; mensagem?: string; usuario?: UsuarioResumo }> {
    if (usuarioId === solicitanteId && !ativo) {
      return { sucesso: false, mensagem: 'Você não pode desativar o próprio usuário.' }
    }

    const alvo = await this.repositorio.usuarios.buscarPorId(usuarioId)
    if (!alvo) return { sucesso: false, mensagem: 'Usuário não encontrado.' }

    if (!ativo && alvo.perfil === 'administrador' && (await this.contarAdministradoresAtivos()) <= 1) {
      return { sucesso: false, mensagem: 'A instalação precisa de ao menos um administrador ativo.' }
    }

    const atualizado = await this.repositorio.usuarios.atualizar(usuarioId, { ativo })
    if (!atualizado) return { sucesso: false, mensagem: 'Não foi possível alterar a situação.' }

    if (!ativo) await this.repositorio.sessoes.remover({ usuarioId })
    return { sucesso: true, usuario: resumir(atualizado) }
  }

  async alterarPerfil(
    usuarioId: string,
    perfil: PerfilUsuario,
    solicitanteId: string
  ): Promise<{ sucesso: boolean; mensagem?: string; usuario?: UsuarioResumo }> {
    if (usuarioId === solicitanteId && perfil !== 'administrador') {
      return { sucesso: false, mensagem: 'Você não pode rebaixar o próprio perfil.' }
    }

    const alvo = await this.repositorio.usuarios.buscarPorId(usuarioId)
    if (!alvo) return { sucesso: false, mensagem: 'Usuário não encontrado.' }

    if (
      perfil !== 'administrador' &&
      alvo.perfil === 'administrador' &&
      (await this.contarAdministradoresAtivos()) <= 1
    ) {
      return { sucesso: false, mensagem: 'A instalação precisa de ao menos um administrador ativo.' }
    }

    // Administrador alcança todo o departamento: manter um escopo seria mentira.
    const alteracoes = perfil === 'administrador' ? { perfil, cursosPermitidos: [] } : { perfil }
    const atualizado = await this.repositorio.usuarios.atualizar(usuarioId, alteracoes)
    return atualizado
      ? { sucesso: true, usuario: resumir(atualizado) }
      : { sucesso: false, mensagem: 'Não foi possível alterar o perfil.' }
  }

  /**
   * Define quais cursos o usuário enxerga.
   *
   * Lista vazia significa todos — e é o único estado possível para o
   * administrador, que responde pelo departamento inteiro.
   */
  async alterarEscopo(
    usuarioId: string,
    cursosPermitidos: string[]
  ): Promise<{ sucesso: boolean; mensagem?: string; usuario?: UsuarioResumo }> {
    const alvo = await this.repositorio.usuarios.buscarPorId(usuarioId)
    if (!alvo) return { sucesso: false, mensagem: 'Usuário não encontrado.' }

    if (alvo.perfil === 'administrador' && cursosPermitidos.length > 0) {
      return {
        sucesso: false,
        mensagem: 'O administrador alcança todos os cursos: o escopo dele é sempre o departamento.'
      }
    }

    const cursos = await this.repositorio.cursos.buscar()
    const existentes = new Set(cursos.map((curso) => curso._id))
    const invalido = cursosPermitidos.find((cursoId) => !existentes.has(cursoId))
    if (invalido) return { sucesso: false, mensagem: 'Curso inexistente no escopo informado.' }

    const atualizado = await this.repositorio.usuarios.atualizar(usuarioId, {
      cursosPermitidos: [...new Set(cursosPermitidos)]
    })
    return atualizado
      ? { sucesso: true, usuario: resumir(atualizado) }
      : { sucesso: false, mensagem: 'Não foi possível alterar o escopo.' }
  }

  /**
   * Registra o pedido de redefinição.
   *
   * O cadastro não coleta e-mail, então não há como enviar link: o pedido vira
   * pendência para o administrador, que redefine e entrega a nova senha pelo
   * canal institucional. A resposta é sempre a mesma, exista o login ou não.
   */
  async registrarSolicitacaoSenha(login: string): Promise<void> {
    const chave = normalizarLogin(login)
    if (!chave) return

    const usuario = await this.repositorio.usuarios.buscarUm({ login: chave })
    if (!usuario) return

    const pendente = await this.repositorio.solicitacoesSenha.buscarUm({
      login: chave,
      atendidoEm: null
    })
    if (pendente) return

    await this.repositorio.solicitacoesSenha.inserir({
      login: chave,
      solicitadoEm: new Date().toISOString(),
      atendidoEm: null,
      atendidoPor: null
    })
  }

  async solicitacoesPendentes(): Promise<SolicitacaoSenha[]> {
    const pendentes = await this.repositorio.solicitacoesSenha.buscar({ atendidoEm: null })
    return pendentes.sort((a, b) => b.solicitadoEm.localeCompare(a.solicitadoEm))
  }

  private async atenderSolicitacoesDe(login: string, administradorId: string | null): Promise<void> {
    const pendentes = await this.repositorio.solicitacoesSenha.buscar({ login, atendidoEm: null })
    for (const solicitacao of pendentes) {
      await this.repositorio.solicitacoesSenha.atualizar(solicitacao._id, {
        atendidoEm: new Date().toISOString(),
        atendidoPor: administradorId
      })
    }
  }

  private async contarAdministradoresAtivos(): Promise<number> {
    return this.repositorio.usuarios.contar({ perfil: 'administrador', ativo: true })
  }

  private async validar(dados: NovoUsuario): Promise<string | null> {
    const checagens = [
      validarNomeCompleto(dados.nomeCompleto),
      validarCpf(dados.cpf),
      validarDataNascimento(dados.dataNascimento),
      validarLogin(dados.login)
    ]
    const falha = checagens.find((checagem) => !checagem.valido)
    if (falha) return falha.mensagem ?? 'Dados inválidos.'

    if (!ehPerfilValido(dados.perfil)) return 'Selecione um perfil.'

    if (dados.perfil !== 'administrador') {
      const cursos = await this.repositorio.cursos.buscar()
      const existentes = new Set(cursos.map((curso) => curso._id))
      const invalido = dados.cursosPermitidos.find((cursoId) => !existentes.has(cursoId))
      if (invalido) return 'Curso inexistente no escopo informado.'
    }

    const login = normalizarLogin(dados.login)
    if (await this.repositorio.usuarios.buscarUm({ login })) {
      return `O login "${login}" já está em uso.`
    }

    const cpf = somenteDigitos(dados.cpf)
    if (await this.repositorio.usuarios.buscarUm({ cpf })) {
      return 'Já existe um usuário cadastrado com este CPF.'
    }

    return null
  }
}
