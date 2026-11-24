import type { AreaConhecimento } from '@/dominio/modelos/dominio'
import type { ParTemaArea } from '@/dominio/modelos/planilha'
import { Texto } from '@/dominio/regras/texto'

/** O que a mesclagem com a planilha de áreas mudou, para a docente conferir. */
export interface ResultadoMesclagem {
  areas: AreaConhecimento[]
  /** Áreas que não existiam no cadastro e entraram agora. */
  areasNovas: string[]
  temasAtribuidos: number
  /** Temas que já tinham área e mudaram de lugar. */
  temasMovidos: string[]
  /** Temas da planilha que nenhuma importação trouxe — provável erro de grafia. */
  temasDesconhecidos: string[]
  /** Temas já importados que a planilha não cobre. */
  temasSemArea: string[]
}

/**
 * Agrupamento de temas em áreas de conhecimento.
 *
 * A planilha traz um tema por questão — as 35 questões da amostra têm 35 temas
 * distintos. As áreas amplas que as docentes usam para pensar o curso
 * ("Urgência", "Saúde Coletiva", "Gestão") não existem na fonte: são
 * conhecimento delas sobre o instrumento. Por isso o agrupamento é cadastro do
 * curso, e não dedução do programa.
 *
 * A classe é construída a partir do cadastro e mantém o índice pronto: as
 * telas analíticas consultam a área de um tema milhares de vezes por página, e
 * remontar o índice a cada consulta era a forma mais fácil de transformar uma
 * tela em espera.
 */
export class MapaDeAreas {
  public static readonly AREA_NAO_MAPEADA = 'Sem área definida'

  private readonly indice: Map<string, string>

  public constructor(private readonly areas: readonly AreaConhecimento[]) {
    this.indice = MapaDeAreas.montarIndice(areas)
  }

  private static montarIndice(areas: readonly AreaConhecimento[]): Map<string, string> {
    const indice = new Map<string, string>()
    for (const area of areas) {
      for (const tema of area.temas) {
        indice.set(Texto.chaveComparacao(tema), Texto.aparar(area.nome))
      }
    }
    return indice
  }

  /** Área de um tema, ou a área de reserva quando ele não foi mapeado. */
  public areaDoTema(tema: string): string {
    return this.indice.get(Texto.chaveComparacao(tema)) ?? MapaDeAreas.AREA_NAO_MAPEADA
  }

  public temaEstaMapeado(tema: string): boolean {
    return this.indice.has(Texto.chaveComparacao(tema))
  }

  /**
   * Rótulo pelo qual agrupar um tema nas telas.
   *
   * Enquanto nenhuma área estiver cadastrada, o próprio tema é o agrupamento:
   * é o que permite a plataforma ser útil desde a primeira importação, antes
   * de a docente ter montado as áreas. Depois que elas existem, o agrupamento
   * passa a ser por área sem que nenhuma tela precise saber da diferença.
   */
  public rotuloDeAgrupamento(tema: string): string {
    return this.vazio ? Texto.aparar(tema) : this.areaDoTema(tema)
  }

  public get vazio(): boolean {
    return this.indice.size === 0
  }

  /** Temas atribuídos a mais de uma área — o único erro possível no cadastro. */
  public temasDuplicados(): string[] {
    const vistos = new Map<string, string>()
    const duplicados: string[] = []

    for (const area of this.areas) {
      for (const tema of area.temas) {
        const chave = Texto.chaveComparacao(tema)
        const anterior = vistos.get(chave)
        if (anterior && anterior !== area.nome) duplicados.push(Texto.aparar(tema))
        else vistos.set(chave, area.nome)
      }
    }

    return [...new Set(duplicados)]
  }

  /**
   * Funde o mapeamento lido da planilha com as áreas já cadastradas.
   *
   * A planilha manda: um tema que ela atribui a uma área sai de onde estivesse.
   * O que ela não menciona fica como está — importar o mapeamento de uma
   * aplicação não apaga o trabalho feito para as outras.
   *
   * Quando o tema da planilha corresponde a um tema já importado, prevalece a
   * grafia da importação: é ela que as telas exibem, e divergir aqui criaria
   * dois temas onde há um.
   */
  public mesclarCom(
    pares: readonly ParTemaArea[],
    temasImportados: readonly string[] = []
  ): ResultadoMesclagem {
    const grafiaImportada = new Map<string, string>()
    for (const tema of temasImportados) {
      grafiaImportada.set(Texto.chaveComparacao(tema), Texto.aparar(tema))
    }

    const areas: AreaConhecimento[] = this.areas.map((area) => ({
      nome: area.nome,
      temas: [...area.temas]
    }))

    const porNomeDeArea = new Map<string, AreaConhecimento>(
      areas.map((area) => [Texto.chaveComparacao(area.nome), area])
    )

    const areasNovas: string[] = []
    const temasMovidos: string[] = []
    const temasDesconhecidos: string[] = []
    const atribuidos = new Set<string>()

    for (const par of pares) {
      const chaveTema = Texto.chaveComparacao(par.tema)
      const nomeArea = Texto.aparar(par.area)
      if (chaveTema === '' || nomeArea === '') continue

      const tema = grafiaImportada.get(chaveTema) ?? Texto.aparar(par.tema)
      if (temasImportados.length > 0 && !grafiaImportada.has(chaveTema)) {
        temasDesconhecidos.push(tema)
      }

      let destino = porNomeDeArea.get(Texto.chaveComparacao(nomeArea))
      if (!destino) {
        destino = { nome: nomeArea, temas: [] }
        areas.push(destino)
        porNomeDeArea.set(Texto.chaveComparacao(nomeArea), destino)
        areasNovas.push(nomeArea)
      }

      const anterior = this.indice.get(chaveTema)
      if (anterior && Texto.chaveComparacao(anterior) !== Texto.chaveComparacao(destino.nome)) {
        temasMovidos.push(tema)
      }

      // A planilha manda: o tema sai de qualquer outra área antes de entrar nesta.
      for (const area of areas) {
        area.temas = area.temas.filter((item) => Texto.chaveComparacao(item) !== chaveTema)
      }
      destino.temas.push(tema)
      atribuidos.add(chaveTema)
    }

    const mapaFinal = new MapaDeAreas(areas)
    const temasSemArea = temasImportados.filter((tema) => !mapaFinal.temaEstaMapeado(tema))

    return {
      areas,
      areasNovas: [...new Set(areasNovas)],
      temasAtribuidos: atribuidos.size,
      temasMovidos: [...new Set(temasMovidos)],
      temasDesconhecidos: [...new Set(temasDesconhecidos)],
      temasSemArea: [...temasSemArea]
    }
  }
}
