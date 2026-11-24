import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { CofreAes } from '@/infraestrutura/cripto/cofre-aes'

const cofre = new CofreAes(randomBytes(32), 'teste')

describe('cofre de campos sensíveis', () => {
  it('decifra o que cifrou', () => {
    const original = 'Patrícia Sarsur'
    expect(cofre.decifrar(cofre.cifrar(original, 'aleatorio'))).toBe(original)
  })

  it('o modo aleatório produz criptogramas diferentes para o mesmo valor', () => {
    const a = cofre.cifrar('52998224725', 'aleatorio')
    const b = cofre.cifrar('52998224725', 'aleatorio')
    expect(a).not.toBe(b)
  })

  it('o modo determinista repete o criptograma, que é o que permite buscar', () => {
    const a = cofre.cifrar('52998224725', 'determinista')
    const b = cofre.cifrar('52998224725', 'determinista')
    expect(a).toBe(b)
    expect(cofre.decifrar(a)).toBe('52998224725')
  })

  it('texto em claro atravessa intacto, para não exigir migração de base', () => {
    expect(cofre.decifrar('nome gravado antes do cofre')).toBe('nome gravado antes do cofre')
  })

  it('não cifra duas vezes', () => {
    const uma = cofre.cifrar('Maria', 'aleatorio')
    expect(cofre.cifrar(uma, 'aleatorio')).toBe(uma)
  })

  it('devolve o criptograma, em vez de quebrar, quando a chave é outra', () => {
    const outro = new CofreAes(randomBytes(32), 'outra chave')
    const cifrado = cofre.cifrar('Maria', 'aleatorio')
    expect(outro.decifrar(cifrado)).toBe(cifrado)
  })

  it('recusa chave de tamanho errado', () => {
    expect(() => new CofreAes(randomBytes(16), 'curta')).toThrow()
  })

  it('exige a variável de ambiente, em vez de gerar chave por conta própria', () => {
    expect(() => CofreAes.apartirDoAmbiente(undefined)).toThrow(/PAINEL_CHAVE_DADOS/)
    expect(() => CofreAes.apartirDoAmbiente('curta demais')).toThrow(/PAINEL_CHAVE_DADOS/)
    expect(CofreAes.apartirDoAmbiente(randomBytes(32).toString('base64'))).toBeInstanceOf(CofreAes)
  })
})
