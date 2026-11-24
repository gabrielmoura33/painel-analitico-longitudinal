import type {
  Aplicacao,
  AreaConhecimento,
  Curso,
  EstruturaAvaliacao,
  FaixaRegua,
  PerfilImportacao,
  PerfilUsuario,
  SolicitacaoSenha
} from './dominio'
import type {
  ContextoPainel,
  DiscenteEncontrado,
  VisaoAreas,
  VisaoDiscente,
  VisaoDocentes,
  VisaoGeral,
  VisaoQuestoes,
  VisaoTurma
} from './indicadores'
import type {
  AnaliseImportacao,
  DecisoesImportacao,
  ItemHistorico,
  ResultadoImportacao
} from './importacao'
import type {
  ArquivoEscolhido,
  LeituraAreasPlanilha,
  LeituraReguaPlanilha,
  PreviaAba,
  ResumoAba
} from './planilha'

/**
 * Contrato entre renderer e main.
 *
 * Toda chamada atravessa o preload por `contextBridge`. O renderer nunca
 * conhece `ipcRenderer` nem módulos do Node.
 */

export interface InfoSistema {
  versaoAplicacao: string
  versaoElectron: string
  versaoNode: string
  plataforma: string
  driverPersistencia: string
  caminhoDados: string
  /** De onde veio a chave que cifra os campos sensíveis. */
  origemChaveDados: string
}

export interface SessaoAtual {
  autenticado: boolean
  usuarioId: string | null
  nome: string | null
  perfil: PerfilUsuario | null
  /** Cursos que esta sessão enxerga. Vazio significa todos. */
  cursosPermitidos: string[]
  /** Quando verdadeiro, o usuário é obrigado a definir uma nova senha. */
  primeiroAcesso: boolean
}

export interface EstadoInicial {
  sessao: SessaoAtual
  precisaConfiguracaoInicial: boolean
  possuiAplicacoes: boolean
  totalCursos: number
}

export interface ResultadoOperacao {
  sucesso: boolean
  mensagem?: string
}

/** Dados de usuário expostos à interface: sem hash de senha e sem CPF. */
export interface UsuarioResumo {
  _id: string
  nomeCompleto: string
  login: string
  perfil: PerfilUsuario
  cursosPermitidos: string[]
  ativo: boolean
  primeiroAcesso: boolean
  ultimoAcesso: string | null
  criadoEm: string
}

export interface NovoUsuario {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  login: string
  perfil: PerfilUsuario
  /** Cursos que o usuário poderá ver. Vazio significa todos. */
  cursosPermitidos: string[]
}

export interface FiltroUsuarios {
  busca?: string
  perfil?: PerfilUsuario
  ativo?: boolean
}

export type ResultadoCriacaoUsuario =
  | { sucesso: true; usuario: UsuarioResumo; senhaInicial: string }
  | { sucesso: false; mensagem: string }

export type ResultadoUsuario =
  | { sucesso: true; usuario: UsuarioResumo }
  | { sucesso: false; mensagem: string }

export interface DadosPrimeiroAdministrador {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  login: string
  senha: string
  aceitouTermo: boolean
}

/** Curso sem os campos que o sistema controla (identificador e datas). */
export interface DadosCurso {
  nome: string
  sigla: string
  instituicao: string
  campus: string
  departamento: string
  nomeInstrumento: string
  estrutura: EstruturaAvaliacao
  areas: AreaConhecimento[]
  regua: FaixaRegua[]
  perfilImportacao: PerfilImportacao
}

export type ResultadoCurso =
  | { sucesso: true; curso: Curso }
  | { sucesso: false; mensagem: string }

/** Mapa de canais: chave = canal, `entrada` = argumento, `saida` = retorno. */
export interface ContratoIpc {
  'sistema:info': { entrada: void; saida: InfoSistema }
  'sistema:estado-inicial': { entrada: void; saida: EstadoInicial }

  'sessao:atual': { entrada: void; saida: SessaoAtual }
  'sessao:entrar': {
    entrada: { login: string; senha: string; manterConectado: boolean }
    saida: ResultadoOperacao
  }
  'sessao:sair': { entrada: void; saida: void }
  'sessao:definir-senha': {
    entrada: { senhaAtual: string; novaSenha: string; aceitouTermo: boolean }
    saida: ResultadoOperacao
  }
  'sessao:criar-primeiro-administrador': {
    entrada: DadosPrimeiroAdministrador
    saida: ResultadoOperacao
  }
  'senha:solicitar-redefinicao': { entrada: { login: string }; saida: ResultadoOperacao }

