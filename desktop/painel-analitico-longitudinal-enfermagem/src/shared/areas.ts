import type { AreaConhecimento } from './types/dominio'
import type { ParTemaArea } from './types/planilha'
import { aparar, chaveComparacao } from './texto'

/**
 * Agrupamento de temas em áreas de conhecimento.
 *
 * A planilha traz um tema por questão — as 35 questões da amostra têm 35 temas
 * distintos. As áreas amplas que as docentes usam para pensar o curso
 * ("Urgência", "Saúde Coletiva", "Gestão") não existem na fonte: são
 * conhecimento delas sobre o instrumento. Por isso o agrupamento é cadastro do
 * curso, e não dedução do programa.
 */

export const AREA_NAO_MAPEADA = 'Sem área definida'

export type IndiceAreas = Map<string, string>

export function indiceDeAreas(areas: AreaConhecimento[]): IndiceAreas {
  const indice: IndiceAreas = new Map()
  for (const area of areas) {
    for (const tema of area.temas) {
      indice.set(chaveComparacao(tema), aparar(area.nome))
    }
  }
  return indice
}

/** Área de um tema, ou a área de reserva quando ele não foi mapeado. */
export function areaDoTema(indice: IndiceAreas, tema: string): string {
  return indice.get(chaveComparacao(tema)) ?? AREA_NAO_MAPEADA
}

export function temaEstaMapeado(indice: IndiceAreas, tema: string): boolean {
  return indice.has(chaveComparacao(tema))
}

/** Temas atribuídos a mais de uma área — o único erro possível no cadastro. */
export function temasDuplicados(areas: AreaConhecimento[]): string[] {
  const vistos = new Map<string, string>()
  const duplicados: string[] = []

  for (const area of areas) {
    for (const tema of area.temas) {
      const chave = chaveComparacao(tema)
      const anterior = vistos.get(chave)
      if (anterior && anterior !== area.nome) duplicados.push(aparar(tema))
      else vistos.set(chave, area.nome)
    }
  }

  return [...new Set(duplicados)]
}

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
export function mesclarAreas(
  atuais: AreaConhecimento[],
  pares: ParTemaArea[],
  temasImportados: string[] = []
): ResultadoMesclagem {
  const grafiaImportada = new Map<string, string>()
  for (const tema of temasImportados) grafiaImportada.set(chaveComparacao(tema), aparar(tema))

  const areas: AreaConhecimento[] = atuais.map((area) => ({
    nome: area.nome,
    temas: [...area.temas]
  }))

  const porNomeDeArea = new Map<string, AreaConhecimento>(
    areas.map((area) => [chaveComparacao(area.nome), area])
  )
  const areaAnterior = indiceDeAreas(atuais)

  const areasNovas: string[] = []
  const temasMovidos: string[] = []
  const temasDesconhecidos: string[] = []
  const atribuidos = new Set<string>()

  for (const par of pares) {
    const chaveTema = chaveComparacao(par.tema)
    const nomeArea = aparar(par.area)
    if (chaveTema === '' || nomeArea === '') continue

    const tema = grafiaImportada.get(chaveTema) ?? aparar(par.tema)
    if (temasImportados.length > 0 && !grafiaImportada.has(chaveTema)) {
      temasDesconhecidos.push(tema)
    }

    let destino = porNomeDeArea.get(chaveComparacao(nomeArea))
    if (!destino) {
      destino = { nome: nomeArea, temas: [] }
      areas.push(destino)
      porNomeDeArea.set(chaveComparacao(nomeArea), destino)
      areasNovas.push(nomeArea)
    }

    const anterior = areaAnterior.get(chaveTema)
    if (anterior && chaveComparacao(anterior) !== chaveComparacao(destino.nome)) {
      temasMovidos.push(tema)
    }

    // A planilha manda: o tema sai de qualquer outra área antes de entrar nesta.
    for (const area of areas) {
      area.temas = area.temas.filter((item) => chaveComparacao(item) !== chaveTema)
    }
    destino.temas.push(tema)
    atribuidos.add(chaveTema)
  }

  const indiceFinal = indiceDeAreas(areas)
  const temasSemArea = temasImportados.filter((tema) => !indiceFinal.has(chaveComparacao(tema)))

  return {
    areas,
    areasNovas: [...new Set(areasNovas)],
    temasAtribuidos: atribuidos.size,
    temasMovidos: [...new Set(temasMovidos)],
    temasDesconhecidos: [...new Set(temasDesconhecidos)],
    temasSemArea
  }
}
