export interface OpcoesModal {
  titulo: string
  texto?: string
  conteudo?: HTMLElement
  rotuloConfirmar?: string
  rotuloCancelar?: string
  perigo?: boolean
}

/** Modal de confirmação. Resolve `true` quando o usuário confirma. */
export function confirmar(opcoes: OpcoesModal): Promise<boolean> {
  return new Promise((resolver) => {
    const fundo = document.createElement('div')
    fundo.className = 'fundo-modal'

    const caixa = document.createElement('div')
    caixa.className = 'modal'
    caixa.setAttribute('role', 'dialog')
    caixa.setAttribute('aria-modal', 'true')

    const titulo = document.createElement('h2')
    titulo.textContent = opcoes.titulo
    caixa.append(titulo)

    if (opcoes.texto) {
      const paragrafo = document.createElement('p')
      paragrafo.textContent = opcoes.texto
      caixa.append(paragrafo)
    }
    if (opcoes.conteudo) caixa.append(opcoes.conteudo)

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'

    const fechar = (resposta: boolean): void => {
      fundo.remove()
      document.removeEventListener('keydown', aoTeclar)
      resolver(resposta)
    }

    function aoTeclar(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') fechar(false)
    }

    if (opcoes.rotuloCancelar !== null) {
      const cancelar = document.createElement('button')
      cancelar.type = 'button'
      cancelar.className = 'botao botao--secundario'
      cancelar.textContent = opcoes.rotuloCancelar ?? 'Cancelar'
      cancelar.addEventListener('click', () => fechar(false))
      acoes.append(cancelar)
    }

    const confirmarBotao = document.createElement('button')
    confirmarBotao.type = 'button'
    confirmarBotao.className = 'botao'
    confirmarBotao.textContent = opcoes.rotuloConfirmar ?? 'Confirmar'
    if (opcoes.perigo) confirmarBotao.style.background = 'var(--cor-alerta)'
    confirmarBotao.addEventListener('click', () => fechar(true))
    acoes.append(confirmarBotao)

    caixa.append(acoes)
    fundo.append(caixa)
    fundo.addEventListener('click', (evento) => {
      if (evento.target === fundo) fechar(false)
    })
    document.addEventListener('keydown', aoTeclar)
    document.body.append(fundo)
    confirmarBotao.focus()
  })
}

/** Exibe uma senha inicial para o administrador copiar e entregar. */
export function mostrarSenhaInicial(nome: string, senha: string): Promise<boolean> {
  const conteudo = document.createElement('div')

  const destaque = document.createElement('div')
  destaque.className = 'senha-destaque'
  destaque.textContent = senha

  const aviso = document.createElement('p')
  aviso.style.margin = '0'
  aviso.style.fontSize = '13px'
  aviso.style.color = 'var(--cor-texto-suave)'
  aviso.textContent =
    'Esta senha aparece apenas uma vez. Entregue-a pelo canal institucional; ' +
    'o usuário será obrigado a trocá-la no primeiro acesso.'

  conteudo.append(destaque, aviso)

  return confirmar({
    titulo: `Senha inicial de ${nome}`,
    conteudo,
    rotuloConfirmar: 'Entendi',
    rotuloCancelar: null as unknown as string
  })
}
