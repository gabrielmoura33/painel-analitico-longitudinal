import { describe, expect, it } from 'vitest'

import { AcessoNegado, EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'

const cursos = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]

describe('escopo de acesso', () => {
  it('escopo vazio significa todos os cursos', () => {
    const escopo = new EscopoDeAcesso('professor', [])
    expect(escopo.alcancaTodosOsCursos()).toBe(true)
    expect(escopo.cursosVisiveis(cursos)).toHaveLength(3)
  })

  it('administrador alcança tudo mesmo com escopo gravado', () => {
    const escopo = new EscopoDeAcesso('administrador', ['a'])
    expect(escopo.podeVerCurso('c')).toBe(true)
  })

  it('coordenador enxerga apenas os cursos do próprio escopo', () => {
    const escopo = new EscopoDeAcesso('coordenador', ['b'])
    expect(escopo.podeVerCurso('b')).toBe(true)
    expect(escopo.podeVerCurso('a')).toBe(false)
    expect(escopo.cursosVisiveis(cursos).map((curso) => curso._id)).toEqual(['b'])
  })

  it('exigirCurso levanta erro de autorização, não de validação', () => {
    const escopo = new EscopoDeAcesso('professor', ['a'])
    expect(() => escopo.exigirCurso('b')).toThrow(AcessoNegado)
    expect(() => escopo.exigirCurso('a')).not.toThrow()
  })

  it('só administrador administra; coordenador também importa', () => {
    expect(new EscopoDeAcesso('administrador', []).podeAdministrar()).toBe(true)
    expect(new EscopoDeAcesso('coordenador', []).podeAdministrar()).toBe(false)
    expect(new EscopoDeAcesso('coordenador', []).podeImportar()).toBe(true)
    expect(new EscopoDeAcesso('professor', []).podeImportar()).toBe(false)
  })

  it('reconhece os perfis válidos e recusa o resto', () => {
    expect(EscopoDeAcesso.ehPerfilValido('coordenador')).toBe(true)
    expect(EscopoDeAcesso.ehPerfilValido('chefe')).toBe(false)
    expect(EscopoDeAcesso.ehPerfilValido(null)).toBe(false)
  })
})
