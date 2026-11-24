import type { ContextoJornada, PassoJornada } from '@compartilhado/jornada'

import { caminhoAtual, navegarPara } from '../rotas'

/**
 * Jornada guiada.
 *
 * Um guia escrito ensina o que existe; a jornada mostra onde está. Cada passo
 * leva a tela real, acende o elemento de que fala e explica o que ele responde,
 * sem usar dados de exemplo — quem acompanha vê o próprio painel.
 *
 * A camada vive em `document.body`, e não dentro da raiz da aplicação, porque
 * a navegação redesenha a raiz inteira a cada passo.
 */

/** Folga entre o elemento aceso e o anel que o contorna. */
const FOLGA = 8
const MARGEM_JANELA = 16
const LARGURA_CARTAO = 400
const LIMITE_ESPERA_MS = 2500

let emAndamento = false

export function jornadaEmAndamento(): boolean {
  return emAndamento
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

function proximoQuadro(): Promise<void> {
  return new Promise((resolver) => requestAnimationFrame(() => resolver()))
}

/** O elemento existe e tem área na tela? */
function visivel(elemento: Element | null): elemento is HTMLElement {
  if (!(elemento instanceof HTMLElement)) return false
  const caixa = elemento.getBoundingClientRect()
  return caixa.width > 0 && caixa.height > 0
}

/**
 * Espera o elemento aparecer.
 *
 * As telas se preenchem depois de consultar o processo principal, então o alvo
 * de um passo quase nunca está no documento no instante em que a rota muda.
 */
async function aguardarAlvo(seletor: string): Promise<HTMLElement | null> {
  const limite = Date.now() + LIMITE_ESPERA_MS
  while (Date.now() < limite) {
    const encontrado = document.querySelector(seletor)
    if (visivel(encontrado)) return encontrado
    await esperar(80)
  }
  return null
}

export function iniciarJornadaGuiada(
  definicoes: PassoJornada[],
  contexto: ContextoJornada,
  aoTerminar?: (concluiu: boolean) => void
): void {
  if (emAndamento) return

  const passos = definicoes.filter(
    (passo) =>
      (!passo.somenteAdmin || contexto.ehAdmin) &&
      (!passo.exigeAplicacao || contexto.possuiAplicacoes)
  )
  if (passos.length === 0) return

  emAndamento = true

  const bloqueio = document.createElement('div')
  bloqueio.className = 'tour-bloqueio'

  const realce = document.createElement('div')
  realce.className = 'tour-realce'
  realce.hidden = true

  const cartao = document.createElement('section')
  cartao.className = 'tour-cartao'
  cartao.setAttribute('role', 'dialog')
  cartao.setAttribute('aria-modal', 'true')
  cartao.setAttribute('aria-live', 'polite')

  const contador = document.createElement('p')
  contador.className = 'tour-cartao__contador'

  const titulo = document.createElement('h2')
  titulo.className = 'tour-cartao__titulo'

  const texto = document.createElement('p')
  texto.className = 'tour-cartao__texto'

  const experimente = document.createElement('p')
  experimente.className = 'tour-cartao__experimente'

  const trilho = document.createElement('div')
  trilho.className = 'tour-cartao__trilho'
  const progresso = document.createElement('div')
  progresso.className = 'tour-cartao__progresso'
  trilho.append(progresso)

  const acoes = document.createElement('div')
  acoes.className = 'tour-cartao__acoes'

  const sair = document.createElement('button')
  sair.type = 'button'
  sair.className = 'botao botao--texto'
  sair.textContent = 'Sair da jornada'

  const anterior = document.createElement('button')
  anterior.type = 'button'
  anterior.className = 'botao botao--secundario'
  anterior.textContent = 'Anterior'

  const proximo = document.createElement('button')
  proximo.type = 'button'
  proximo.className = 'botao'
  proximo.textContent = 'Próximo'

  const grupo = document.createElement('div')
  grupo.className = 'tour-cartao__navegacao'
  grupo.append(anterior, proximo)
  acoes.append(sair, grupo)

  cartao.append(contador, titulo, texto, experimente, trilho, acoes)

  let indice = 0
  /** Cresce a cada passo: descarta a espera de um alvo que já não interessa. */
  let geracao = 0
  let alvoAtual: HTMLElement | null = null
  let seletorAtual: string | undefined
  let reposicionamento: ReturnType<typeof setInterval> | undefined

  function centralizarCartao(): void {
    realce.hidden = true
    bloqueio.dataset.opaco = 'true'
    cartao.dataset.ancorado = 'false'
    cartao.style.left = `${Math.max((window.innerWidth - LARGURA_CARTAO) / 2, MARGEM_JANELA)}px`
    cartao.style.top = `${Math.max((window.innerHeight - cartao.offsetHeight) / 2, MARGEM_JANELA)}px`
  }

  function posicionar(): void {
    if (!seletorAtual) {
      centralizarCartao()
      return
    }

    // A tela pode ter se redesenhado depois da medição: reencontra o alvo.
    if (!alvoAtual || !alvoAtual.isConnected) {
      const novo = document.querySelector(seletorAtual)
      alvoAtual = visivel(novo) ? novo : null
    }
    if (!alvoAtual) {
      centralizarCartao()
      return
    }

    const caixa = alvoAtual.getBoundingClientRect()
    realce.hidden = false
    bloqueio.dataset.opaco = 'false'
    realce.style.left = `${caixa.left - FOLGA}px`
    realce.style.top = `${caixa.top - FOLGA}px`
    realce.style.width = `${caixa.width + FOLGA * 2}px`
    realce.style.height = `${caixa.height + FOLGA * 2}px`

    const altura = cartao.offsetHeight
    const abaixo = caixa.bottom + FOLGA * 2
    const acima = caixa.top - altura - FOLGA * 2
    const topo =
      abaixo + altura + MARGEM_JANELA <= window.innerHeight
        ? abaixo
        : acima >= MARGEM_JANELA
          ? acima
          : Math.max((window.innerHeight - altura) / 2, MARGEM_JANELA)

    const esquerdaDesejada = caixa.left + caixa.width / 2 - LARGURA_CARTAO / 2
    const limite = window.innerWidth - LARGURA_CARTAO - MARGEM_JANELA
    cartao.dataset.ancorado = 'true'
    cartao.style.left = `${Math.min(Math.max(esquerdaDesejada, MARGEM_JANELA), Math.max(limite, MARGEM_JANELA))}px`
    cartao.style.top = `${topo}px`
  }

  function encerrar(concluiu: boolean): void {
    if (!emAndamento) return
    emAndamento = false
    geracao += 1
    if (reposicionamento) clearInterval(reposicionamento)
    document.removeEventListener('keydown', aoTeclar, true)
    window.removeEventListener('resize', posicionar)
    window.removeEventListener('scroll', posicionar, true)
    bloqueio.remove()
    realce.remove()
    cartao.remove()
    aoTerminar?.(concluiu)
  }

  function aoTeclar(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      encerrar(false)
      return
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      void ir(indice + 1)
      return
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      void ir(indice - 1)
    }
  }

  async function ir(destino: number): Promise<void> {
    if (!emAndamento) return
    if (destino >= passos.length) {
      encerrar(true)
      return
    }

    indice = Math.max(destino, 0)
    const passo = passos[indice]
    if (!passo) {
      encerrar(true)
      return
    }

    const minhaGeracao = ++geracao

    contador.textContent = `Passo ${indice + 1} de ${passos.length}`
    titulo.textContent = passo.titulo
    texto.textContent = passo.texto
    experimente.textContent = passo.experimente ?? ''
    experimente.hidden = !passo.experimente
    progresso.style.width = `${((indice + 1) / passos.length) * 100}%`
    anterior.disabled = indice === 0
    proximo.textContent = indice === passos.length - 1 ? 'Concluir' : 'Próximo'

    // Enquanto a tela do passo não chega, o cartão já fica legível no centro.
    seletorAtual = undefined
    alvoAtual = null
    centralizarCartao()

    if (passo.caminho && caminhoAtual() !== passo.caminho) navegarPara(passo.caminho)

    if (passo.alvo) {
      const encontrado = await aguardarAlvo(passo.alvo)
      if (minhaGeracao !== geracao || !emAndamento) return
      if (encontrado) {
        seletorAtual = passo.alvo
        alvoAtual = encontrado
        encontrado.scrollIntoView({ block: 'center', inline: 'nearest' })
        await proximoQuadro()
        if (minhaGeracao !== geracao || !emAndamento) return
      }
    } else {
      // Dá tempo de a tela nova substituir a anterior antes de medir o cartão.
      await esperar(120)
      if (minhaGeracao !== geracao || !emAndamento) return
    }

    posicionar()
    proximo.focus()
  }

  sair.addEventListener('click', () => encerrar(false))
  anterior.addEventListener('click', () => void ir(indice - 1))
  proximo.addEventListener('click', () => void ir(indice + 1))
  document.addEventListener('keydown', aoTeclar, true)
  window.addEventListener('resize', posicionar)
  window.addEventListener('scroll', posicionar, true)

  document.body.append(bloqueio, realce, cartao)
  // O conteúdo das telas chega aos poucos: o alvo aceso acompanha o redesenho.
  reposicionamento = setInterval(posicionar, 400)
  void ir(0)
}
