import type { ContextoPainel } from '@compartilhado/types/indicadores'

import { graficoBarras, graficoLinha } from '../componentes/graficos'
import {
  avisoSemDados,
  barraDistribuicao,
  cartaoKpi,
  painel,
  rodapeFonte,
  variacaoEmTexto
} from '../componentes/painel'

const SITUACAO: Record<string, { texto: string; classe: string }> = {
  critica: { texto: 'Crítica', classe: 'etiqueta--atencao' },
  atencao: { texto: 'Atenção', classe: 'etiqueta--neutra' },
  boa: { texto: 'Boa', classe: 'etiqueta--positiva' }
}

/**
 * Visão geral do curso.
 *
 * Mantém a estrutura do mockup aprovado pelas docentes, com os indicadores
 * que a planilha realmente sustenta: percentual de acerto, nota pela régua do
 * curso e comparação entre componentes. Taxa de evasão, taxa de aprovação e
 * média por disciplina não existem na fonte e por isso não aparecem.
 */
export function montarVisaoGeral(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina'
  container.append(cabecalho)

  async function desenhar(): Promise<void> {
    if (!contexto.cursoId || !contexto.aplicacaoId) {
      cabecalho.innerHTML = '<h1>Visão geral</h1>'
      container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
      return
    }

    const visao = await window.painel.invocar('painel:visao-geral', {
      cursoId: contexto.cursoId,
      aplicacaoId: contexto.aplicacaoId
    })

    if (!visao) {
      cabecalho.innerHTML = '<h1>Visão geral</h1>'
      container.append(avisoSemDados('Não encontrei dados para esta aplicação.'))
      return
    }

    cabecalho.innerHTML = `
      <h1>Visão geral do curso de ${visao.cursoNome}</h1>
      <p>Teste de Progresso · aplicação ${visao.aplicacao.rotulo}</p>`

    const kpis = document.createElement('div')
    kpis.className = 'kpis'
    kpis.dataset.tour = 'visao-kpis'
    kpis.append(
      cartaoKpi(
        `Acerto médio ${visao.aplicacao.rotulo}`,
        `${visao.kpis.percentualMedio.toFixed(1)}%`,
        variacaoEmTexto(visao.variacao.percentualMedio, ' p.p.')
      ),
      cartaoKpi(
        'Total de acertos (média)',
        `${visao.kpis.acertosMedios.toFixed(1)}`,
        { texto: `de ${visao.kpis.totalQuestoes} questões` }
      ),
      cartaoKpi(
        'Nota média pela régua',
        visao.kpis.notaMedia.toFixed(2),
        variacaoEmTexto(visao.variacao.notaMedia, '')
      ),
      cartaoKpi('Discentes avaliados', String(visao.kpis.totalDiscentes), {
        texto: `${visao.porPeriodo.length} períodos`
      }),
      cartaoKpi('Áreas críticas', String(visao.kpis.areasCriticas), {
        texto: 'abaixo de 50% de acerto',
        sinal: visao.kpis.areasCriticas > 0 ? 'negativo' : 'positivo'
      })
    )
    container.append(kpis)

    if (visao.porComponente.length >= 2) {
      const componentes = document.createElement('div')
      componentes.className = 'kpis'
      componentes.dataset.tour = 'visao-componentes'
      for (const componente of visao.porComponente) {
        componentes.append(
          cartaoKpi(componente.nome, `${componente.percentual.toFixed(1)}%`, {
            texto: `${componente.questoes} questões`
          })
        )
      }
      container.append(componentes)
    }

    const graficos = document.createElement('div')
    graficos.className = 'graficos'
    graficos.dataset.tour = 'visao-graficos'
    graficos.append(
      painel(
        'Acerto médio por aplicação',
        visao.serie.length > 1
          ? 'Série longitudinal formada pelo acúmulo das importações.'
          : 'Uma única aplicação importada. A série se forma à medida que novas entram.',
        graficoLinha({
          rotulos: visao.serie.map((ponto) => ponto.rotulo),
          valores: visao.serie.map((ponto) => ponto.percentualMedio)
        })
      ),
      painel(
        'Acerto médio por período',
        `Desempenho de cada período nesta aplicação.`,
        graficoBarras({
          rotulos: visao.porPeriodo.map((linha) => linha.periodo),
          valores: visao.porPeriodo.map((linha) => linha.percentualMedio)
        })
      )
    )
    container.append(graficos)

    const distribuicao = document.createElement('div')
    for (const faixa of visao.distribuicaoNotas) {
      distribuicao.append(
        barraDistribuicao(
          `Nota ${faixa.nota}`,
          faixa.percentual,
          `${faixa.quantidade} (${faixa.percentual.toFixed(0)}%)`,
          faixa.nota <= 4 ? 'baixa' : faixa.nota <= 7 ? 'media' : 'alta'
        )
      )
    }

    const destaques = document.createElement('div')
    for (const destaque of visao.destaques) {
      const bloco = document.createElement('div')
      bloco.className = 'destaque'
      bloco.innerHTML = `
        <span class="destaque__marca" data-tipo="${destaque.tipo}">${
          destaque.tipo === 'acima' ? 'ACIMA' : destaque.tipo === 'atencao' ? 'ATENÇÃO' : 'DESTAQUE'
        }</span>
        <span>
          <span class="destaque__titulo">${destaque.titulo}</span>
          <span class="destaque__detalhe">${destaque.detalhe}</span>
        </span>`
      destaques.append(bloco)
    }

    const duasColunas = document.createElement('div')
    duasColunas.className = 'graficos'
    duasColunas.dataset.tour = 'visao-destaques'
    duasColunas.append(
      painel(
        `Distribuição das notas calculadas · ${visao.aplicacao.rotulo}`,
        'A planilha traz o total de acertos, nunca a nota: cada resultado foi ' +
          'convertido aqui pela régua do curso.',
        distribuicao
      ),
      painel('Destaques da aplicação', 'Calculados a partir dos dados importados.', destaques)
    )
    container.append(duasColunas)

    const tabela = document.createElement('table')
    tabela.className = 'tabela'
    tabela.innerHTML = `
      <thead>
        <tr>
          <th>Área de conhecimento</th><th>Questões</th><th>Acerto</th>
          <th>Histórico</th><th>Variação</th><th>Situação</th>
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

    const painelAreas = painel(
      'Áreas de conhecimento',
      'Ordenadas da menor para a maior taxa de acerto nesta aplicação.',
      tabela
    )
    painelAreas.dataset.tour = 'visao-areas'

    container.append(
      painelAreas,
      rodapeFonte(
        `Fonte: planilha do Teste de Progresso importada em ` +
          `${new Date(visao.aplicacao.dataImportacao).toLocaleDateString('pt-BR')}. ` +
          'Indicadores calculados sobre os acertos registrados; a plataforma não estima dados ausentes.'
      )
    )
  }

  void desenhar()
  return container
}
