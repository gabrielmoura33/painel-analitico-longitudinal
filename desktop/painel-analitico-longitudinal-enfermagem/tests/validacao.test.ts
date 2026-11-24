import { describe, expect, it } from 'vitest'

import {
  formatarCpf,
  normalizarLogin,
  validarCpf,
  validarDataNascimento,
  validarLogin,
  validarNomeCompleto,
  validarSenha
} from '../src/shared/validacao'

describe('validarCpf', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(validarCpf('529.982.247-25').valido).toBe(true)
    expect(validarCpf('52998224725').valido).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(validarCpf('529.982.247-26').valido).toBe(false)
  })

  it('rejeita sequência de dígitos repetidos', () => {
    expect(validarCpf('111.111.111-11').valido).toBe(false)
  })

  it('rejeita quantidade incorreta de dígitos', () => {
    expect(validarCpf('1234567890').valido).toBe(false)
  })
})

describe('formatarCpf', () => {
  it('formata conforme o usuário digita', () => {
    expect(formatarCpf('529')).toBe('529')
    expect(formatarCpf('529982')).toBe('529.982')
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
  })

  it('ignora o que passar de 11 dígitos', () => {
    expect(formatarCpf('529982247259999')).toBe('529.982.247-25')
  })
})

describe('validarSenha', () => {
  it('exige 8 caracteres, uma maiúscula e um número', () => {
    expect(validarSenha('Abcdef12').valido).toBe(true)
    expect(validarSenha('abcdef12').valido).toBe(false)
    expect(validarSenha('Abcdefgh').valido).toBe(false)
    expect(validarSenha('Abc12').valido).toBe(false)
  })
})

describe('validarLogin', () => {
  it('aceita letras, números, ponto, hífen e sublinhado', () => {
    expect(validarLogin('maria.silva').valido).toBe(true)
    expect(validarLogin('maria_silva-2').valido).toBe(true)
  })

  it('rejeita espaços e tamanho insuficiente', () => {
    expect(validarLogin('maria silva').valido).toBe(false)
    expect(validarLogin('ma').valido).toBe(false)
  })
})

describe('validarNomeCompleto e validarDataNascimento', () => {
  it('exige nome com sobrenome', () => {
    expect(validarNomeCompleto('Maria da Silva').valido).toBe(true)
    expect(validarNomeCompleto('Maria').valido).toBe(false)
  })

  it('rejeita data futura ou malformada', () => {
    expect(validarDataNascimento('1990-05-20').valido).toBe(true)
    expect(validarDataNascimento('2990-05-20').valido).toBe(false)
    expect(validarDataNascimento('20/05/1990').valido).toBe(false)
  })
})

describe('normalizarLogin', () => {
  it('reduz a minúsculas e remove espaços nas pontas', () => {
    expect(normalizarLogin('  Maria.Silva ')).toBe('maria.silva')
  })
})
