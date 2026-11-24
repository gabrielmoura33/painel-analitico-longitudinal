/** Blocos visuais compartilhados pelas telas analíticas. */

export function cartaoKpi(
  rotulo: string,
  valor: string,
  nota?: { texto: string; sinal?: 'positivo' | 'negativo' }
): HTMLElement {
  const cartao = document.createElement('div')
  cartao.className = 'kpi'

  const rotuloElemento = document.createElement('div')
  rotuloElemento.className = 'kpi__rotulo'
  rotuloElemento.textContent = rotulo

  const valorElemento = document.createElement('div')
  valorElemento.className = 'kpi__valor'
  valorElemento.textContent = valor

  cartao.append(rotuloElemento, valorElemento)

  if (nota) {
    const notaElemento = document.createElement('div')
    notaElemento.className = 'kpi__nota'
    if (nota.sinal) notaElemento.dataset.sinal = nota.sinal
    notaElemento.textContent = nota.texto
    cartao.append(notaElemento)
  }

  return cartao
}

export function painel(titulo: string, descricao: string, ...conteudo: HTMLElement[]): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'painel'
  const cabecalho = document.createElement('div')
  cabecalho.innerHTML = `<div class="painel__titulo">${titulo}</div><p class="painel__descricao">${descricao}</p>`
  bloco.append(cabecalho, ...conteudo)
  return bloco
}

export function variacaoEmTexto(valor: number | null, sufixo: string): {
  texto: string
  sinal?: 'positivo' | 'negativo'
} {
  if (valor === null) return { texto: 'Primeira aplicação do curso' }
  const sinal = valor >= 0 ? 'positivo' : 'negativo'
  const seta = valor >= 0 ? '▲' : '▼'
  return { texto: `${seta} ${Math.abs(valor).toFixed(1)}${sufixo} vs. aplicação anterior`, sinal }
}

/** Barra horizontal de distribuição, como no mockup aprovado. */
export function barraDistribuicao(
  rotulo: string,
  percentual: number,
  detalhe: string,
  faixa: 'baixa' | 'media' | 'alta'
): HTMLElement {
  const linha = document.createElement('div')
  linha.className = 'distribuicao__linha'

  const cabecalho = document.createElement('div')
  cabecalho.className = 'distribuicao__cabecalho'
  cabecalho.innerHTML = `<span>${rotulo}</span><strong>${detalhe}</strong>`

  const trilho = document.createElement('div')
  trilho.className = 'distribuicao__trilho'
  const preenchimento = document.createElement('div')
  preenchimento.className = 'distribuicao__preenchimento'
  preenchimento.dataset.faixa = faixa
  preenchimento.style.width = `${Math.max(percentual, 0.5)}%`
  trilho.append(preenchimento)

  linha.append(cabecalho, trilho)
  return linha
}

/** Caixa de dispersão (mínimo, quartis, máximo) desenhada em CSS. */
export function caixaDispersao(dados: {
  minimo: number
  q1: number
  mediana: number
  q3: number
  maximo: number
}): HTMLElement {
  const caixa = document.createElement('div')
  caixa.className = 'caixa-dispersao'

  const linha = document.createElement('div')
  linha.className = 'caixa-dispersao__linha'
  linha.style.left = `${dados.minimo}%`
  linha.style.width = `${Math.max(dados.maximo - dados.minimo, 0.5)}%`

  const corpo = document.createElement('div')
  corpo.className = 'caixa-dispersao__caixa'
  corpo.style.left = `${dados.q1}%`
  corpo.style.width = `${Math.max(dados.q3 - dados.q1, 0.5)}%`

  const mediana = document.createElement('div')
  mediana.className = 'caixa-dispersao__mediana'
  mediana.style.left = `${dados.mediana}%`

  caixa.title =
    `mínimo ${dados.minimo.toFixed(0)}% · 1º quartil ${dados.q1.toFixed(0)}% · ` +
    `mediana ${dados.mediana.toFixed(0)}% · 3º quartil ${dados.q3.toFixed(0)}% · ` +
    `máximo ${dados.maximo.toFixed(0)}%`

  caixa.append(linha, corpo, mediana)
  return caixa
}

export function rodapeFonte(texto: string): HTMLElement {
  const rodape = document.createElement('p')
  rodape.className = 'rodape-fonte'
  rodape.textContent = texto
  return rodape
}

export function avisoSemDados(mensagem: string): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'mensagem mensagem--aviso'
  bloco.textContent = mensagem
  return bloco
}
