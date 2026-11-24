export interface DefinicaoAba {
  id: string
  titulo: string
  montar: () => HTMLElement
}

/**
 * Abas simples: o conteúdo é remontado a cada troca, o que mantém a tela
 * sempre coerente com o estado atual do formulário.
 */
export function montarAbas(abas: DefinicaoAba[], idInicial?: string): HTMLElement {
  const container = document.createElement('div')

  const barra = document.createElement('div')
  barra.className = 'abas'

  const painel = document.createElement('div')
  painel.className = 'abas__painel'

  let ativa = idInicial ?? abas[0]?.id ?? ''

  const desenhar = (): void => {
    for (const botao of barra.querySelectorAll<HTMLButtonElement>('button')) {
      botao.dataset.ativa = String(botao.dataset.id === ativa)
    }
    const aba = abas.find((item) => item.id === ativa)
    painel.replaceChildren(aba ? aba.montar() : document.createElement('div'))
  }

  for (const aba of abas) {
    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'abas__botao'
    botao.dataset.id = aba.id
    botao.textContent = aba.titulo
    botao.addEventListener('click', () => {
      ativa = aba.id
      desenhar()
    })
    barra.append(botao)
  }

  container.append(barra, painel)
  desenhar()
  return container
}
