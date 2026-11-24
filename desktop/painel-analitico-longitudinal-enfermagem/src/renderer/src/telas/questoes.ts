import type { ContextoPainel, LinhaQuestao } from '@compartilhado/types/indicadores'

import { avisoSemDados, cartaoKpi, painel, rodapeFonte } from '../componentes/painel'

const DIFICULDADE: Record<string, { texto: string; classe: string }> = {
  dificil: { texto: 'Difícil', classe: 'etiqueta--atencao' },
  media: { texto: 'Média', classe: 'etiqueta--neutra' },
  facil: { texto: 'Fácil', classe: 'etiqueta--positiva' }
}

function miniSerie(linha: LinhaQuestao): HTMLElement {
  const serie = document.createElement('span')
  serie.className = 'mini-serie'

  for (const ponto of linha.porPeriodo) {
    const barra = document.createElement('span')
    barra.className = 'mini-serie__barra'
    const valor = ponto.percentual ?? 0
    barra.style.height = `${Math.max(valor * 0.22, 2)}px`
    if (ponto.percentual !== null && ponto.percentual < 50) barra.dataset.critica = 'true'
    barra.title =
      ponto.percentual === null
        ? `${ponto.periodo}: não aplicada`
        : `${ponto.periodo}: ${ponto.percentual.toFixed(0)}%`
    serie.append(barra)
  }

  return serie
}

