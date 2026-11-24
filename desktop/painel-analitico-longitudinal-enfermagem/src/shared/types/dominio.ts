/**
 * Modelo canônico de dados.
 *
 * Nada aqui pode ser específico de um curso: número de questões, temas,
 * componentes e faixas de nota são configuração, nunca tipo fixo.
 */

export type Identificador = string

/**
 * Os três níveis definidos com o curso de Enfermagem.
 *
 * `administrador` é a chefia do departamento e quem administra o painel;
 * `coordenador` responde por um campus — vê e alimenta os cursos do próprio
 * escopo; `professor` acompanha, sem alterar nada.
 */
export type PerfilUsuario = 'professor' | 'coordenador' | 'administrador'

export type StatusAplicacao = 'concluida' | 'concluida_com_avisos' | 'revertida'

export interface Componente {
  nome: string
  questaoInicial: number
  questaoFinal: number
}

export interface FaixaRegua {
  /** Rótulo do período tal como o curso o nomeia, ex.: "6º". */
  periodo: string
  notaBase: number
  percentualMinimo: number
}

export interface PerfilImportacao {
  linhaCabecalho: number
  /**
   * Linha que traz o código de matrícula sob a coluna de cada discente.
   *
   * Nulo enquanto a planilha não trouxer matrícula — foi o pedido feito à
   * coordenação, e até ele chegar o reencontro continua por nome.
   */
  linhaMatricula: number | null
  colunaQuestao: string
  colunaGabarito: string
  colunaTema: string
  colunaDocente: string
  primeiraColunaAluno: string
  marcadorAcerto: string
  linhaTotal: number | null
}

/** Faixa ampla de conteúdo que agrupa vários temas da planilha. */
export interface AreaConhecimento {
  nome: string
  temas: string[]
}

export interface EstruturaAvaliacao {
  totalQuestoes: number
  periodos: string[]
  componentes: Componente[]
}

export interface Curso {
  _id: Identificador
  nome: string
  sigla: string
  instituicao: string
  /**
   * Campus onde o curso é oferecido, ex.: "Coração Eucarístico", "Betim".
   *
   * O mesmo curso existe em mais de um campus e aplica a mesma prova; é por
   * campus que a coordenação responde. Vazio enquanto não informado.
   */
  campus: string
  /** Departamento ao qual o curso pertence, ex.: "Enfermagem". */
  departamento: string
  nomeInstrumento: string
  estrutura: EstruturaAvaliacao
  /** Agrupamento dos temas da planilha; vazio enquanto não for cadastrado. */
  areas: AreaConhecimento[]
  regua: FaixaRegua[]
  perfilImportacao: PerfilImportacao
  criadoEm: string
  atualizadoEm: string
}

export interface Aplicacao {
  _id: Identificador
  cursoId: Identificador
  /** Rótulo visível, ex.: "2025/1". */
  rotulo: string
  semestre: number
  ano: number
  dataImportacao: string
  importadoPor: Identificador
  arquivoOriginal: string
  hashArquivo: string
  periodos: string[]
  totalDiscentes: number
  totalRegistros: number
  status: StatusAplicacao
}

export interface Discente {
  _id: Identificador
  cursoId: Identificador
  nomeCompleto: string
  /**
   * Código de matrícula, estável da entrada à conclusão do curso.
   *
   * É a única chave confiável para reencontrar a mesma pessoa entre semestres:
   * o nome não distingue homônimos e muda de grafia. Nulo nas importações
   * feitas antes de a planilha passar a trazê-lo.
   */
  matricula: string | null
  /** Estável entre aplicações: é ele que sustenta a série longitudinal. */
  pseudonimo: string
  ativo: boolean
  criadoEm: string
}

export interface Questao {
  _id: Identificador
  cursoId: Identificador
  aplicacaoId: Identificador
  numero: number
  gabarito: string
  tema: string
  docenteResponsavel: string
  componente: string
}

/** Coleção de fatos. Um documento por discente por questão. */
export interface Desempenho {
  _id: Identificador
  cursoId: Identificador
  aplicacaoId: Identificador
  discenteId: Identificador
  periodo: string
  questaoId: Identificador
  numeroQuestao: number
  tema: string
  componente: string
  acerto: boolean
}

export interface Usuario {
  _id: Identificador
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  login: string
  senhaHash: string
  perfil: PerfilUsuario
  /**
   * Cursos que este usuário enxerga. Vazio significa todos — é o caso da
   * chefia de departamento e o de uma instalação com um curso só.
   */
  cursosPermitidos: Identificador[]
  ativo: boolean
  primeiroAcesso: boolean
  ultimoAcesso: string | null
  termoAceitoEm: string | null
  criadoEm: string
}

/** Sessão persistida pela opção "Manter conectado". */
export interface Sessao {
  _id: Identificador
  usuarioId: Identificador
  criadaEm: string
  expiraEm: string
}

export interface SolicitacaoSenha {
  _id: Identificador
  login: string
  solicitadoEm: string
  atendidoEm: string | null
  atendidoPor: Identificador | null
}

export type SeveridadeOcorrencia = 'bloqueante' | 'atencao' | 'informativa'

export interface OcorrenciaImportacao {
  severidade: SeveridadeOcorrencia
  codigo: string
  mensagem: string
  detalhes?: string[]
}

export interface LogImportacao {
  _id: Identificador
  aplicacaoId: Identificador | null
  cursoId: Identificador
  arquivoOriginal: string
  hashArquivo: string
  executadoPor: Identificador
  executadoEm: string
  ocorrencias: OcorrenciaImportacao[]
  concluida: boolean
}
