/**
 * Moldura das telas de acesso: coluna institucional à esquerda e formulário à
 * direita, como no mockup aprovado (Login.pdf).
 */
export function montarMolduraAcesso(formulario: HTMLElement, largo = false): HTMLElement {
  const tela = document.createElement('div')
  tela.className = 'acesso'

  const lateral = document.createElement('aside')
  lateral.className = 'acesso__lateral'
  lateral.innerHTML = `
    <div class="topbar__marca">
      <div class="topbar__simbolo" aria-hidden="true">+</div>
      <div>
        <div class="topbar__titulo">Painel Analítico</div>
        <div class="topbar__subtitulo">ENFERMAGEM</div>
      </div>
    </div>
    <div class="acesso__instituicao">
      PUC Minas<br />Instituto de Ciências Biológicas e da Saúde<br />Departamento de Enfermagem
    </div>`

  const painel = document.createElement('section')
  painel.className = 'acesso__painel'

  formulario.classList.add('acesso__formulario')
  if (largo) formulario.classList.add('acesso__formulario--largo')
  painel.append(formulario)

  tela.append(lateral, painel)
  return tela
}
