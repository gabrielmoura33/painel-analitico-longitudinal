import { randomUUID } from 'node:crypto'

import type { Usuario } from '@/dominio/modelos/dominio'
import type { ResultadoOperacao, SessaoAtual } from '@/dominio/modelos/resultado'
import { SESSAO_ANONIMA } from '@/dominio/modelos/resultado'
import type { HashDeSenha } from '@/dominio/portas/hash-de-senha'
import type { Relogio } from '@/dominio/portas/relogio'
import type { Repositorio } from '@/dominio/portas/repositorio'
import { Validacao } from '@/dominio/regras/validacao'

export interface DadosPrimeiroAdministrador {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  login: string
  senha: string
  aceitouTermo: boolean
}

/** Entrada bem-sucedida: a camada HTTP recebe o identificador para o cookie. */
export interface ResultadoEntrada extends ResultadoOperacao {
  sessaoId?: string
  /** Em dias; zero significa cookie de sessão, que morre ao fechar o navegador. */
  duracaoEmDias?: number
}

interface Tentativas {
  falhas: number
  bloqueadoAte: number
}

/**
 * Freio de força bruta, em memória do processo.
 *
 * Limitação conhecida e deliberada: com mais de uma instância do servidor, o
 * atacante ganha um balde de tentativas por instância, e uma reinicialização
 * zera a contagem. O freio de verdade pertence à borda — limite de taxa no
 * proxy reverso. Este aqui encarece o ataque trivial sem depender de nada
 * externo estar configurado, e é o que a aplicação consegue garantir sozinha.
 */
export class ControleDeTentativas {
  private static readonly TENTATIVAS_ATE_BLOQUEIO = 5
  private static readonly BLOQUEIO_MS = 60_000

  private readonly porLogin = new Map<string, Tentativas>()

  public segundosDeBloqueio(login: string, agora: number): number {
    const registro = this.porLogin.get(login)
    if (!registro || registro.bloqueadoAte <= agora) return 0
    return Math.ceil((registro.bloqueadoAte - agora) / 1000)
  }

  public registrarFalha(login: string, agora: number): void {
    const atual = this.porLogin.get(login) ?? { falhas: 0, bloqueadoAte: 0 }
    atual.falhas += 1
    if (atual.falhas >= ControleDeTentativas.TENTATIVAS_ATE_BLOQUEIO) {
      atual.bloqueadoAte = agora + ControleDeTentativas.BLOQUEIO_MS
      atual.falhas = 0
    }
    this.porLogin.set(login, atual)
  }

  public limpar(login: string): void {
    this.porLogin.delete(login)
  }
}

/**
 * Autenticação.
 *
 * Esta é a única parte do sistema que não foi portada, e sim redesenhada. No
 * Electron o serviço guardava o usuário em sessão num campo da própria
 * instância, porque havia um processo e uma pessoa. Num servidor web isso
 * seria o mesmo que logar todo mundo como a última pessoa que entrou: a
 * sessão passa a viver no banco, identificada por um cookie, e é resolvida a
 * cada requisição.
 */
export class CasoDeUsoAutenticacao {
  /** Hash de descarte, para gastar o mesmo tempo quando o login não existe. */
  private static readonly HASH_INEXISTENTE =
    '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'

  public constructor(
    private readonly repositorio: Repositorio,
    private readonly hash: HashDeSenha,
    private readonly relogio: Relogio,
    private readonly tentativas: ControleDeTentativas,
    private readonly diasDeSessao: number
  ) {}

  public async precisaConfiguracaoInicial(): Promise<boolean> {
    return (await this.repositorio.usuarios.contar()) === 0
  }

  /**
   * Primeira execução: em vez de nascer com um administrador e uma senha
   * padrão — que ficaria valendo para sempre em toda instalação —, o sistema
   * pede que o primeiro administrador seja criado na hora, com senha própria.
   */
  public async criarPrimeiroAdministrador(
    dados: DadosPrimeiroAdministrador
  ): Promise<ResultadoEntrada> {
    if (!(await this.precisaConfiguracaoInicial())) {
      return { sucesso: false, mensagem: 'Já existe usuário cadastrado nesta instalação.' }
    }

    const problema = Validacao.primeiraFalha([
      Validacao.nomeCompleto(dados.nomeCompleto),
      Validacao.cpf(dados.cpf),
      Validacao.dataNascimento(dados.dataNascimento),
      Validacao.login(dados.login),
      Validacao.senha(dados.senha)
    ])
    if (problema) return { sucesso: false, mensagem: problema }

    if (!dados.aceitouTermo) {
      return { sucesso: false, mensagem: 'É necessário aceitar o termo de tratamento de dados.' }
    }

    const agora = this.relogio.agoraEmTexto()
    const usuario = await this.repositorio.usuarios.inserir({
      nomeCompleto: dados.nomeCompleto.trim().replace(/\s+/g, ' '),
      cpf: Validacao.somenteDigitos(dados.cpf),
      dataNascimento: dados.dataNascimento,
      login: Validacao.normalizarLogin(dados.login),
      senhaHash: await this.hash.gerar(dados.senha),
      perfil: 'administrador',
      // Quem instala responde pelo departamento inteiro: escopo vazio é "todos".
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: false,
      ultimoAcesso: agora,
      termoAceitoEm: agora,
      criadoEm: agora
    })

    const sessaoId = await this.abrirSessao(usuario._id)
    return { sucesso: true, sessaoId, duracaoEmDias: 0 }
  }

