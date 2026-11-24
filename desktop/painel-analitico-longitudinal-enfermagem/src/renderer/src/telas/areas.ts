import type { ContextoPainel, VisaoAreas } from '@compartilhado/types/indicadores'

import { montarAbas } from '../componentes/abas'
import { corDoPercentual } from '../componentes/escala'
import { graficoLinha } from '../componentes/graficos'
import { avisoSemDados, painel, rodapeFonte } from '../componentes/painel'

const SITUACAO: Record<string, { texto: string; classe: string }> = {
  critica: { texto: 'Crítica', classe: 'etiqueta--atencao' },
  atencao: { texto: 'Atenção', classe: 'etiqueta--neutra' },
  boa: { texto: 'Boa', classe: 'etiqueta--positiva' }
}

/** Áreas de conhecimento: ranking, matriz período × área e evolução. */
export function montarVisaoAreas(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')

  function abaRanking(visao: VisaoAreas): HTMLElement {
    const tabela = document.createElement('table')
    tabela.className = 'tabela'
    tabela.innerHTML = `
      <thead>
        <tr>
          <th>${visao.agrupadoPorArea ? 'Área de conhecimento' : 'Tema da questão'}</th>
          <th>Questões</th><th>Acerto</th><th>Histórico</th><th>Variação</th><th>Situação</th>
        </tr>
      </thead>`
    const corpo = document.createElement('tbody')

    for (const area of visao.areas) {
      const situacao = SITUACAO[area.situacao] ?? SITUACAO.atencao
      const linha = document.createElement('tr')
      linha.innerHTML = `
        <td>${area.tema}</td>
        <td>${area.questoes}</td>
        <td><strong>${area.percentual.toFixed(1)}%</strong></td>
        <td>${area.percentualHistorico === null ? '—' : `${area.percentualHistorico.toFixed(1)}%`}</td>
        <td>${
          area.variacao === null
            ? '—'
            : `${area.variacao >= 0 ? '+' : '−'}${Math.abs(area.variacao).toFixed(1)} p.p.`
        }</td>
        <td><span class="etiqueta ${situacao?.classe}">${situacao?.texto}</span></td>`
      corpo.append(linha)
    }

    tabela.append(corpo)
    return painel(
      'Ranking',
      'Ordenado da menor para a maior taxa de acerto nesta aplicação.',
      tabela
    )
  }

  function abaMatriz(visao: VisaoAreas): HTMLElement {
    const tabela = document.createElement('table')
    tabela.className = 'matriz'

    const cabecalho = document.createElement('thead')
    cabecalho.innerHTML = `<tr><th>${
      visao.agrupadoPorArea ? 'Área' : 'Tema'
    }</th>${visao.periodos.map((periodo) => `<th>${periodo}</th>`).join('')}</tr>`

    const corpo = document.createElement('tbody')
    for (const linha of visao.matriz) {
      const tr = document.createElement('tr')

      const nome = document.createElement('td')
      nome.textContent = linha.area

      tr.append(nome)

      for (const celula of linha.celulas) {
        const td = document.createElement('td')
        if (celula.percentual === null) {
          td.dataset.vazia = 'true'
          td.textContent = '—'
          td.title = `${linha.area} não foi avaliada no ${celula.periodo} período desta aplicação.`
        } else {
          td.style.background = corDoPercentual(celula.percentual)
          td.textContent = `${celula.percentual.toFixed(0)}%`
          td.title =
            `${linha.area} · ${celula.periodo} período · ${celula.questoes} questão(ões) · ` +
            `${Math.round(celula.respondentes)} respondente(s)`
        }
        tr.append(td)
      }

      corpo.append(tr)
    }

    tabela.append(cabecalho, corpo)

    const legenda = document.createElement('div')
    legenda.className = 'legenda-escala'
    legenda.innerHTML =
      '<span>0% de acerto</span><span class="legenda-escala__barra"></span><span>100%</span>'

    return painel(
      'Matriz período × área',
      'Como cada área se comporta em cada período, na mesma aplicação. Passe o mouse para ver quantas questões sustentam cada célula.',
      tabela,
      legenda
    )
  }

  function abaEvolucao(visao: VisaoAreas): HTMLElement {
    if (visao.evolucao.rotulos.length < 2) {
      return painel(
        'Evolução por aplicação',
        'A série se forma a partir da segunda aplicação importada.',
        avisoSemDados('Apenas uma aplicação importada até aqui.')
      )
    }

    const piores = visao.areas.slice(0, 5)
    const bloco = document.createElement('div')

    for (const area of piores) {
      const serie = visao.evolucao.series.find((item) => item.area === area.tema)
      if (!serie) continue

      const valores = serie.valores.map((ponto) => ponto.percentual ?? 0)
      bloco.append(
        painel(
          area.tema,
          `Acerto por aplicação. Atual: ${area.percentual.toFixed(1)}%.`,
          graficoLinha({ rotulos: visao.evolucao.rotulos, valores }, 160)
        )
      )
    }

    return painel(
      'Evolução das áreas mais críticas',
      'As cinco áreas de menor acerto nesta aplicação, ao longo das aplicações importadas.',
      bloco
    )
  }

  async function desenhar(): Promise<void> {
    container.replaceChildren()

    if (!contexto.cursoId || !contexto.aplicacaoId) {
      container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
      return
    }

    const visao = await window.painel.invocar('painel:visao-areas', {
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
      <h1>Áreas de conhecimento</h1>
      <p>${visao.cursoNome} · aplicação ${visao.aplicacao.rotulo}</p>`
    container.append(cabecalho)

    if (!visao.agrupadoPorArea) {
      const aviso = document.createElement('div')
      aviso.className = 'mensagem mensagem--aviso'
      aviso.textContent =
        'Este curso ainda não agrupou os temas em áreas de conhecimento. A planilha traz um tema ' +
        'por questão, então cada linha abaixo é uma questão — e não uma faixa de conteúdo. ' +
        'O agrupamento é cadastrado em Administração › Cursos e réguas.'
      container.append(aviso)
    } else if (visao.temasSemArea > 0) {
      const aviso = document.createElement('div')
      aviso.className = 'mensagem mensagem--aviso'
      aviso.textContent =
        `${visao.temasSemArea} tema(s) desta aplicação ainda não foram atribuídos a uma área ` +
        'e aparecem reunidos como "Sem área definida".'
      container.append(aviso)
    }

    const abas = montarAbas([
      { id: 'ranking', titulo: 'Ranking', montar: () => abaRanking(visao) },
      { id: 'matriz', titulo: 'Matriz período × área', montar: () => abaMatriz(visao) },
      { id: 'evolucao', titulo: 'Evolução', montar: () => abaEvolucao(visao) }
    ])
    abas.dataset.tour = 'areas-abas'

    container.append(
      abas,
      rodapeFonte(
        'Percentuais calculados sobre os acertos registrados na aplicação. Células vazias indicam ' +
          'que a área não foi avaliada naquele período.'
      )
    )
  }

  void desenhar()
  return container
}
