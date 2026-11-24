import ExcelJS from 'exceljs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { carregar, type AbaParaCarga } from '../src/main/etl/carregador'
import { lerMatriz } from '../src/main/etl/leitor'
import { cursoInicial } from '../src/main/servicos/cursos'
import { PERFIL_IMPORTACAO_SUGERIDO } from '../src/shared/constants'
import type { Curso, PerfilImportacao } from '../src/shared/types/dominio'

/**
 * Planilha mínima no formato da amostra: discentes em colunas, uma linha de
 * matrícula logo acima da dos nomes.
 */
function planilhaComMatricula(matriculas: Array<string | null>): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const aba = workbook.addWorksheet('6º período')

  aba.getRow(1).values = ['Teste de Progresso']
  aba.getRow(2).values = ['', '', '', '', ...matriculas]
  aba.getRow(3).values = ['Questão', 'Gab', 'Tema', 'Docente', 'Ana', 'Bruno']
  aba.getRow(4).values = [1, 'A', 'Sepse', 'Meire', '1', '']
  aba.getRow(5).values = [2, 'B', 'Triagem', 'Meire', '', '1']

  return workbook
}

const PERFIL: PerfilImportacao = {
  ...PERFIL_IMPORTACAO_SUGERIDO,
  linhaCabecalho: 3,
  linhaMatricula: 2,
  linhaTotal: null
}

describe('leitura da matrícula', () => {
  it('lê uma matrícula por discente, na ordem das colunas', () => {
    const matriz = lerMatriz(planilhaComMatricula(['20231234', '20231235']), '6º período', PERFIL)

    expect(matriz?.discentes).toEqual(['Ana', 'Bruno'])
    expect(matriz?.matriculas).toEqual(['20231234', '20231235'])
  })

  it('avisa quem ficou sem matrícula, em vez de deslocar a lista', () => {
    const matriz = lerMatriz(planilhaComMatricula(['20231234', null]), '6º período', PERFIL)

    expect(matriz?.matriculas).toEqual(['20231234', ''])
    expect(matriz?.avisos.join(' ')).toContain('sem matrícula')
  })

  it('acusa matrícula repetida na mesma aba', () => {
    const matriz = lerMatriz(planilhaComMatricula(['20231234', '20231234']), '6º período', PERFIL)
    expect(matriz?.avisos.join(' ')).toContain('Matrícula repetida')
  })

  it('sem linha de matrícula no perfil, a lista sai vazia', () => {
    const matriz = lerMatriz(planilhaComMatricula(['20231234', '20231235']), '6º período', {
      ...PERFIL,
      linhaMatricula: null
    })
    expect(matriz?.matriculas).toEqual([])
  })
})

let pasta: string
let repositorio: RepositorioLocal
let curso: Curso

function abaDe(nomes: string[], matriculas: string[]): AbaParaCarga {
  return {
    nome: '6º período',
    periodo: '6º',
    matriz: {
      aba: '6º período',
      titulo: 'Teste de Progresso',
      discentes: nomes,
      matriculas,
      questoes: [
        { numero: 1, gabarito: 'A', tema: 'Sepse', docente: 'Meire', acertos: nomes.map(() => true) }
      ],
      avisos: []
    }
  }
}

async function importar(rotulo: string, aba: AbaParaCarga) {
  return carregar(repositorio, {
    curso,
    rotulo,
    arquivo: { caminho: '/tmp/x.xlsx', nome: 'x.xlsx', hash: rotulo },
    importadoPor: 'u1',
    abas: [aba],
    unificacoes: new Map(),
    ocorrencias: [],
    substituirAnterior: false
  })
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-matricula-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()

  const modelo = cursoInicial()
  curso = await repositorio.cursos.inserir({
    ...modelo,
    estrutura: { ...modelo.estrutura, totalQuestoes: 1 },
    nome: 'Enfermagem',
    sigla: 'ENF',
    criadoEm: 'x',
    atualizadoEm: 'x'
  })
})

afterEach(async () => {
  await repositorio.desconectar()
  rmSync(pasta, { recursive: true, force: true })
})

describe('reencontro entre semestres', () => {
  it('a matrícula distingue homônimos que o nome juntaria', async () => {
    const resumo = await importar('2025/2', abaDe(['Ana Silva', 'Ana Silva'], ['1001', '1002']))

    expect(resumo.discentesNovos).toBe(2)
    const discentes = await repositorio.discentes.buscar({ cursoId: curso._id })
    expect(discentes.map((discente) => discente.matricula).sort()).toEqual(['1001', '1002'])
  })

  it('a mesma matrícula reencontra a pessoa mesmo com o nome escrito de outro jeito', async () => {
    await importar('2025/2', abaDe(['Ana Silva'], ['1001']))
    const resumo = await importar('2026/1', abaDe(['ANA  SILVA DE SOUZA'], ['1001']))

    expect(resumo.discentesNovos).toBe(0)
    expect(resumo.discentesReencontrados).toBe(1)
    expect(await repositorio.discentes.contar({ cursoId: curso._id })).toBe(1)
  })

  it('sem matrícula, o reencontro continua pelo nome', async () => {
    await importar('2025/2', abaDe(['Ana Silva'], []))
    const resumo = await importar('2026/1', abaDe(['ana silva'], []))

    expect(resumo.discentesReencontrados).toBe(1)
    expect(resumo.discentesSemMatricula).toBe(1)
    expect(await repositorio.discentes.contar({ cursoId: curso._id })).toBe(1)
  })

  it('quem entrou sem matrícula recebe a dela na importação seguinte', async () => {
    await importar('2025/2', abaDe(['Ana Silva'], []))
    await importar('2026/1', abaDe(['Ana Silva'], ['1001']))

    const discentes = await repositorio.discentes.buscar({ cursoId: curso._id })
    expect(discentes).toHaveLength(1)
    expect(discentes[0]?.matricula).toBe('1001')
  })
})
