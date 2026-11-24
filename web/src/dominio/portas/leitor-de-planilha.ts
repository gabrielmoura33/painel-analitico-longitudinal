import type { MatrizAba, ResumoAba } from '@/dominio/modelos/planilha'
import type { PerfilImportacao } from '@/dominio/modelos/dominio'

/** Planilha já aberta, independente da biblioteca que a leu. */
export interface PlanilhaAberta {
  abas(): ResumoAba[]
  lerMatriz(nomeAba: string, perfil: PerfilImportacao): MatrizAba
}

/**
 * Abertura de planilha a partir dos bytes recebidos.
 *
 * Recebe bytes, não caminho de arquivo: na web o arquivo chega por upload e
 * pode nunca tocar o disco. Era a suposição mais presa ao Electron em todo o
 * ETL, e é aqui que ela deixa de existir.
 */
export interface LeitorDePlanilha {
  abrir(conteudo: Uint8Array): Promise<PlanilhaAberta>
}