  'usuario:listar': { entrada: FiltroUsuarios; saida: UsuarioResumo[] }
  'usuario:criar': { entrada: NovoUsuario; saida: ResultadoCriacaoUsuario }
  'usuario:redefinir-senha': { entrada: { usuarioId: string }; saida: ResultadoCriacaoUsuario }
  'usuario:alterar-situacao': {
    entrada: { usuarioId: string; ativo: boolean }
    saida: ResultadoUsuario
  }
  'usuario:alterar-perfil': {
    entrada: { usuarioId: string; perfil: PerfilUsuario }
    saida: ResultadoUsuario
  }
  'usuario:alterar-escopo': {
    entrada: { usuarioId: string; cursosPermitidos: string[] }
    saida: ResultadoUsuario
  }
  'usuario:solicitacoes-pendentes': { entrada: void; saida: SolicitacaoSenha[] }

  'curso:listar': { entrada: void; saida: Curso[] }
  'curso:obter': { entrada: { cursoId: string }; saida: Curso | null }
  'curso:criar': { entrada: DadosCurso; saida: ResultadoCurso }
  'curso:atualizar': { entrada: { cursoId: string; dados: DadosCurso }; saida: ResultadoCurso }
  'curso:remover': { entrada: { cursoId: string }; saida: ResultadoOperacao }
  'curso:modelo': { entrada: void; saida: DadosCurso }
  'curso:temas': { entrada: { cursoId: string }; saida: string[] }

  'arquivo:escolher-planilha': { entrada: void; saida: ArquivoEscolhido | null }
  'planilha:resumir': { entrada: { caminho: string }; saida: ResumoAba[] }
  'planilha:ler-regua': { entrada: { caminho: string }; saida: LeituraReguaPlanilha | null }
  'planilha:ler-areas': { entrada: { caminho: string }; saida: LeituraAreasPlanilha | null }
  'planilha:previsualizar': {
    entrada: { caminho: string; aba: string; perfil: PerfilImportacao }
    saida: PreviaAba | null
  }

  'importacao:analisar': {
    entrada: { caminho: string; cursoId: string; rotulo: string }
    saida: AnaliseImportacao | { erro: string }
  }
  'importacao:executar': { entrada: DecisoesImportacao; saida: ResultadoImportacao }
  'importacao:historico': { entrada: void; saida: ItemHistorico[] }
  'importacao:excluir': { entrada: { aplicacaoId: string }; saida: ResultadoOperacao }

  'painel:contexto': {
    entrada: { cursoId?: string; aplicacaoId?: string }
    saida: ContextoPainel
  }
  'painel:visao-geral': {
    entrada: { cursoId: string; aplicacaoId: string }
    saida: VisaoGeral | null
  }
  'painel:visao-turma': {
    entrada: { cursoId: string; aplicacaoId: string; periodo?: string }
    saida: VisaoTurma | null
  }

  'painel:visao-areas': {
    entrada: { cursoId: string; aplicacaoId: string }
    saida: VisaoAreas | null
  }
  'painel:visao-questoes': {
    entrada: { cursoId: string; aplicacaoId: string }
    saida: VisaoQuestoes | null
  }
  'painel:visao-docentes': {
    entrada: { cursoId: string; aplicacaoId: string }
    saida: VisaoDocentes | null
  }
  'painel:buscar-discentes': {
    entrada: { cursoId: string; termo: string }
    saida: DiscenteEncontrado[]
  }
  'painel:visao-discente': {
    entrada: { cursoId: string; discenteId: string }
    saida: VisaoDiscente | null
  }

  'aplicacao:listar': { entrada: { cursoId?: string }; saida: Aplicacao[] }
}

export type CanalIpc = keyof ContratoIpc

export type EntradaDe<C extends CanalIpc> = ContratoIpc[C]['entrada']
export type SaidaDe<C extends CanalIpc> = ContratoIpc[C]['saida']

/** Superfície exposta em `window.painel`. */
export interface ApiPainel {
  invocar<C extends CanalIpc>(canal: C, entrada: EntradaDe<C>): Promise<SaidaDe<C>>
  /** Caminho em disco de um arquivo arrastado para a janela ou escolhido num campo de arquivo. */
  caminhoDoArquivo(arquivo: File): string
}
