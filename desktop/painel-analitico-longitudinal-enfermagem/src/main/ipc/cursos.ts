import { dialog } from 'electron'

import type { ArquivoEscolhido } from '@compartilhado/types/planilha'
import { lerAreasDaPlanilha } from '../etl/areas'
import { abrirPlanilha, lerReguaDaPlanilha, previsualizarAba, resumirAbas } from '../etl/leitor'
import { deduzirRegua } from '../etl/notas'
import type { ServicoAutenticacao } from '../servicos/autenticacao'
import { cursoInicial, type ServicoCursos } from '../servicos/cursos'
import { escopoDe, exigirCurso, registrarProtegido } from './index'

const SOMENTE_ADMIN = ['administrador'] as const

export function registrarCanaisCursos(
  autenticacao: ServicoAutenticacao,
  cursos: ServicoCursos
): void {
  // A lista alimenta o filtro global; cada um recebe a sua, recortada pelo escopo.
  registrarProtegido('curso:listar', autenticacao, 'qualquer', (_entrada, usuario) =>
    cursos.listar(escopoDe(usuario))
  )

  registrarProtegido('curso:obter', autenticacao, 'qualquer', ({ cursoId }, usuario) => {
    exigirCurso(usuario, cursoId)
    return cursos.obter(cursoId)
  })

  registrarProtegido('curso:modelo', autenticacao, [...SOMENTE_ADMIN], () => cursoInicial())

  registrarProtegido('curso:temas', autenticacao, [...SOMENTE_ADMIN], ({ cursoId }) =>
    cursos.temasImportados(cursoId)
  )

  registrarProtegido('curso:criar', autenticacao, [...SOMENTE_ADMIN], (dados) =>
    cursos.criar(dados)
  )

  registrarProtegido('curso:atualizar', autenticacao, [...SOMENTE_ADMIN], ({ cursoId, dados }) =>
    cursos.atualizar(cursoId, dados)
  )

  registrarProtegido('curso:remover', autenticacao, [...SOMENTE_ADMIN], ({ cursoId }) =>
    cursos.remover(cursoId)
  )

  registrarProtegido(
    'arquivo:escolher-planilha',
    autenticacao,
    [...SOMENTE_ADMIN],
    async (): Promise<ArquivoEscolhido | null> => {
      const escolha = await dialog.showOpenDialog({
        title: 'Selecionar planilha',
        filters: [{ name: 'Planilha do Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      })

      const caminho = escolha.filePaths[0]
      if (escolha.canceled || !caminho) return null
      return { caminho, nome: caminho.split(/[\\/]/).pop() ?? caminho }
    }
  )

  registrarProtegido('planilha:resumir', autenticacao, [...SOMENTE_ADMIN], async ({ caminho }) => {
    const workbook = await abrirPlanilha(caminho)
    return resumirAbas(workbook)
  })

  // Planilha tema → área, que as docentes mantêm fora do sistema.
  registrarProtegido('planilha:ler-areas', autenticacao, [...SOMENTE_ADMIN], async ({ caminho }) => {
    const workbook = await abrirPlanilha(caminho)
    return lerAreasDaPlanilha(workbook)
  })

  registrarProtegido(
    'planilha:ler-regua',
    autenticacao,
    [...SOMENTE_ADMIN],
    async ({ caminho }) => {
      const workbook = await abrirPlanilha(caminho)
      const leitura = lerReguaDaPlanilha(workbook)
      if (!leitura) return null

      return {
        aba: leitura.aba,
        periodos: leitura.periodos.map((periodo) => ({
          rotuloPeriodo: periodo.rotuloPeriodo,
          totalPares: periodo.pares.length,
          deducao: deduzirRegua(periodo.pares)
        }))
      }
    }
  )

  registrarProtegido(
    'planilha:previsualizar',
    autenticacao,
    [...SOMENTE_ADMIN],
    async ({ caminho, aba, perfil }) => {
      const workbook = await abrirPlanilha(caminho)
      return previsualizarAba(workbook, aba, perfil)
    }
  )
}
