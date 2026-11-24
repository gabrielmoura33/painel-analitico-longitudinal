import { PERFIS_POR_AREA } from '@compartilhado/acesso'
import type { PerfilUsuario } from '@compartilhado/types/dominio'

export interface Rota {
  caminho: string
  titulo: string
  /** Quando ausente, a rota vale para todos os perfis autenticados. */
  perfis?: PerfilUsuario[]
  /** Rotas analíticas ficam indisponíveis enquanto não houver aplicação importada. */
  exigeAplicacao?: boolean
}

/** Rotas acessíveis sem sessão iniciada. */
export const ROTAS_PUBLICAS = ['/login', '/recuperar-senha'] as const

export const ROTAS: Rota[] = [
  { caminho: '/visao-geral', titulo: 'Visão geral', exigeAplicacao: true },
  { caminho: '/analises/discente', titulo: 'Discente', exigeAplicacao: true },
  { caminho: '/analises/turma', titulo: 'Turma', exigeAplicacao: true },
  { caminho: '/analises/areas', titulo: 'Áreas de conhecimento', exigeAplicacao: true },
  { caminho: '/analises/questoes', titulo: 'Questões', exigeAplicacao: true },
  { caminho: '/analises/docentes', titulo: 'Docentes responsáveis', exigeAplicacao: true },
  // Importar é da coordenação do campus também, não só de quem administra o painel.
  { caminho: '/importacoes', titulo: 'Importar planilha', perfis: PERFIS_POR_AREA.importacao },
  { caminho: '/admin/usuarios', titulo: 'Usuários', perfis: PERFIS_POR_AREA.administracao },
  {
    caminho: '/admin/usuarios/novo',
    titulo: 'Cadastro de novo usuário',
    perfis: PERFIS_POR_AREA.administracao
  },
  { caminho: '/admin/cursos', titulo: 'Cursos e réguas', perfis: PERFIS_POR_AREA.administracao },
  { caminho: '/admin/cursos/novo', titulo: 'Novo curso', perfis: PERFIS_POR_AREA.administracao },
  { caminho: '/admin/historico', titulo: 'Histórico de importações' },
  { caminho: '/guia', titulo: 'Guia de uso' },
  { caminho: '/sistema', titulo: 'Diagnóstico do sistema' }
]

export const ROTA_PADRAO = '/visao-geral'

/** Prefixo das rotas de edição de curso: /admin/cursos/<id>. */
export const PREFIXO_EDICAO_CURSO = '/admin/cursos/'

export function idDoCursoNaRota(caminho: string): string | null {
  if (!caminho.startsWith(PREFIXO_EDICAO_CURSO)) return null
  const resto = caminho.slice(PREFIXO_EDICAO_CURSO.length)
  return resto === '' || resto === 'novo' ? null : resto
}

export function rotaPorCaminho(caminho: string): Rota | undefined {
  const fixa = ROTAS.find((rota) => rota.caminho === caminho)
  if (fixa) return fixa

  // Edição de um curso: o identificador faz parte do caminho.
  if (idDoCursoNaRota(caminho)) {
    return { caminho, titulo: 'Editar curso', perfis: PERFIS_POR_AREA.administracao }
  }
  return undefined
}

export function caminhoAtual(): string {
  const bruto = window.location.hash.replace(/^#/, '')
  return bruto === '' ? ROTA_PADRAO : bruto
}

export function navegarPara(caminho: string): void {
  if (window.location.hash === `#${caminho}`) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = caminho
}

export function ehRotaPublica(caminho: string): boolean {
  return (ROTAS_PUBLICAS as readonly string[]).includes(caminho)
}

/** O perfil do usuário autoriza esta rota? */
export function perfilAutoriza(rota: Rota, perfil: PerfilUsuario | null): boolean {
  if (!rota.perfis) return true
  return perfil !== null && rota.perfis.includes(perfil)
}
