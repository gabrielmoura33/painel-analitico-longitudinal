import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

/**
 * Localiza as planilhas reais do Teste de Progresso.
 *
 * Elas são material do projeto, não da aplicação: desde que o código do
 * Electron passou a viver em `desktop/<aplicação>/`, ficam na raiz do
 * repositório, acima desta pasta. A busca sobe os diretórios em vez de fixar
 * quantos níveis são, para que mover a aplicação outra vez não volte a
 * transformar estes testes em silêncio — um `skipIf` que nunca roda passa
 * despercebido justamente por não falhar.
 */

const NOME_2025 = 'PUC COMPLETA Percentuais de acertos do TP - 2025 2 COREU (1) (1) (1).xlsx'
const NOME_2026 = 'PUC Percentuais de acertos do TP - 2026 I COREU (1) (2).xlsx'

function localizar(nome: string): string | null {
  let pasta = import.meta.dirname
  const topo = parse(pasta).root
  while (true) {
    const tentativa = join(pasta, nome)
    if (existsSync(tentativa)) return tentativa
    if (pasta === topo) return null
    pasta = dirname(pasta)
  }
}

export const PLANILHA_2025 = localizar(NOME_2025)
export const PLANILHA_2026 = localizar(NOME_2026)

/** As duas planilhas estão disponíveis? */
export const temPlanilhas = PLANILHA_2025 !== null && PLANILHA_2026 !== null

/**
 * Caminho de uma planilha, para o teste que já sabe que ela existe.
 * Falha alto em vez de devolver string vazia: um caminho inválido vira erro
 * de leitura confuso lá dentro.
 */
export function exigir(caminho: string | null): string {
  if (caminho === null) {
    throw new Error('Planilha de referência não encontrada na árvore do projeto.')
  }
  return caminho
}
