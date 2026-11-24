import type { Cofre, ModoCifra } from '@/dominio/portas/cofre'
import type {
  Colecao,
  Documento,
  Filtro,
  NomeColecao,
  Repositorio
} from '@/dominio/portas/repositorio'
import type {
  Aplicacao,
  Curso,
  Desempenho,
  Discente,
  LogImportacao,
  Questao,
  Sessao,
  SolicitacaoSenha,
  Usuario
} from '@/dominio/modelos/dominio'

/**
 * Quais campos são cifrados, e por quê.
 *
 * - `usuarios.nomeCompleto`, `dataNascimento` — dado pessoal de quem opera.
 * - `usuarios.cpf` — determinístico porque o cadastro busca por ele para
 *   impedir duplicata.
 * - `discentes.nomeCompleto`, `matricula` — a identificação do estudante, que
 *   as telas coletivas já só mostram por pseudônimo.
 *
 * O desempenho não é cifrado: acerto por questão, sozinho, não identifica
 * ninguém, e cifrá-lo inviabilizaria as consultas que sustentam os painéis.
 */
const CAMPOS_SENSIVEIS: Partial<Record<NomeColecao, Record<string, ModoCifra>>> = {
  usuarios: {
    nomeCompleto: 'aleatorio',
    cpf: 'determinista',
    dataNascimento: 'aleatorio'
  },
  discentes: {
    nomeCompleto: 'aleatorio',
    matricula: 'aleatorio'
  }
}

/** Decorador de coleção: cifra ao gravar, decifra ao ler. */
class ColecaoCifrada<T extends Documento> implements Colecao<T> {
  public constructor(
    private readonly interna: Colecao<T>,
    private readonly cofre: Cofre,
    private readonly campos: Record<string, ModoCifra>
  ) {}

  private paraBanco<D extends object>(documento: D): D {
    const copia = { ...documento } as unknown as Record<string, unknown>
    for (const [campo, modo] of Object.entries(this.campos)) {
      const valor = copia[campo]
      if (typeof valor === 'string' && valor !== '') copia[campo] = this.cofre.cifrar(valor, modo)
    }
    return copia as D
  }

  private daBase(documento: T | null): T | null {
    if (!documento) return null
    const copia = { ...documento } as unknown as Record<string, unknown>
    for (const campo of Object.keys(this.campos)) {
      const valor = copia[campo]
      if (typeof valor === 'string' && valor !== '') copia[campo] = this.cofre.decifrar(valor)
    }
    return copia as T
  }

  /**
   * Traduz o filtro para o que está gravado.
   *
   * Só o modo determinístico sobrevive à tradução. Filtrar por um campo de IV
   * aleatório nunca acharia nada — e silenciar isso esconderia um erro de
   * programação atrás de uma lista vazia, então o erro é explícito.
   */
  private filtroParaBanco(filtro: Filtro<T>): Filtro<T> {
    const traduzido = { ...filtro } as unknown as Record<string, unknown>
    for (const [campo, valor] of Object.entries(traduzido)) {
      const modo = this.campos[campo]
      if (!modo || typeof valor !== 'string' || valor === '') continue

      if (modo !== 'determinista') {
        throw new Error(
          `O campo "${campo}" é cifrado com IV aleatório e não pode ser usado como filtro.`
        )
      }
      traduzido[campo] = this.cofre.cifrar(valor, modo)
    }
    return traduzido as Filtro<T>
  }

  public async inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    return this.daBase(await this.interna.inserir(this.paraBanco(documento))) as T
  }

  public async inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    const gravados = await this.interna.inserirVarios(
      documentos.map((documento) => this.paraBanco(documento))
    )
    return gravados.map((documento) => this.daBase(documento) as T)
  }

  public async buscarPorId(id: string): Promise<T | null> {
    return this.daBase(await this.interna.buscarPorId(id))
  }

  public async buscarUm(filtro: Filtro<T>): Promise<T | null> {
    return this.daBase(await this.interna.buscarUm(this.filtroParaBanco(filtro)))
  }

  public async buscar(filtro: Filtro<T> = {}): Promise<T[]> {
    const encontrados = await this.interna.buscar(this.filtroParaBanco(filtro))
    return encontrados.map((documento) => this.daBase(documento) as T)
  }

  public async atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null> {
    return this.daBase(await this.interna.atualizar(id, this.paraBanco(alteracoes)))
  }

  public async remover(filtro: Filtro<T>): Promise<number> {
    return this.interna.remover(this.filtroParaBanco(filtro))
  }

  public async contar(filtro: Filtro<T> = {}): Promise<number> {
    return this.interna.contar(this.filtroParaBanco(filtro))
  }
}

/**
 * Decorador de repositório: cifra os campos sensíveis de cada coleção.
 *
 * Fica entre os casos de uso e o banco, e não dentro de nenhum deles: assim
 * qualquer driver recebe o mesmo tratamento, e nenhum caso de uso precisa
 * lembrar de cifrar coisa alguma. Para quem chama, o repositório continua
 * devolvendo texto legível.
 *
 * Coleções sem campo sensível passam direto, sem custo nenhum.
 */
export class RepositorioCifrado implements Repositorio {
  public readonly cursos: Colecao<Curso>
  public readonly aplicacoes: Colecao<Aplicacao>
  public readonly discentes: Colecao<Discente>
  public readonly questoes: Colecao<Questao>
  public readonly desempenho: Colecao<Desempenho>
  public readonly usuarios: Colecao<Usuario>
  public readonly sessoes: Colecao<Sessao>
  public readonly solicitacoesSenha: Colecao<SolicitacaoSenha>
  public readonly logImportacoes: Colecao<LogImportacao>

  public constructor(
    private readonly interno: Repositorio,
    cofre: Cofre
  ) {
    const cifrar = <T extends Documento>(nome: NomeColecao, colecao: Colecao<T>): Colecao<T> => {
      const campos = CAMPOS_SENSIVEIS[nome]
      return campos ? new ColecaoCifrada<T>(colecao, cofre, campos) : colecao
    }

    this.cursos = interno.cursos
    this.aplicacoes = interno.aplicacoes
    this.discentes = cifrar('discentes', interno.discentes)
    this.questoes = interno.questoes
    this.desempenho = interno.desempenho
    this.usuarios = cifrar('usuarios', interno.usuarios)
    this.sessoes = interno.sessoes
    this.solicitacoesSenha = interno.solicitacoesSenha
    this.logImportacoes = interno.logImportacoes
  }

  public get nome(): string {
    return this.interno.nome
  }

  public get descricaoLocalDados(): string {
    return this.interno.descricaoLocalDados
  }

  public conectar(): Promise<void> {
    return this.interno.conectar()
  }

  public desconectar(): Promise<void> {
    return this.interno.desconectar()
  }

  public transacao<T>(operacao: () => Promise<T>): Promise<T> {
    return this.interno.transacao(operacao)
  }
}
