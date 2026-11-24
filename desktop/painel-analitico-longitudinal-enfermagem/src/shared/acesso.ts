import type { Identificador, PerfilUsuario } from './types/dominio'

/**
 * Regras de acesso do painel.
 *
 * Mora em `shared` porque as mesmas regras precisam valer nos dois lados: o
 * menu que o renderer desenha e a autorização que o processo principal impõe.
 * Esconder um item de menu é cortesia visual; o que decide é o main — mas as
 * duas decisões saem daqui, para que não divirjam.
 *
 * O desenho dos três perfis veio da reunião com as docentes de Enfermagem:
 * o departamento tem uma chefia, abaixo dela há uma coordenação por campus
 * (Coração Eucarístico, Betim e, no futuro, Poços de Caldas), e os professores
 * acompanham o desempenho sem alterar nada.
 */

export interface EscopoUsuario {
  perfil: PerfilUsuario
  /**
   * Cursos que esta pessoa enxerga. Vazio significa "todos" — é o caso da
   * chefia de departamento e o de uma instalação com um curso só.
   */
  cursosPermitidos: Identificador[]
}

export const PERFIS_VALIDOS: PerfilUsuario[] = ['professor', 'coordenador', 'administrador']

export function ehPerfilValido(valor: string | null): valor is PerfilUsuario {
  return valor !== null && (PERFIS_VALIDOS as string[]).includes(valor)
}

/**
 * Perfis que alcançam cada área protegida do painel.
 *
 * Fica aqui, e não só na tabela de rotas do renderer, porque é regra de
 * acesso: o menu lê daqui, os canais do processo principal leem daqui, e o
 * teste confere um lugar só.
 */
export const PERFIS_POR_AREA = {
  /** Importar planilha: administração do painel e coordenação de campus. */
  importacao: ['administrador', 'coordenador'] as PerfilUsuario[],
  /** Cadastro de cursos, de usuários e exclusão de aplicações. */
  administracao: ['administrador'] as PerfilUsuario[]
} as const

/** Administra o painel: cursos, usuários e exclusão de aplicações. */
export function podeAdministrar(perfil: PerfilUsuario): boolean {
  return perfil === 'administrador'
}

/** Importa planilha: a coordenação alimenta o próprio campus. */
export function podeImportar(perfil: PerfilUsuario): boolean {
  return perfil === 'administrador' || perfil === 'coordenador'
}

/** Vê todos os cursos, sem restrição de escopo. */
export function alcancaTodosOsCursos(escopo: EscopoUsuario): boolean {
  return escopo.perfil === 'administrador' || escopo.cursosPermitidos.length === 0
}

export function podeVerCurso(escopo: EscopoUsuario, cursoId: Identificador): boolean {
  return alcancaTodosOsCursos(escopo) || escopo.cursosPermitidos.includes(cursoId)
}

/** Filtra uma lista de cursos pelo escopo, preservando a ordem recebida. */
export function cursosVisiveis<T extends { _id: Identificador }>(
  escopo: EscopoUsuario,
  cursos: T[]
): T[] {
  if (alcancaTodosOsCursos(escopo)) return cursos
  return cursos.filter((curso) => escopo.cursosPermitidos.includes(curso._id))
}
