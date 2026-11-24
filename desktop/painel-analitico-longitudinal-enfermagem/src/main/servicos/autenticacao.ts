import { randomUUID } from 'node:crypto'

import type { PerfilUsuario, Usuario } from '@compartilhado/types/dominio'
import type { ResultadoOperacao, SessaoAtual } from '@compartilhado/types/ipc'
import {
  normalizarLogin,
  validarCpf,
  validarDataNascimento,
  validarLogin,
  validarNomeCompleto,
  validarSenha,
  somenteDigitos
} from '@compartilhado/validacao'

import type { Repositorio } from '../db'
import { conferirSenha, gerarHash } from './senhas'

const DIAS_SESSAO_LEMBRADA = 30
const TENTATIVAS_ATE_BLOQUEIO = 5
const BLOQUEIO_MS = 60_000

interface Tentativas {
  falhas: number
  bloqueadoAte: number
}

export interface DadosPrimeiroAdministrador {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  login: string
  senha: string
  aceitouTermo: boolean
}

export const SESSAO_ANONIMA: SessaoAtual = {
  autenticado: false,
  usuarioId: null,
  nome: null,
  perfil: null,
  cursosPermitidos: [],
  primeiroAcesso: false
}

export class ServicoAutenticacao {
  private usuarioAtual: Usuario | null = null
  private sessaoPersistidaId: string | null = null
  private readonly tentativas = new Map<string, Tentativas>()

  constructor(private readonly repositorio: Repositorio) {}

  sessaoAtual(): SessaoAtual {
    const usuario = this.usuarioAtual
    if (!usuario) return SESSAO_ANONIMA

    return {
      autenticado: true,
      usuarioId: usuario._id,
      nome: usuario.nomeCompleto,
      perfil: usuario.perfil,
      cursosPermitidos: usuario.cursosPermitidos ?? [],
      primeiroAcesso: usuario.primeiroAcesso
    }
  }

  usuarioAutenticado(): Usuario | null {
    return this.usuarioAtual
  }

  async precisaConfiguracaoInicial(): Promise<boolean> {
    return (await this.repositorio.usuarios.contar()) === 0
  }

  /**
   * Primeira execução: em vez de nascer com um administrador e uma senha
   * padrão — que ficaria valendo para sempre em toda instalação —, o sistema
   * pede que o primeiro administrador seja criado na hora, com senha própria.
   */
  async criarPrimeiroAdministrador(dados: DadosPrimeiroAdministrador): Promise<ResultadoOperacao> {
    if (!(await this.precisaConfiguracaoInicial())) {
      return { sucesso: false, mensagem: 'Já existe usuário cadastrado nesta instalação.' }
    }

    const problema = this.validarDadosCadastro(dados)
    if (problema) return { sucesso: false, mensagem: problema }

    const senhaValida = validarSenha(dados.senha)
    if (!senhaValida.valido) return { sucesso: false, mensagem: senhaValida.mensagem }
    if (!dados.aceitouTermo) {
      return { sucesso: false, mensagem: 'É necessário aceitar o termo de tratamento de dados.' }
    }

    const agora = new Date().toISOString()
    const usuario = await this.repositorio.usuarios.inserir({
      nomeCompleto: dados.nomeCompleto.trim().replace(/\s+/g, ' '),
      cpf: somenteDigitos(dados.cpf),
      dataNascimento: dados.dataNascimento,
      login: normalizarLogin(dados.login),
      senhaHash: await gerarHash(dados.senha),
      perfil: 'administrador',
      // Quem instala responde pelo departamento inteiro: escopo vazio é "todos".
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: false,
      ultimoAcesso: agora,
      termoAceitoEm: agora,
      criadoEm: agora
    })

    this.usuarioAtual = usuario
    return { sucesso: true }
  }

  async entrar(login: string, senha: string, manterConectado: boolean): Promise<ResultadoOperacao> {
    const chave = normalizarLogin(login)
    const bloqueio = this.tentativas.get(chave)

    if (bloqueio && bloqueio.bloqueadoAte > Date.now()) {
      const segundos = Math.ceil((bloqueio.bloqueadoAte - Date.now()) / 1000)
      return {
        sucesso: false,
        mensagem: `Muitas tentativas. Tente novamente em ${segundos} segundos.`
      }
    }

    const usuario = await this.repositorio.usuarios.buscarUm({ login: chave })
    const hashParaConferir = usuario?.senhaHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
    const senhaConfere = await conferirSenha(senha, hashParaConferir)

    if (!usuario || !senhaConfere) {
      this.registrarFalha(chave)
      // Mensagem única: não revela se o login existe.
      return { sucesso: false, mensagem: 'Usuário ou senha incorretos.' }
    }

    if (!usuario.ativo) {
      return { sucesso: false, mensagem: 'Este usuário está desativado. Procure o administrador.' }
    }

    this.tentativas.delete(chave)

    const agora = new Date().toISOString()
    const atualizado = await this.repositorio.usuarios.atualizar(usuario._id, { ultimoAcesso: agora })
    this.usuarioAtual = atualizado ?? usuario

    await this.limparSessoesPersistidas(usuario._id)
    if (manterConectado) await this.persistirSessao(usuario._id)

    return { sucesso: true }
  }

