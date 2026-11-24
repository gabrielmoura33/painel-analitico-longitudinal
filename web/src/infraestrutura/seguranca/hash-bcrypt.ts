import { randomInt } from 'node:crypto'

import bcrypt from 'bcryptjs'

import type { HashDeSenha } from '@/dominio/portas/hash-de-senha'

/**
 * Hash de senha com bcrypt.
 *
 * O custo é deliberadamente alto: é o que torna caro testar senhas em massa
 * contra a base. Dez rodadas é o ponto em que a conferência ainda cabe no
 * tempo de uma requisição.
 */
export class HashBcrypt implements HashDeSenha {
  private static readonly RODADAS = 10

  public gerar(senha: string): Promise<string> {
    return bcrypt.hash(senha, HashBcrypt.RODADAS)
  }

  public conferir(senha: string, hash: string): Promise<boolean> {
    return bcrypt.compare(senha, hash)
  }
}

/**
 * Gerador de senha inicial.
 *
 * Sem caracteres ambíguos: a senha é lida em voz alta ou copiada de uma tela
 * para um papel, e "l" contra "1" vira chamado de suporte. `randomInt` do
 * módulo de criptografia, e não `Math.random`, porque esta senha é a única
 * barreira da conta até o primeiro acesso.
 */
export class GeradorDeSenhaInicial {
  private static readonly ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  private static readonly TAMANHO = 10

  public gerar(): string {
    let senha = ''
    while (senha.length < GeradorDeSenhaInicial.TAMANHO) {
      senha += GeradorDeSenhaInicial.ALFABETO[randomInt(GeradorDeSenhaInicial.ALFABETO.length)]
    }
    return senha
  }
}
