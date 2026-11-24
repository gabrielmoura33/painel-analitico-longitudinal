import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROTEIRO_JORNADA, passosAplicaveis } from '../src/shared/jornada'

/**
 * A jornada guiada acende elementos das telas por `data-tour`. Um atributo
 * renomeado não quebra compilação nem teste de tela — só deixa o passo sem
 * destaque, silenciosamente. Este teste amarra roteiro e telas.
 */

const RAIZ = resolve(import.meta.dirname, '..')

/** Onde cada rota do roteiro é construída. */
const ARQUIVO_DA_ROTA: Record<string, string> = {
  '/guia': 'src/renderer/src/componentes/topbar.ts',
  '/visao-geral': 'src/renderer/src/telas/visao-geral.ts',
  '/analises/turma': 'src/renderer/src/telas/turma.ts',
  '/analises/areas': 'src/renderer/src/telas/areas.ts',
  '/analises/questoes': 'src/renderer/src/telas/questoes.ts',
  '/analises/docentes': 'src/renderer/src/telas/docentes.ts',
  '/analises/discente': 'src/renderer/src/telas/discente.ts',
  '/importacoes': 'src/renderer/src/telas/importacao.ts',
  '/admin/historico': 'src/renderer/src/telas/historico.ts',
  '/admin/cursos': 'src/renderer/src/telas/cursos-lista.ts',
  '/admin/usuarios': 'src/renderer/src/telas/usuarios-lista.ts',
  '/sistema': 'src/renderer/src/telas/diagnostico.ts'
}

describe('jornada guiada', () => {
  it('cada passo com destaque aponta para um atributo que existe na tela', () => {
    for (const passo of ROTEIRO_JORNADA) {
      if (!passo.alvo) continue

      const nome = /\[data-tour="([^"]+)"\]/.exec(passo.alvo)?.[1]
      expect(nome, `seletor fora do padrão: ${passo.alvo}`).toBeDefined()

      const rota = passo.caminho
      expect(rota, `passo "${passo.titulo}" tem alvo mas não tem rota`).toBeDefined()

      const arquivo = ARQUIVO_DA_ROTA[rota as string]
      expect(arquivo, `rota sem arquivo mapeado: ${rota}`).toBeDefined()

      const fonte = readFileSync(resolve(RAIZ, arquivo as string), 'utf8')
      expect(
        fonte.includes(`dataset.tour = '${nome}'`),
        `o passo "${passo.titulo}" procura [data-tour="${nome}"], que não é marcado em ${arquivo}`
      ).toBe(true)
    }
  })

  it('todo passo tem título e explicação', () => {
    for (const passo of ROTEIRO_JORNADA) {
      expect(passo.titulo.length).toBeGreaterThan(5)
      expect(passo.texto.length).toBeGreaterThan(60)
    }
  })

  it('passos de rota administrativa só aparecem para administrador', () => {
    const administrativas = ['/importacoes', '/admin/cursos', '/admin/usuarios']
    for (const passo of ROTEIRO_JORNADA) {
      if (passo.caminho && administrativas.includes(passo.caminho)) {
        expect(passo.somenteAdmin, `passo "${passo.titulo}" precisa de somenteAdmin`).toBe(true)
      }
    }
  })

  it('o roteiro encurta conforme o perfil e o que já foi importado', () => {
    const admin = passosAplicaveis({ ehAdmin: true, possuiAplicacoes: true }).length
    const professor = passosAplicaveis({ ehAdmin: false, possuiAplicacoes: true }).length
    const painelVazio = passosAplicaveis({ ehAdmin: true, possuiAplicacoes: false }).length

    expect(admin).toBe(ROTEIRO_JORNADA.length)
    expect(professor).toBeLessThan(admin)
    expect(painelVazio).toBeLessThan(admin)
    // Mesmo sem nada importado, sobra o essencial: barra, menu, importação, guia.
    expect(painelVazio).toBeGreaterThan(5)
  })
})
