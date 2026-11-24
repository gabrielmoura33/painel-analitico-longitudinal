export const NOME_APLICACAO = 'Painel Analítico Longitudinal'

export const JANELA = {
  larguraInicial: 1440,
  alturaInicial: 900,
  larguraMinima: 1280,
  alturaMinima: 800
} as const

export const PERFIS = {
  professor: 'Professor',
  coordenador: 'Coordenação de campus',
  administrador: 'Administrador'
} as const

/** O que cada perfil pode, em uma linha, para as telas de cadastro. */
export const DESCRICAO_PERFIS = {
  professor: 'Acompanha os painéis dos cursos do seu escopo. Não altera nada.',
  coordenador: 'Acompanha e importa planilhas dos cursos do seu escopo.',
  administrador: 'Administra cursos, usuários e todos os campi do departamento.'
} as const

/**
 * Régua oficial do Teste de Progresso de Enfermagem, conforme o PDF de
 * critérios. Serve apenas como valor inicial sugerido ao cadastrar um curso:
 * a régua real vive em `Curso.regua` e é editável.
 */
export const REGUA_SUGERIDA = [
  { periodo: '6º', notaBase: 5, percentualMinimo: 50 },
  { periodo: '7º', notaBase: 4, percentualMinimo: 40 },
  { periodo: '8º', notaBase: 3, percentualMinimo: 30 },
  { periodo: '9º', notaBase: 2, percentualMinimo: 20 },
  { periodo: '10º', notaBase: 1, percentualMinimo: 10 }
] as const

/**
 * Perfil de importação inicial sugerido ao cadastrar um curso.
 *
 * Os valores vêm da estrutura observada na amostra do Teste de Progresso de
 * Enfermagem. São apenas ponto de partida editável: o perfil real vive no
 * cadastro do curso, e é ele que permite atender outro curso sem tocar no
 * código.
 */
export const PERFIL_IMPORTACAO_SUGERIDO = {
  linhaCabecalho: 3,
  linhaMatricula: null,
  colunaQuestao: 'A',
  colunaGabarito: 'B',
  colunaTema: 'C',
  colunaDocente: 'D',
  primeiraColunaAluno: 'E',
  marcadorAcerto: '1',
  linhaTotal: 39
} as const

/** Componentes sugeridos, conforme a amostra: questões 1 a 8 e 9 a 35. */
export const COMPONENTES_SUGERIDOS = [
  { nome: 'Componente Geral', questaoInicial: 1, questaoFinal: 8 },
  { nome: 'Componente Específico', questaoInicial: 9, questaoFinal: 35 }
] as const
