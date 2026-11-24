import 'server-only'

import { cookies } from 'next/headers'

import type { Usuario } from '@/dominio/modelos/dominio'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'

const NOME_COOKIE = 'painel_sessao'

/**
 * Sessão da requisição: o cookie de um lado, o usuário do outro.
 *
 * O cookie é `httpOnly`, de modo que nenhum script da página o lê — é a
 * defesa que sobra quando algum XSS passa. `sameSite: 'lax'` impede que um
 * site de terceiros dispare ações autenticadas no painel, e `secure` fica
 * ligado fora do desenvolvimento, onde o acesso é por HTTP simples.
 */
export class SessaoHttp {
  public static async identificador(): Promise<string | null> {
    const armazem = await cookies()
    return armazem.get(NOME_COOKIE)?.value ?? null
  }

  public static async gravar(sessaoId: string, duracaoEmDias: number): Promise<void> {
    const armazem = await cookies()
    armazem.set(NOME_COOKIE, sessaoId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      // Zero dias significa cookie de sessão: morre quando o navegador fecha.
      ...(duracaoEmDias > 0 ? { maxAge: duracaoEmDias * 86_400 } : {})
    })
  }

  public static async apagar(): Promise<void> {
    const armazem = await cookies()
    armazem.delete(NOME_COOKIE)
  }

  /** Usuário autenticado, ou nulo. Não lança: quem exige usa `exigirUsuario`. */
  public static async usuario(): Promise<Usuario | null> {
    const container = Container.paraRequisicao()
    return container.autenticacao().usuarioDaSessao(await SessaoHttp.identificador())
  }

  /**
   * Usuário autenticado ou erro.
   *
   * Toda rota protegida começa por aqui. A verificação é no servidor, sempre:
   * esconder um item de menu é cortesia visual, e não impede ninguém de
   * chamar a rota diretamente.
   */
  public static async exigirUsuario(): Promise<Usuario> {
    const usuario = await SessaoHttp.usuario()
    if (!usuario) throw new NaoAutenticado()
    return usuario
  }

  /** Escopo de acesso do usuário em sessão, pronto para filtrar consultas. */
  public static async exigirEscopo(): Promise<{ usuario: Usuario; escopo: EscopoDeAcesso }> {
    const usuario = await SessaoHttp.exigirUsuario()
    return {
      usuario,
      escopo: new EscopoDeAcesso(usuario.perfil, usuario.cursosPermitidos ?? [])
    }
  }
}

export class NaoAutenticado extends Error {
  public constructor() {
    super('Operação exige usuário autenticado.')
    this.name = 'NaoAutenticado'
  }
}
