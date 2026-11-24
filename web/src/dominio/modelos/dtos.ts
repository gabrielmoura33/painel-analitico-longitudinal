import type {
  AreaConhecimento,
  Curso,
  EstruturaAvaliacao,
  FaixaRegua,
  PerfilImportacao,
  PerfilUsuario
} from '@/dominio/modelos/dominio'

/**
 * Objetos que atravessam a fronteira entre servidor e navegador.
 *
 * São deliberadamente diferentes das entidades: `UsuarioResumo` não tem
 * `senhaHash` nem `cpf` porque esses campos nunca devem sair do servidor, e a
 * forma de garantir isso é não existir um caminho em que eles caibam.
 */
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