  public async entrar(
    login: string,
    senha: string,
    manterConectado: boolean
  ): Promise<ResultadoEntrada> {
    const chave = Validacao.normalizarLogin(login)
    const agora = this.relogio.agora().getTime()

    const bloqueio = this.tentativas.segundosDeBloqueio(chave, agora)
    if (bloqueio > 0) {
      return {
        sucesso: false,
        mensagem: `Muitas tentativas. Tente novamente em ${bloqueio} segundos.`
      }
    }

    const usuario = await this.repositorio.usuarios.buscarUm({ login: chave })
    /*
     * Confere a senha mesmo sem usuário: sem isso, a resposta para um login
     * inexistente volta num tempo visivelmente menor, e esse tempo diz ao
     * atacante quais logins existem.
     */
    const senhaConfere = await this.hash.conferir(
      senha,
      usuario?.senhaHash ?? CasoDeUsoAutenticacao.HASH_INEXISTENTE
    )

    if (!usuario || !senhaConfere) {
      this.tentativas.registrarFalha(chave, agora)
      // Mensagem única: não revela se o login existe.
      return { sucesso: false, mensagem: 'Usuário ou senha incorretos.' }
    }

    if (!usuario.ativo) {
      return { sucesso: false, mensagem: 'Este usuário está desativado. Procure o administrador.' }
    }

    this.tentativas.limpar(chave)
    await this.repositorio.usuarios.atualizar(usuario._id, {
      ultimoAcesso: this.relogio.agoraEmTexto()
    })

    const sessaoId = await this.abrirSessao(usuario._id)
    return { sucesso: true, sessaoId, duracaoEmDias: manterConectado ? this.diasDeSessao : 0 }
  }

  public async sair(sessaoId: string | null): Promise<void> {
    if (!sessaoId) return
    await this.repositorio.sessoes.remover({ _id: sessaoId })
  }

  /**
   * Resolve o usuário a partir do identificador guardado no cookie.
   *
   * Diferente da versão desktop, que varria todas as sessões gravadas: aqui a
   * busca é direta pelo identificador, porque num servidor a varredura cresce
   * com o número de pessoas conectadas.
   */
  public async usuarioDaSessao(sessaoId: string | null): Promise<Usuario | null> {
    if (!sessaoId) return null

    const sessao = await this.repositorio.sessoes.buscarPorId(sessaoId)
    if (!sessao) return null

    if (new Date(sessao.expiraEm).getTime() <= this.relogio.agora().getTime()) {
      await this.repositorio.sessoes.remover({ _id: sessao._id })
      return null
    }

    const usuario = await this.repositorio.usuarios.buscarPorId(sessao.usuarioId)
    if (!usuario || !usuario.ativo) {
      // Usuário desativado enquanto estava conectado: a sessão morre junto.
      await this.repositorio.sessoes.remover({ _id: sessao._id })
      return null
    }
    return usuario
  }

  public static descrever(usuario: Usuario | null): SessaoAtual {
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

  /** Troca obrigatória no primeiro acesso, e também troca voluntária. */
  public async definirSenha(
    usuario: Usuario,
    senhaAtual: string,
    novaSenha: string,
    aceitouTermo: boolean
  ): Promise<ResultadoOperacao> {
    if (!(await this.hash.conferir(senhaAtual, usuario.senhaHash))) {
      return { sucesso: false, mensagem: 'A senha atual está incorreta.' }
    }

    const valida = Validacao.senha(novaSenha)
    if (!valida.valido) return { sucesso: false, mensagem: valida.mensagem }

    if (await this.hash.conferir(novaSenha, usuario.senhaHash)) {
      return { sucesso: false, mensagem: 'A nova senha precisa ser diferente da atual.' }
    }

    if (usuario.primeiroAcesso && !aceitouTermo) {
      return { sucesso: false, mensagem: 'É necessário aceitar o termo de tratamento de dados.' }
    }

    await this.repositorio.usuarios.atualizar(usuario._id, {
      senhaHash: await this.hash.gerar(novaSenha),
      primeiroAcesso: false,
      termoAceitoEm: usuario.termoAceitoEm ?? this.relogio.agoraEmTexto()
    })

    /*
     * Trocar a senha encerra as outras sessões daquela pessoa. Se a troca foi
     * porque a senha vazou, deixar as sessões antigas vivas manteria o
     * invasor conectado exatamente depois da providência tomada contra ele.
     */
    await this.repositorio.sessoes.remover({ usuarioId: usuario._id })
    return { sucesso: true }
  }

  private async abrirSessao(usuarioId: string): Promise<string> {
    const agora = this.relogio.agora()
    const expiraEm = new Date(agora.getTime() + this.diasDeSessao * 86_400_000)

    const sessao = await this.repositorio.sessoes.inserir({
      _id: randomUUID(),
      usuarioId,
      criadaEm: agora.toISOString(),
      expiraEm: expiraEm.toISOString()
    })
    return sessao._id
  }
}
