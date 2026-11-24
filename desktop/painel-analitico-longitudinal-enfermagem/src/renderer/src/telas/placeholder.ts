import type { EstadoInicial } from '@compartilhado/types/ipc'

import { montarEstadoVazio } from '../componentes/estado-vazio'
import type { Rota } from '../rotas'

/**
 * Tela ainda não implementada.
 *
 * A Fase 1 entrega a fundação: navegação, estado vazio e a carcaça de cada
 * tela. O conteúdo chega nas fases seguintes, na ordem do prompt do projeto.
 */
export function montarPlaceholder(rota: Rota, estado: EstadoInicial): HTMLElement {
  const container = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina'
  cabecalho.innerHTML = `<h1>${rota.titulo}</h1>`
  container.append(cabecalho)

  if (rota.exigeAplicacao && !estado.possuiAplicacoes) {
    container.append(montarEstadoVazio(rota.titulo))
    return container
  }

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.innerHTML = `
    <h2 style="font-size:17px;margin-bottom:8px">Tela prevista, ainda não construída</h2>
    <p style="color:var(--cor-texto-suave);margin:0;line-height:1.55">
      A fundação da aplicação está pronta. Esta tela entra em uma das próximas fases,
      conforme a ordem de implementação definida em <code>PROMPT-CLAUDE-CODE.md</code>.
    </p>`
  container.append(cartao)
  return container
}
