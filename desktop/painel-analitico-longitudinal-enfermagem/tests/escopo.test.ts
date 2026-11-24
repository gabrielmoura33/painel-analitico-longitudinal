import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  PERFIS_POR_AREA,
  alcancaTodosOsCursos,
  cursosVisiveis,
  ehPerfilValido,
  podeAdministrar,
  podeImportar,
  podeVerCurso
} from '../src/shared/acesso'

const CURSOS = [{ _id: 'coreu' }, { _id: 'betim' }, { _id: 'pocos' }]

describe('perfis', () => {
  it('reconhece os três níveis definidos com o departamento', () => {
    expect(ehPerfilValido('professor')).toBe(true)
    expect(ehPerfilValido('coordenador')).toBe(true)
    expect(ehPerfilValido('administrador')).toBe(true)
    expect(ehPerfilValido('chefe')).toBe(false)
    expect(ehPerfilValido(null)).toBe(false)
  })

  it('só o administrador administra; a coordenação também importa', () => {
    expect(podeAdministrar('administrador')).toBe(true)
    expect(podeAdministrar('coordenador')).toBe(false)

    expect(podeImportar('coordenador')).toBe(true)
    expect(podeImportar('administrador')).toBe(true)
    expect(podeImportar('professor')).toBe(false)
  })
})

describe('escopo de cursos', () => {
  it('escopo vazio significa todos', () => {
    const escopo = { perfil: 'professor' as const, cursosPermitidos: [] }
    expect(alcancaTodosOsCursos(escopo)).toBe(true)
    expect(cursosVisiveis(escopo, CURSOS)).toHaveLength(3)
  })

  it('administrador alcança todos mesmo com escopo gravado', () => {
    const escopo = { perfil: 'administrador' as const, cursosPermitidos: ['betim'] }
    expect(podeVerCurso(escopo, 'coreu')).toBe(true)
    expect(cursosVisiveis(escopo, CURSOS)).toHaveLength(3)
  })

  it('coordenação de um campus não enxerga o outro', () => {
    const escopo = { perfil: 'coordenador' as const, cursosPermitidos: ['betim'] }
    expect(podeVerCurso(escopo, 'betim')).toBe(true)
    expect(podeVerCurso(escopo, 'coreu')).toBe(false)
    expect(cursosVisiveis(escopo, CURSOS).map((curso) => curso._id)).toEqual(['betim'])
  })
})

/*
 * A tabela de rotas vive no renderer, que compila com DOM e fora deste projeto
 * de tipos. O que importa conferir é que ela usa a regra compartilhada, em vez
 * de repetir a lista de perfis e poder divergir dela.
 */
describe('rotas por perfil', () => {
  const rotas = readFileSync(resolve(import.meta.dirname, '../src/renderer/src/rotas.ts'), 'utf8')

  it('importar planilha vale para administração e coordenação, não para professor', () => {
    expect(PERFIS_POR_AREA.importacao).toContain('administrador')
    expect(PERFIS_POR_AREA.importacao).toContain('coordenador')
    expect(PERFIS_POR_AREA.importacao).not.toContain('professor')
    expect(rotas).toContain("caminho: '/importacoes', titulo: 'Importar planilha', perfis: PERFIS_POR_AREA.importacao")
  })

  it('cadastro de usuários e de cursos continua só do administrador', () => {
    expect(PERFIS_POR_AREA.administracao).toEqual(['administrador'])
    for (const caminho of ['/admin/usuarios', '/admin/cursos', '/admin/cursos/novo']) {
      const trecho = rotas.slice(rotas.indexOf(`caminho: '${caminho}'`))
      expect(trecho.slice(0, 200)).toContain('PERFIS_POR_AREA.administracao')
    }
  })

  it('as telas analíticas não restringem perfil', () => {
    for (const caminho of ['/analises/turma', '/analises/areas', '/analises/discente']) {
      const trecho = rotas.slice(rotas.indexOf(`caminho: '${caminho}'`))
      const linha = trecho.slice(0, trecho.indexOf('\n'))
      expect(linha).not.toContain('perfis')
    }
  })
})
