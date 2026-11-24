import type { ContextoPainel } from '@compartilhado/types/indicadores'

import { avisoSemDados, painel, rodapeFonte } from '../componentes/painel'

/**
 * Desempenho das questões por docente responsável.
 *
 * Leitura de calibragem do instrumento, não avaliação de desempenho docente:
 * os docentes que constam da planilha são autores das questões, e não usuários
 * da plataforma.
 */
export function montarVisaoDocentes(contexto: ContextoPainel): HTMLElement {
  const container = document.createElement('div')

  async function desenhar(): Promise<void> {
    container.replaceChildren()

    if (!contexto.cursoId || !contexto.aplicacaoId) {
      container.append(avisoSemDados('Nenhuma aplicação importada ainda.'))
      return
    }

    const visao = await window.painel.invocar('painel:visao-docentes', {
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
      <h1>Docentes responsáveis</h1>
      <p>${visao.cursoNome} · aplicação ${visao.aplicacao.rotulo}</p>`
    container.append(cabecalho)

    const tabela = document.createElement('table')
    tabela.className = 'tabela'
    tabela.dataset.tour = 'docentes-tabela'
    tabela.innerHTML = `
      <thead>
        <tr>
          <th>Docente</th><th>Questões</th><th>Acerto médio</th>
          <th>Questão com menor acerto</th><th>Questão com maior acerto</th><th>Áreas</th>
        </tr>
      </thead>`
    const corpo = document.createElement('tbody')

    for (const docente of visao.docentes) {
      const linha = document.createElement('tr')
      linha.innerHTML = `
        <td><strong>${docente.docente}</strong></td>
        <td>${docente.questoes}</td>
        <td>${docente.percentualMedio.toFixed(1)}%</td>
        <td>${
          docente.pior
            ? `#${docente.pior.numero} · ${docente.pior.percentual.toFixed(0)}% <span class="faixas">${docente.pior.tema}</span>`
            : '—'
        }</td>
        <td>${
          docente.melhor
            ? `#${docente.melhor.numero} · ${docente.melhor.percentual.toFixed(0)}% <span class="faixas">${docente.melhor.tema}</span>`
            : '—'
        }</td>
        <td class="faixas">${docente.areas.join(', ')}</td>`
      corpo.append(linha)
    }

    tabela.append(corpo)

    container.append(
      painel(
        'Questões por docente',
        'Ordenado do menor para o maior acerto médio das questões de cada autoria.',
        tabela
      ),
      rodapeFonte(
        'Esta tela lê a calibragem do instrumento e os temas que pedem reforço. Não é avaliação ' +
          'de desempenho docente: os nomes que constam da planilha são os autores das questões, ' +
          'não usuários da plataforma.'
      )
    )
  }

  void desenhar()
  return container
}
