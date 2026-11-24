/** Construtores dos campos usados nos formulários, no padrão dos mockups. */

export interface OpcoesCampo {
  rotulo: string
  tipo?: 'text' | 'password' | 'date' | 'search' | 'number'
  min?: number
  max?: number
  larguraCurta?: boolean
  placeholder?: string
  dica?: string
  valor?: string
  /** Botão opcional à direita do rótulo, como "Esqueci a senha". */
  acaoRotulo?: { texto: string; aoClicar: () => void }
  aoDigitar?: (valor: string) => void
  autoFoco?: boolean
}

export interface Campo {
  elemento: HTMLElement
  entrada: HTMLInputElement
  valor: () => string
  definirErro: (mensagem: string | null) => void
  limpar: () => void
}

export function criarCampo(opcoes: OpcoesCampo): Campo {
  const bloco = document.createElement('div')
  bloco.className = 'campo'

  const cabecalho = document.createElement('div')
  cabecalho.className = 'campo__cabecalho'

  const rotulo = document.createElement('label')
  rotulo.className = 'campo__rotulo'
  rotulo.textContent = opcoes.rotulo
  cabecalho.append(rotulo)

  if (opcoes.acaoRotulo) {
    const acao = document.createElement('button')
    acao.type = 'button'
    acao.className = 'campo__link'
    acao.textContent = opcoes.acaoRotulo.texto
    acao.addEventListener('click', opcoes.acaoRotulo.aoClicar)
    cabecalho.append(acao)
  }

  const entrada = document.createElement('input')
  entrada.className = 'campo__controle'
  entrada.type = opcoes.tipo ?? 'text'
  entrada.placeholder = opcoes.placeholder ?? ''
  entrada.value = opcoes.valor ?? ''
  entrada.id = `campo-${Math.random().toString(36).slice(2, 9)}`
  rotulo.htmlFor = entrada.id
  if (opcoes.autoFoco) entrada.autofocus = true
  if (opcoes.min !== undefined) entrada.min = String(opcoes.min)
  if (opcoes.max !== undefined) entrada.max = String(opcoes.max)
  if (opcoes.larguraCurta) entrada.classList.add('campo__controle--curto')

  const erro = document.createElement('p')
  erro.className = 'campo__erro'
  erro.hidden = true

  const definirErro = (mensagem: string | null): void => {
    erro.textContent = mensagem ?? ''
    erro.hidden = mensagem === null
    entrada.setAttribute('aria-invalid', mensagem === null ? 'false' : 'true')
  }

  entrada.addEventListener('input', () => {
    definirErro(null)
    opcoes.aoDigitar?.(entrada.value)
  })

  bloco.append(cabecalho)

  if (opcoes.tipo === 'password') {
    const envolucro = document.createElement('div')
    envolucro.className = 'campo__senha'

    const olho = document.createElement('button')
    olho.type = 'button'
    olho.className = 'campo__olho'
    olho.textContent = '\u{1F441}'
    olho.title = 'Mostrar ou ocultar a senha'
    olho.setAttribute('aria-label', 'Mostrar ou ocultar a senha')
    olho.addEventListener('click', () => {
      entrada.type = entrada.type === 'password' ? 'text' : 'password'
    })

    envolucro.append(entrada, olho)
    bloco.append(envolucro)
  } else {
    bloco.append(entrada)
  }

  if (opcoes.dica) {
    const dica = document.createElement('p')
    dica.className = 'campo__dica'
    dica.textContent = opcoes.dica
    bloco.append(dica)
  }

  bloco.append(erro)

  return {
    elemento: bloco,
    entrada,
    valor: () => entrada.value,
    definirErro,
    limpar: () => {
      entrada.value = ''
      definirErro(null)
    }
  }
}

export interface CaixaSelecao {
  elemento: HTMLElement
  marcada: () => boolean
}

export function criarCaixaSelecao(texto: string, marcadaInicialmente = false): CaixaSelecao {
  const rotulo = document.createElement('label')
  rotulo.className = 'caixa-selecao'

  const entrada = document.createElement('input')
  entrada.type = 'checkbox'
  entrada.checked = marcadaInicialmente

  const span = document.createElement('span')
  span.textContent = texto

  rotulo.append(entrada, span)
  return { elemento: rotulo, marcada: () => entrada.checked }
}

export interface OpcaoPerfil {
  valor: string
  titulo: string
  descricao: string
}

export interface SeletorPerfil {
  elemento: HTMLElement
  valor: () => string | null
  limpar: () => void
}

export function criarSeletorPerfil(opcoes: OpcaoPerfil[]): SeletorPerfil {
  const grupo = document.createElement('div')
  grupo.className = 'perfis'
  const nome = `perfil-${Math.random().toString(36).slice(2, 9)}`
  const entradas: HTMLInputElement[] = []

  for (const opcao of opcoes) {
    const cartao = document.createElement('label')
    cartao.className = 'perfil-cartao'

    const entrada = document.createElement('input')
    entrada.type = 'radio'
    entrada.name = nome
    entrada.value = opcao.valor
    entradas.push(entrada)

    const texto = document.createElement('div')
    texto.innerHTML = `
      <div class="perfil-cartao__titulo">${opcao.titulo}</div>
      <div class="perfil-cartao__descricao">${opcao.descricao}</div>`

    cartao.append(entrada, texto)
    grupo.append(cartao)
  }

  return {
    elemento: grupo,
    valor: () => entradas.find((entrada) => entrada.checked)?.value ?? null,
    limpar: () => entradas.forEach((entrada) => (entrada.checked = false))
  }
}

export type TipoMensagem = 'erro' | 'sucesso' | 'aviso'

export interface AreaMensagem {
  elemento: HTMLElement
  mostrar: (texto: string, tipo?: TipoMensagem) => void
  esconder: () => void
}

export function criarAreaMensagem(): AreaMensagem {
  const bloco = document.createElement('div')
  bloco.hidden = true
  bloco.setAttribute('role', 'status')

  return {
    elemento: bloco,
    mostrar: (texto, tipo = 'erro') => {
      bloco.className = `mensagem mensagem--${tipo}`
      bloco.textContent = texto
      bloco.hidden = false
    },
    esconder: () => {
      bloco.hidden = true
    }
  }
}

export function criarListaRegras(
  regras: Array<{ descricao: string; atendida: (valor: string) => boolean }>
): { elemento: HTMLElement; avaliar: (valor: string) => void } {
  const lista = document.createElement('ul')
  lista.className = 'regras-senha'

  const itens = regras.map((regra) => {
    const item = document.createElement('li')
    item.dataset.atendida = 'false'
    item.innerHTML = `<span aria-hidden="true">○</span><span>${regra.descricao}</span>`
    lista.append(item)
    return { item, regra }
  })

  return {
    elemento: lista,
    avaliar: (valor: string) => {
      for (const { item, regra } of itens) {
        const ok = regra.atendida(valor)
        item.dataset.atendida = String(ok)
        const marcador = item.firstElementChild
        if (marcador) marcador.textContent = ok ? '✓' : '○'
      }
    }
  }
}