  async sair(): Promise<void> {
    if (this.sessaoPersistidaId) {
      await this.repositorio.sessoes.remover({ _id: this.sessaoPersistidaId })
      this.sessaoPersistidaId = null
    }
    this.usuarioAtual = null
  }

  /** Executado na abertura do app, para a opção "Manter conectado". */
  async retomarSessaoPersistida(): Promise<SessaoAtual> {
    const agora = Date.now()
    const sessoes = await this.repositorio.sessoes.buscar()

    for (const sessao of sessoes) {
      if (new Date(sessao.expiraEm).getTime() <= agora) {
        await this.repositorio.sessoes.remover({ _id: sessao._id })
        continue
      }

      const usuario = await this.repositorio.usuarios.buscarPorId(sessao.usuarioId)
      if (usuario && usuario.ativo) {
        this.usuarioAtual = usuario
        this.sessaoPersistidaId = sessao._id
        return this.sessaoAtual()
      }
      await this.repositorio.sessoes.remover({ _id: sessao._id })
    }

    return SESSAO_ANONIMA
  }

  /** Troca obrigatória no primeiro acesso, e também troca voluntária. */
  async definirSenha(
    senhaAtual: string,
    novaSenha: string,
    aceitouTermo: boolean
  ): Promise<ResultadoOperacao> {
    const usuario = this.usuarioAtual
    if (!usuario) return { sucesso: false, mensagem: 'Nenhuma sessão ativa.' }

    if (!(await conferirSenha(senhaAtual, usuario.senhaHash))) {
      return { sucesso: false, mensagem: 'A senha atual está incorreta.' }
    }

    const valida = validarSenha(novaSenha)
    if (!valida.valido) return { sucesso: false, mensagem: valida.mensagem }

    if (await conferirSenha(novaSenha, usuario.senhaHash)) {
      return { sucesso: false, mensagem: 'A nova senha precisa ser diferente da atual.' }
    }

    if (usuario.primeiroAcesso && !aceitouTermo) {
      return { sucesso: false, mensagem: 'É necessário aceitar o termo de tratamento de dados.' }
    }

    const atualizado = await this.repositorio.usuarios.atualizar(usuario._id, {
      senhaHash: await gerarHash(novaSenha),
      primeiroAcesso: false,
      termoAceitoEm: usuario.termoAceitoEm ?? new Date().toISOString()
    })

    if (atualizado) this.usuarioAtual = atualizado
    return { sucesso: true }
  }

  /** Recarrega o usuário em sessão após alteração feita por outro caminho. */
  async recarregarSessao(): Promise<void> {
    if (!this.usuarioAtual) return
    const atual = await this.repositorio.usuarios.buscarPorId(this.usuarioAtual._id)
    this.usuarioAtual = atual && atual.ativo ? atual : null
  }

  exigirAutenticado(): Usuario {
    if (!this.usuarioAtual) throw new Error('Operação exige usuário autenticado.')
    return this.usuarioAtual
  }

  exigirPerfil(perfis: PerfilUsuario[]): Usuario {
    const usuario = this.exigirAutenticado()
    if (!perfis.includes(usuario.perfil)) {
      throw new Error('Seu perfil não permite esta operação.')
    }
    return usuario
  }

  private registrarFalha(chave: string): void {
    const atual = this.tentativas.get(chave) ?? { falhas: 0, bloqueadoAte: 0 }
    atual.falhas += 1
    if (atual.falhas >= TENTATIVAS_ATE_BLOQUEIO) {
      atual.bloqueadoAte = Date.now() + BLOQUEIO_MS
      atual.falhas = 0
    }
    this.tentativas.set(chave, atual)
  }

  private async persistirSessao(usuarioId: string): Promise<void> {
    const expiraEm = new Date(Date.now() + DIAS_SESSAO_LEMBRADA * 86_400_000).toISOString()
    const sessao = await this.repositorio.sessoes.inserir({
      _id: randomUUID(),
      usuarioId,
      criadaEm: new Date().toISOString(),
      expiraEm
    })
    this.sessaoPersistidaId = sessao._id
  }

  private async limparSessoesPersistidas(usuarioId: string): Promise<void> {
    await this.repositorio.sessoes.remover({ usuarioId })
    this.sessaoPersistidaId = null
  }

  private validarDadosCadastro(dados: {
    nomeCompleto: string
    cpf: string
    dataNascimento: string
    login: string
  }): string | null {
    const checagens = [
      validarNomeCompleto(dados.nomeCompleto),
      validarCpf(dados.cpf),
      validarDataNascimento(dados.dataNascimento),
      validarLogin(dados.login)
    ]
    const falha = checagens.find((checagem) => !checagem.valido)
    return falha?.mensagem ?? null
  }
}
