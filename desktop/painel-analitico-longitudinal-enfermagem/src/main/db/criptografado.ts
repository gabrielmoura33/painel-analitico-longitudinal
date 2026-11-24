import type { Cofre, ModoCifra } from './cripto'
import type { Colecao, Documento, Filtro, NomeColecao, Repositorio } from './repositorio'

/**
 * Camada que cifra campos sensíveis na fronteira do repositório.
 *
 * Fica entre os serviços e o driver, e não dentro de nenhum deles: assim o
 * driver local e o MongoDB recebem exatamente o mesmo tratamento, e nenhum
 * serviço precisa lembrar de cifrar coisa alguma. Para quem chama, o
 * repositório continua devolvendo texto legível.
 *
 * Quais campos, e por quê:
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

class ColecaoCifrada<T extends Documento> implements Colecao<T> {
  constructor(
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

  async inserir(documento: Omit<T, '_id'> & { _id?: string }): Promise<T> {
    return this.daBase(await this.interna.inserir(this.paraBanco(documento))) as T
  }

  async inserirVarios(documentos: Array<Omit<T, '_id'> & { _id?: string }>): Promise<T[]> {
    const gravados = await this.interna.inserirVarios(
      documentos.map((documento) => this.paraBanco(documento))
    )
    return gravados.map((documento) => this.daBase(documento) as T)
  }

  async buscarPorId(id: string): Promise<T | null> {
    return this.daBase(await this.interna.buscarPorId(id))
  }

  async buscarUm(filtro: Filtro<T>): Promise<T | null> {
    return this.daBase(await this.interna.buscarUm(this.filtroParaBanco(filtro)))
  }

  async buscar(filtro: Filtro<T> = {}): Promise<T[]> {
    const encontrados = await this.interna.buscar(this.filtroParaBanco(filtro))
    return encontrados.map((documento) => this.daBase(documento) as T)
  }

  async atualizar(id: string, alteracoes: Partial<Omit<T, '_id'>>): Promise<T | null> {
    return this.daBase(await this.interna.atualizar(id, this.paraBanco(alteracoes)))
  }

  async remover(filtro: Filtro<T>): Promise<number> {
    return this.interna.remover(this.filtroParaBanco(filtro))
  }

  async contar(filtro: Filtro<T> = {}): Promise<number> {
    return this.interna.contar(this.filtroParaBanco(filtro))
  }
}

/**
 * Embrulha um repositório, cifrando os campos sensíveis de cada coleção.
 *
 * Coleções sem campo sensível passam direto, sem custo nenhum.
 */
export function comCriptografia(repositorio: Repositorio, cofre: Cofre): Repositorio {
  const cifrar = <T extends Documento>(nome: NomeColecao, colecao: Colecao<T>): Colecao<T> => {
    const campos = CAMPOS_SENSIVEIS[nome]
    return campos ? new ColecaoCifrada(colecao, cofre, campos) : colecao
  }

  return {
    get nome() {
      return repositorio.nome
    },
    get descricaoLocalDados() {
      return repositorio.descricaoLocalDados
    },
    cursos: repositorio.cursos,
    aplicacoes: repositorio.aplicacoes,
    discentes: cifrar('discentes', repositorio.discentes),
    questoes: repositorio.questoes,
    desempenho: repositorio.desempenho,
    usuarios: cifrar('usuarios', repositorio.usuarios),
    sessoes: repositorio.sessoes,
    solicitacoesSenha: repositorio.solicitacoesSenha,
    logImportacoes: repositorio.logImportacoes,
    conectar: () => repositorio.conectar(),
    desconectar: () => repositorio.desconectar(),
    transacao: (operacao) => repositorio.transacao(operacao)
  }
}