/** Comportamento de cada questão do instrumento. */
export function montarVisaoQuestoes(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')
  let somenteCriticas = false
  let filtroComponente = ''
  let filtroDocente = ''

  async function desenhar(): Promise<void> {
    container.replaceChildren()

    if (!contexto.cursoId || !contexto.aplicacaoId) {
      container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
      return
    }

    const visao = await window.painel.invocar('painel:visao-questoes', {
      cursoId: contexto.cursoId,
      aplicacaoId: contexto.aplicacaoId
    })

    if (!visao) {
      container.append(avisoSemDados('Não encontrei dados para esta aplicação.'))
      return
    }

    const cabecalho = document.createElement('div')
    cabecalho.className = 'cabecalho-pagina'
    cabecalho.innerHTML = `
      <h1>Questões</h1>
      <p>${visao.cursoNome} · aplicação ${visao.aplicacao.rotulo}</p>`
    container.append(cabecalho)

    const kpis = document.createElement('div')
    kpis.className = 'kpis'
    kpis.dataset.tour = 'questoes-kpis'
    kpis.append(
      cartaoKpi('Questões na aplicação', String(visao.questoes.length)),
      cartaoKpi(
        'Abaixo de 50% em todos os períodos',
        String(visao.totalCriticas),
        { texto: 'candidatas a revisão', sinal: visao.totalCriticas > 0 ? 'negativo' : 'positivo' }
      ),
      cartaoKpi(
        'Difíceis',
        String(visao.questoes.filter((questao) => questao.dificuldade === 'dificil').length),
        { texto: 'abaixo de 50% no conjunto' }
      ),
      cartaoKpi(
        'Fáceis',
        String(visao.questoes.filter((questao) => questao.dificuldade === 'facil').length),
        { texto: '70% ou mais de acerto' }
      )
    )
    container.append(kpis)

    const filtros = document.createElement('div')
    filtros.className = 'barra-filtros'
    filtros.dataset.tour = 'questoes-filtros'

    const componentes = [...new Set(visao.questoes.map((questao) => questao.componente))].sort()
    const seletorComponente = document.createElement('select')
    seletorComponente.className = 'campo__controle'
    seletorComponente.style.width = 'auto'
    seletorComponente.innerHTML =
      '<option value="">Todos os componentes</option>' +
      componentes.map((nome) => `<option value="${nome}">${nome}</option>`).join('')
    seletorComponente.value = filtroComponente
    seletorComponente.addEventListener('change', () => {
      filtroComponente = seletorComponente.value
      void desenhar()
    })

    const docentes = [...new Set(visao.questoes.map((questao) => questao.docente))].sort()
    const seletorDocente = document.createElement('select')
    seletorDocente.className = 'campo__controle'
    seletorDocente.style.width = 'auto'
    seletorDocente.innerHTML =
      '<option value="">Todos os docentes</option>' +
      docentes.map((nome) => `<option value="${nome}">${nome}</option>`).join('')
    seletorDocente.value = filtroDocente
    seletorDocente.addEventListener('change', () => {
      filtroDocente = seletorDocente.value
      void desenhar()
    })

    const alternar = document.createElement('label')
    alternar.className = 'caixa-selecao'
    alternar.style.marginBottom = '0'
    const caixa = document.createElement('input')
    caixa.type = 'checkbox'
    caixa.checked = somenteCriticas
    caixa.addEventListener('change', () => {
      somenteCriticas = caixa.checked
      void desenhar()
    })
    const textoAlternar = document.createElement('span')
    textoAlternar.textContent = 'Só as abaixo de 50% em todos os períodos'
    alternar.append(caixa, textoAlternar)

    filtros.append(seletorComponente, seletorDocente, alternar)
    container.append(filtros)

    const visiveis = visao.questoes.filter((questao) => {
      if (somenteCriticas && !questao.criticaEmTodosOsPeriodos) return false
      if (filtroComponente && questao.componente !== filtroComponente) return false
      if (filtroDocente && questao.docente !== filtroDocente) return false
      return true
    })

    const tabela = document.createElement('table')
    tabela.className = 'tabela'
    tabela.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>Tema</th><th>Gab.</th><th>Docente</th><th>Componente</th>
          <th>Acerto</th><th>Por período</th><th>Dificuldade</th>
        </tr>
      </thead>`
    const corpo = document.createElement('tbody')

    for (const questao of visiveis) {
      const dificuldade = DIFICULDADE[questao.dificuldade] ?? DIFICULDADE.media
      const linha = document.createElement('tr')

      const celulas = [
        String(questao.numero),
        questao.tema,
        questao.gabarito,
        questao.docente,
        questao.componente
      ].map((texto) => {
        const celula = document.createElement('td')
        celula.textContent = texto
        return celula
      })

      const acerto = document.createElement('td')
      acerto.innerHTML = `<strong>${questao.percentual.toFixed(1)}%</strong>`
      if (questao.criticaEmTodosOsPeriodos) {
        acerto.innerHTML += ' <span class="etiqueta etiqueta--atencao">todos os períodos</span>'
      }

      const serie = document.createElement('td')
      serie.append(miniSerie(questao))

      const nivel = document.createElement('td')
      nivel.innerHTML = `<span class="etiqueta ${dificuldade?.classe}">${dificuldade?.texto}</span>`

      linha.append(...celulas, acerto, serie, nivel)
      corpo.append(linha)
    }

    tabela.append(corpo)
    const painelQuestoes = painel(
      'Comportamento das questões',
      `Ordenadas da menor para a maior taxa de acerto. Mostrando ${visiveis.length} de ${visao.questoes.length}.`,
      tabela
    )
    painelQuestoes.dataset.tour = 'questoes-tabela'
    container.append(painelQuestoes)

    const indisponivel = document.createElement('div')
    indisponivel.className = 'indisponivel'
    indisponivel.innerHTML = `
      <strong>Distribuição das alternativas: indisponível na fonte atual</strong><br />
      A planilha registra apenas se o discente acertou a questão, nunca a letra que ele marcou.
      Para analisar quais alternativas atraem mais erro, a coleta precisaria mudar na origem.`
    const painelIndisponivel = painel(
      'Distribuição das alternativas escolhidas',
      'Indicador previsto no levantamento com as docentes.',
      indisponivel
    )
    painelIndisponivel.dataset.tour = 'questoes-indisponivel'

    container.append(
      painelIndisponivel,
      rodapeFonte(
        'Dificuldade: difícil abaixo de 50%, média de 50% a 69%, fácil a partir de 70%. ' +
          'Barras cinzentas marcam o acerto em cada período; as alaranjadas ficaram abaixo de 50%.'
      )
    )
  }

  void desenhar()
  return container
}
