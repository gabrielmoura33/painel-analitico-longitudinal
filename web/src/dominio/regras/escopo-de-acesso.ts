import type { Identificador, PerfilUsuario } from '@/dominio/modelos/dominio'

/**
 * Regras de acesso do painel, reunidas num objeto de valor.
 *
 * O desenho dos três perfis veio da reunião com as docentes de Enfermagem: o
 * departamento tem uma chefia, abaixo dela há uma coordenação por campus
 * (Coração Eucarístico, Betim e, no futuro, Poços de Caldas), e os professores
 * acompanham o desempenho sem alterar nada.
 *
 * Na versão desktop estas regras eram funções soltas que o renderer e o
 * processo principal importavam. Aqui são um objeto porque o escopo passou a
 * viajar: ele nasce da sessão, atravessa os casos de uso e decide cada
 * consulta. Um tipo próprio impede que alguém passe um `perfil` sem a lista de
 * cursos e autorize demais sem perceber.
 */
export class EscopoDeAcesso {
  public static readonly PERFIS_VALIDOS: readonly PerfilUsuario[] = [
    'professor',
    'coordenador',
    'administrador'
  ]

  /**
   * Perfis que alcançam cada área protegida.
   *
   * Fica aqui, e não na tabela de rotas da interface, porque é regra de
   * acesso: o menu lê daqui, as rotas de API leem daqui, e o teste confere um
   * lugar só. Esconder um item de menu é cortesia visual; o que decide é o
   * servidor — mas as duas decisões saem do mesmo ponto, para que não
   * divirjam.
   */
  public static readonly PERFIS_POR_AREA = {
    /** Importar planilha: administração do painel e coordenação de campus. */
    importacao: ['administrador', 'coordenador'] as readonly PerfilUsuario[],
    /** Cadastro de cursos, de usuários e exclusão de aplicações. */
    administracao: ['administrador'] as readonly PerfilUsuario[]
  } as const

  public constructor(
    public readonly perfil: PerfilUsuario,
    /**
     * Cursos que esta pessoa enxerga. Vazio significa "todos" — é o caso da
     * chefia de departamento e o de uma instalação com um curso só.
     */
    public readonly cursosPermitidos: readonly Identificador[]
  ) {}

  public static ehPerfilValido(valor: string | null): valor is PerfilUsuario {
    return valor !== null && (EscopoDeAcesso.PERFIS_VALIDOS as readonly string[]).includes(valor)
  }

  /** Administra o painel: cursos, usuários e exclusão de aplicações. */
  public podeAdministrar(): boolean {
    return this.perfil === 'administrador'
  }

  /** Importa planilha: a coordenação alimenta o próprio campus. */
  public podeImportar(): boolean {
    return this.perfil === 'administrador' || this.perfil === 'coordenador'
  }

  /** Vê todos os cursos, sem restrição de escopo. */
  public alcancaTodosOsCursos(): boolean {
    return this.perfil === 'administrador' || this.cursosPermitidos.length === 0
  }

  public podeVerCurso(cursoId: Identificador): boolean {
    return this.alcancaTodosOsCursos() || this.cursosPermitidos.includes(cursoId)
  }

  /** Filtra uma lista de cursos pelo escopo, preservando a ordem recebida. */
  public cursosVisiveis<T extends { _id: Identificador }>(cursos: readonly T[]): T[] {
    if (this.alcancaTodosOsCursos()) return [...cursos]
    return cursos.filter((curso) => this.cursosPermitidos.includes(curso._id))
  }

  /**
   * Interrompe a operação quando o curso está fora do escopo.
   *
   * Existe para que a verificação seja uma linha em cada caso de uso: uma
   * checagem esquecida é um vazamento de dados de outro campus, e o custo de
   * esquecer precisa ser menor que o de lembrar.
   */
  public exigirCurso(cursoId: Identificador): void {
    if (!this.podeVerCurso(cursoId)) {
      throw new AcessoNegado('Este curso está fora do seu escopo de acesso.')
    }
  }

  public exigirPerfil(perfis: readonly PerfilUsuario[]): void {
    if (!perfis.includes(this.perfil)) {
      throw new AcessoNegado('Seu perfil não alcança esta operação.')
    }
  }
}

/** Erro de autorização, distinguível de falha de validação ou de infraestrutura. */
export class AcessoNegado extends Error {
  public constructor(mensagem: string) {
    super(mensagem)
    this.name = 'AcessoNegado'
  }
}
