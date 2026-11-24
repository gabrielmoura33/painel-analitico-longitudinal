import { randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'

const CUSTO_HASH = 10

const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghijkmnopqrstuvwxyz'
const DIGITOS = '23456789'

export function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_HASH)
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

/**
 * Senha inicial entregue pelo administrador ao novo usuário.
 *
 * Sem caracteres ambíguos (O/0, l/1), porque ela costuma ser ditada ou
 * copiada à mão. Atende às regras de senha por construção.
 */
export function gerarSenhaInicial(): string {
  const alfabeto = MAIUSCULAS + MINUSCULAS + DIGITOS
  const obrigatorios = [
    MAIUSCULAS[randomInt(MAIUSCULAS.length)] as string,
    DIGITOS[randomInt(DIGITOS.length)] as string,
    MINUSCULAS[randomInt(MINUSCULAS.length)] as string
  ]

  const restantes = Array.from(
    { length: 7 },
    () => alfabeto[randomInt(alfabeto.length)] as string
  )

  const caracteres = [...obrigatorios, ...restantes]
  for (let i = caracteres.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const atual = caracteres[i] as string
    caracteres[i] = caracteres[j] as string
    caracteres[j] = atual
  }
  return caracteres.join('')
}
