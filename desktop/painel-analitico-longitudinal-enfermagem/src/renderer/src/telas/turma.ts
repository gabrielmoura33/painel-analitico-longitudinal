import type { ContextoPainel } from '@compartilhado/types/indicadores'

import { graficoBarras } from '../componentes/graficos'
import {
  avisoSemDados,
  barraDistribuicao,
  caixaDispersao,
  cartaoKpi,
  painel,
  rodapeFonte
} from '../componentes/painel'

/**
 * Visão de turma, por período.
 *
 * Toda a listagem é pseudonimizada: o nome real do discente só aparece na
 * ficha individual, conforme a decisão de projeto sobre a LGPD.
 */
export function montarVisaoTurma(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')
  let periodo: string | undefined

  async function desenhar(): Promise<void> {
    container.replaceChildren()

    if (!contexto.cursoId || !contexto.aplicacaoId) {
      container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
      return
    }

    const visao = await window.painel.invocar('painel:visao-turma', {
      cursoId: contexto.cursoId,
      aplicacaoId: contexto.aplicacaoId,
      periodo
    })

    if (!visao) {
      container.append(avisoSemDados('Não encontrei dados para esta aplicação.'))
      return
    }

    periodo = visao.periodo

    const cabecalho = document.createElement('div')
    cabecalho.className = 'cabecalho-pagina cabecalho-pagina--com-acao'
    const titulos = document.createElement('div')
    titulos.innerHTML = `
      <h1>Turma do ${visao.periodo} período</h1>
      <p>${visao.cursoNome} · aplicação ${visao.aplicacao.rotulo}</p>`

    const seletor = document.createElement('select')
    seletor.className = 'campo__controle campo__controle--medio'
    seletor.dataset.tour = 'turma-periodo'
    seletor.replaceChildren(
      ...visao.periodosDisponiveis.map((item) => {
        const opcao = document.createElement('option')
        opcao.value = item
        opcao.textContent = `${item} período`
        return opcao
      })
    )
    seletor.value = visao.periodo
    seletor.addEventListener('change', () => {
      periodo = seletor.value
      void desenhar()
    })

    cabecalho.append(titulos, seletor)
    container.append(cabecalho)

    const kpis = document.createElement('div')
    kpis.className = 'kpis'
    kpis.dataset.tour = 'turma-kpis'
    kpis.append(
      cartaoKpi('Discentes avaliados', String(visao.kpis.totalDiscentes)),
      cartaoKpi('Total de acertos (média)', visao.kpis.acertosMedios.toFixed(1), {
        texto: `de ${visao.kpis.totalQuestoes} questões`
      }),
      cartaoKpi('Acerto médio', `${visao.kpis.percentualMedio.toFixed(1)}%`),
      cartaoKpi('Nota média pela régua', visao.kpis.notaMedia.toFixed(2), {
        texto: 'calculada: a planilha traz acertos'
      }),
      cartaoKpi('Acima do mínimo do período', `${visao.kpis.percentualAcimaDoMinimo.toFixed(0)}%`, {
        texto: 'conforme a régua do curso'
      })
    )
    container.append(kpis)

    const histograma = document.createElement('div')
    for (const faixa of visao.histograma) {
      const percentual =
        visao.kpis.totalDiscentes > 0 ? (faixa.quantidade / visao.kpis.totalDiscentes) * 100 : 0
      histograma.append(
        barraDistribuicao(
          faixa.faixa,
          percentual,
          `${faixa.quantidade} discente(s)`,
          faixa.faixa.startsWith('0') || faixa.faixa.startsWith('20')
            ? 'baixa'
            : faixa.faixa.startsWith('40')
              ? 'media'
              : 'alta'
        )
      )
    }

    const comparativo = painel(
      'Comparação entre períodos',
      'Mesma prova, períodos diferentes — o que torna a comparação possível.',
      graficoBarras({
        rotulos: visao.comparativoPeriodos.map((linha) => linha.periodo),
        valores: visao.comparativoPeriodos.map((linha) => linha.percentualMedio),
        destaque: visao.comparativoPeriodos.findIndex((linha) => linha.periodo === visao.periodo)
      })
    )

    const duasColunas = document.createElement('div')
    duasColunas.className = 'graficos'
    duasColunas.append(
      painel(
        'Distribuição dos acertos na turma',
        'Quantos discentes caíram em cada faixa de acerto.',
        histograma
      ),
      comparativo
    )
    container.append(duasColunas)

    const tabelaDispersao = document.createElement('table')
    tabelaDispersao.className = 'tabela tabela--compacta'
    tabelaDispersao.innerHTML =
      '<thead><tr><th style="width:280px">Área</th><th>Dispersão da turma (0 a 100%)</th><th>Média</th></tr></thead>'
    const corpoDispersao = document.createElement('tbody')

    for (const area of visao.dispersaoPorArea.slice(0, 12)) {
      const linha = document.createElement('tr')

      const tema = document.createElement('td')
      tema.textContent = area.tema

      const grafico = document.createElement('td')
      grafico.append(caixaDispersao(area))

      const media = document.createElement('td')
      media.innerHTML = `<strong>${area.media.toFixed(0)}%</strong>`

      linha.append(tema, grafico, media)
      corpoDispersao.append(linha)
    }
    tabelaDispersao.append(corpoDispersao)

    const painelDispersao = painel(
      'Heterogeneidade da turma por área',
      'Cada barra vai do menor ao maior acerto individual; a caixa cobre a metade central e o traço marca a mediana. ' +
        'É o que a média sozinha esconde. Mostrando as 12 áreas de menor média.',
      tabelaDispersao
    )
    painelDispersao.dataset.tour = 'turma-dispersao'
    container.append(painelDispersao)

    const tabela = document.createElement('table')
    tabela.className = 'tabela'
    const componentes = visao.discentes[0]?.porComponente.map((item) => item.nome) ?? []
    tabela.innerHTML = `
      <thead>
        <tr>
          <th>Discente</th><th>Total de acertos</th><th>% de acerto</th><th>Nota (régua)</th>
          <th>Variação</th>${componentes.map((nome) => `<th>${nome}</th>`).join('')}
        </tr>
      </thead>`
    const corpo = document.createElement('tbody')

    for (const discente of visao.discentes) {
      const linha = document.createElement('tr')
      const porComponente = new Map(
        discente.porComponente.map((item) => [item.nome, item.percentual])
      )
      linha.innerHTML = `
        <td><strong>${discente.pseudonimo}</strong></td>
        <td>${discente.acertos}/${discente.totalQuestoes}</td>
        <td>${discente.percentual.toFixed(1)}%</td>
        <td>${discente.nota}</td>
        <td>${
          discente.variacao === null
            ? '—'
            : `${discente.variacao >= 0 ? '+' : '−'}${Math.abs(discente.variacao).toFixed(1)} p.p.`
        }</td>
        ${componentes
          .map((nome) => `<td>${(porComponente.get(nome) ?? 0).toFixed(0)}%</td>`)
          .join('')}`
      corpo.append(linha)
    }
    tabela.append(corpo)

    const painelDiscentes = painel(
      'Discentes do período',
      'Identificados por pseudônimo, conforme a Lei 13.709/2018. O nome real aparece apenas na ficha individual.',
      tabela
    )
    painelDiscentes.dataset.tour = 'turma-discentes'

    container.append(
      painelDiscentes,
      rodapeFonte(
        'A variação compara cada discente com o próprio resultado na aplicação anterior. ' +
          'Quem não tem resultado anterior aparece sem variação, e não com zero.'
      )
    )
  }

  void desenhar()
  return container
}
