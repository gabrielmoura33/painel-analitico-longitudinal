import type { ContextoPainel, VisaoDiscente } from '@compartilhado/types/indicadores'

import { criarCampo } from '../componentes/formulario'
import { graficoLinha } from '../componentes/graficos'
import { avisoSemDados, cartaoKpi, painel, rodapeFonte } from '../componentes/painel'

/**
 * Ficha longitudinal do discente.
 *
 * É a única tela que mostra o nome real: nas visões coletivas o discente
 * aparece sempre pseudonimizado. Cada abertura fica registrada no log da
 * aplicação.
 */
export function montarVisaoDiscente(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')
  const area = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina'
  cabecalho.innerHTML = `
    <h1>Discente</h1>
    <p>Trajetória de uma pessoa ao longo das aplicações do Teste de Progresso.</p>`

  const busca = criarCampo({
    rotulo: 'Buscar discente',
    tipo: 'search',
    placeholder: 'Nome ou pseudônimo (ex.: ENF-012)'
  })
  busca.elemento.dataset.tour = 'discente-busca'

  const resultados = document.createElement('div')
  resultados.className = 'resultado-busca'
  resultados.hidden = true

  let temporizador: ReturnType<typeof setTimeout> | undefined

  busca.entrada.addEventListener('input', () => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(() => void procurar(), 250)
  })

  async function procurar(): Promise<void> {
    if (!contexto.cursoId) return
    const encontrados = await window.painel.invocar('painel:buscar-discentes', {
      cursoId: contexto.cursoId,
      termo: busca.valor()
    })

    resultados.replaceChildren()
    resultados.hidden = encontrados.length === 0

    for (const discente of encontrados) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'resultado-busca__item'
      item.innerHTML =
        `<strong>${discente.nomeCompleto}</strong> · ` +
        `${discente.matricula ?? 'sem matrícula'} · ` +
        `${discente.pseudonimo} · ${discente.aplicacoes} aplicação(ões)`
      item.addEventListener('click', () => {
        resultados.hidden = true
        busca.entrada.value = discente.nomeCompleto
        void abrir(discente._id)
      })
      resultados.append(item)
    }
  }

  function montarFicha(visao: VisaoDiscente): HTMLElement {
    const bloco = document.createElement('div')

    const identificacao = document.createElement('div')
    identificacao.className = 'cabecalho-pagina'
    identificacao.innerHTML = `
      <h1>${visao.nomeCompleto}</h1>
      <p>${visao.cursoNome} · matrícula ${visao.matricula ?? 'não informada'} · ` +
      `${visao.pseudonimo} · ${visao.trajetoria.length} aplicação(ões)</p>`
    bloco.append(identificacao)

    if (visao.ultimo) {
      const kpis = document.createElement('div')
      kpis.className = 'kpis'
      kpis.append(
        cartaoKpi(
          `Total de acertos em ${visao.ultimo.rotulo}`,
          `${visao.ultimo.acertos}/${visao.ultimo.totalQuestoes}`,
          { texto: `${visao.ultimo.percentual.toFixed(1)}% de acerto` }
        ),
        cartaoKpi('Nota pela régua', String(visao.ultimo.nota), {
          texto: 'calculada: a planilha traz acertos'
        }),
        cartaoKpi('Posição na turma', `${visao.ultimo.percentil.toFixed(0)}º percentil`, {
          texto: 'acima deste percentual da turma'
        }),
        ...visao.ultimo.porComponente.map((componente) =>
          cartaoKpi(componente.nome, `${componente.percentual.toFixed(0)}%`, {
            texto: `${componente.questoes} questões`
          })
        )
      )
      bloco.append(kpis)
    }

    if (visao.trajetoria.length > 0) {
      bloco.append(
        painel(
          'Trajetória',
          'Acerto do discente em cada aplicação, com a média da turma do mesmo período como referência.',
          graficoLinha({
            rotulos: visao.trajetoria.map((ponto) => `${ponto.rotulo} (${ponto.periodo})`),
            valores: visao.trajetoria.map((ponto) => ponto.percentual),
            comparacao: {
              nome: 'Média da turma',
              valores: visao.trajetoria.map((ponto) => ponto.percentualDaTurma)
            }
          })
        )
      )
    }

    const atencao = visao.alertas.filter((alerta) => alerta.tipo === 'atencao')
    const evolucao = visao.alertas.filter((alerta) => alerta.tipo === 'evolucao')

    const montarAlertas = (lista: typeof visao.alertas, vazio: string): HTMLElement => {
      const caixa = document.createElement('div')
      caixa.className = 'alerta-lista'
      if (lista.length === 0) {
        caixa.append(avisoSemDados(vazio))
        return caixa
      }
      for (const alerta of lista) {
        const item = document.createElement('div')
        item.className = 'destaque'
        item.innerHTML = `
          <span class="destaque__marca" data-tipo="${alerta.tipo === 'atencao' ? 'atencao' : 'acima'}">${
            alerta.tipo === 'atencao' ? 'ATENÇÃO' : 'EVOLUÇÃO'
          }</span>
          <span>
            <span class="destaque__titulo">${alerta.titulo}</span>
            <span class="destaque__detalhe">${alerta.detalhe}</span>
          </span>`
        caixa.append(item)
      }
      return caixa
    }

    const duas = document.createElement('div')
    duas.className = 'graficos'
    duas.append(
      painel(
        'Pontos de atenção',
        'Áreas abaixo de 50% na última aplicação, ou com queda de 20 pontos percentuais ou mais.',
        montarAlertas(
          atencao,
          visao.trajetoria.length < 2
            ? 'Nenhuma área abaixo de 50%. A comparação entre aplicações começa na segunda.'
            : 'Nenhuma área abaixo de 50% nem com queda de 20 pontos percentuais ou mais.'
        )
      ),
      painel(
        'Evolução',
        'Áreas com alta de 20 pontos percentuais ou mais em relação à aplicação anterior.',
        montarAlertas(
          evolucao,
          visao.trajetoria.length < 2
            ? 'A comparação entre aplicações começa na segunda importação.'
            : 'Nenhuma área subiu 20 pontos percentuais ou mais. A tabela abaixo traz todas as variações.'
        )
      )
    )
    bloco.append(duas)

    if (visao.areas.length > 0) {
      const rotulos = visao.trajetoria.map((ponto) => ponto.rotulo)
      const tabela = document.createElement('table')
      tabela.className = 'tabela tabela--compacta'
      tabela.innerHTML = `
        <thead>
          <tr>
            <th>Área</th>${rotulos.map((rotulo) => `<th>${rotulo}</th>`).join('')}
            <th>Média da turma</th><th>Variação</th>
          </tr>
        </thead>`
      const corpo = document.createElement('tbody')

      for (const area of visao.areas) {
        const linha = document.createElement('tr')
        const celulas = area.valores
          .map((valor) => `<td>${valor.percentual === null ? '—' : `${valor.percentual.toFixed(0)}%`}</td>`)
          .join('')
        const variacao =
          area.variacao === null
            ? '—'
            : `${area.variacao >= 0 ? '+' : '−'}${Math.abs(area.variacao).toFixed(0)} p.p.`
        linha.innerHTML = `
          <td>${area.area}</td>${celulas}
          <td>${area.mediaDaTurma === null ? '—' : `${area.mediaDaTurma.toFixed(0)}%`}</td>
          <td>${variacao}</td>`
        corpo.append(linha)
      }

      tabela.append(corpo)
      bloco.append(
        painel('Evolução por área', 'Acerto do discente em cada área, aplicação a aplicação.', tabela)
      )
    }

    bloco.append(
      rodapeFonte(
        'Esta é a única tela que exibe o nome real do discente; nas visões de turma ele aparece ' +
          'pseudonimizado. O acesso a esta ficha fica registrado.'
      )
    )

    return bloco
  }

  async function abrir(discenteId: string): Promise<void> {
    if (!contexto.cursoId) return
    const visao = await window.painel.invocar('painel:visao-discente', {
      cursoId: contexto.cursoId,
      discenteId
    })
    area.replaceChildren(visao ? montarFicha(visao) : avisoSemDados('Discente não encontrado.'))
  }

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
    return container
  }

  const buscaPainel = painel(
    'Localizar',
    'Busque por nome completo ou pelo pseudônimo que aparece nas visões de turma.',
    busca.elemento,
    resultados
  )

  container.append(cabecalho, buscaPainel, area)
  return container
}
