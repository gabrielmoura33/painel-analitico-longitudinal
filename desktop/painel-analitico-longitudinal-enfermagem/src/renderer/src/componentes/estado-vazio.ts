import { navegarPara } from '../rotas'

/**
 * Estado vazio global.
 *
 * É a primeira coisa que o usuário vê numa instalação nova: enquanto nenhuma
 * planilha tiver sido importada, nenhuma tela analítica tem o que mostrar.
 */
export function montarEstadoVazio(tituloTela: string): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'cartao estado-vazio'

  const icone = document.createElement('div')
  icone.className = 'estado-vazio__icone'
  icone.textContent = '↑'
  icone.setAttribute('aria-hidden', 'true')

  const titulo = document.createElement('h2')
  titulo.textContent = 'Nenhuma aplicação importada'

  const texto = document.createElement('p')
  texto.textContent =
    `A tela "${tituloTela}" é calculada a partir das planilhas do Teste de Progresso. ` +
    'Importe a primeira aplicação para que os indicadores passem a existir.'

  const acao = document.createElement('button')
  acao.className = 'botao'
  acao.type = 'button'
  acao.textContent = 'Importar planilha'
  acao.addEventListener('click', () => navegarPara('/importacoes'))

  bloco.append(icone, titulo, texto, acao)
  return bloco
}
