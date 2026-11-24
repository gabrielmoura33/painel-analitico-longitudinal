import type { ItemHistorico } from '@compartilhado/types/importacao'

import { criarAreaMensagem } from '../componentes/formulario'
import { confirmar } from '../componentes/modal'
import { navegarPara } from '../rotas'

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  concluida: { texto: 'Concluída', classe: 'etiqueta--positiva' },
  concluida_com_avisos: { texto: 'Concluída com avisos', classe: 'etiqueta--atencao' },
  revertida: { texto: 'Revertida', classe: 'etiqueta--neutra' }
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Histórico das importações: é ele que torna auditável a série longitudinal. */
export function montarHistorico(ehAdministrador: boolean): HTMLElement {
  const container = document.createElement('div')
  const mensagem = criarAreaMensagem()

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina cabecalho-pagina--com-acao'
  const titulos = document.createElement('div')
  titulos.innerHTML = `
    <div class="migalhas">Administração › Importações</div>
    <h1>Histórico de importações</h1>
    <p>Cada linha é uma aplicação importada. O acervo é o que forma a série longitudinal.</p>`
  cabecalho.append(titulos)

  if (ehAdministrador) {
    const importar = document.createElement('button')
    importar.className = 'botao'
    importar.type = 'button'
    importar.textContent = 'Importar planilha'
    importar.addEventListener('click', () => navegarPara('/importacoes'))
    cabecalho.append(importar)
  }

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.style.padding = '0'
  cartao.style.overflow = 'hidden'

  const tabela = document.createElement('table')
  tabela.className = 'tabela'
  tabela.dataset.tour = 'historico-tabela'
  tabela.innerHTML = `
    <thead>
      <tr>
        <th>Aplicação</th><th>Curso</th><th>Arquivo</th><th>Importada em</th>
        <th>Períodos</th><th>Discentes</th><th>Registros</th><th>Situação</th><th></th>
      </tr>
    </thead>`
  const corpo = document.createElement('tbody')
  tabela.append(corpo)
  cartao.append(tabela)

  function montarLinha(item: ItemHistorico): HTMLTableRowElement {
    const linha = document.createElement('tr')
    const status = ROTULO_STATUS[item.status] ?? { texto: item.status, classe: 'etiqueta--neutra' }

    const celulas: Array<string | HTMLElement> = [
      item.rotulo,
      item.cursoNome,
      item.arquivoOriginal,
      formatarDataHora(item.dataImportacao),
      item.periodos.join(', '),
      String(item.totalDiscentes),
      item.totalRegistros.toLocaleString('pt-BR')
    ]

    for (const valor of celulas) {
      const celula = document.createElement('td')
      if (typeof valor === 'string') celula.textContent = valor
      else celula.append(valor)
      linha.append(celula)
    }

    const situacao = document.createElement('td')
    situacao.innerHTML = `<span class="etiqueta ${status.classe}">${status.texto}</span>`
    linha.append(situacao)

    const acoes = document.createElement('td')
    const grupo = document.createElement('div')
    grupo.className = 'acoes-linha'

    const relatorio = document.createElement('button')
    relatorio.className = 'botao--texto'
    relatorio.type = 'button'
    relatorio.textContent = `Relatório (${item.ocorrencias.length})`
    relatorio.addEventListener('click', async () => {
      const conteudo = document.createElement('div')
      if (item.ocorrencias.length === 0) {
        conteudo.textContent = 'Nenhuma ocorrência registrada nesta importação.'
      }
      for (const ocorrencia of item.ocorrencias) {
        const bloco = document.createElement('div')
        bloco.className = 'ocorrencia'
        bloco.dataset.severidade = ocorrencia.severidade
        bloco.innerHTML = `<div class="ocorrencia__mensagem">${ocorrencia.mensagem}</div>`
        if (ocorrencia.detalhes?.length) {
          const lista = document.createElement('ul')
          lista.className = 'ocorrencia__detalhes'
          for (const detalhe of ocorrencia.detalhes.slice(0, 10)) {
            const linhaDetalhe = document.createElement('li')
            linhaDetalhe.textContent = detalhe
            lista.append(linhaDetalhe)
          }
          bloco.append(lista)
        }
        conteudo.append(bloco)
      }

      await confirmar({
        titulo: `Relatório de ${item.rotulo}`,
        conteudo,
        rotuloConfirmar: 'Fechar',
        rotuloCancelar: null as unknown as string
      })
    })
    grupo.append(relatorio)

    if (ehAdministrador) {
      const excluir = document.createElement('button')
      excluir.className = 'botao--texto'
      excluir.type = 'button'
      excluir.dataset.perigo = 'true'
      excluir.textContent = 'Excluir'
      excluir.addEventListener('click', async () => {
        const primeira = await confirmar({
          titulo: `Excluir a importação de ${item.rotulo}?`,
          texto:
            `Os ${item.totalRegistros.toLocaleString('pt-BR')} registros de desempenho desta ` +
            'aplicação serão apagados e ela deixará de aparecer nos painéis.',
          rotuloConfirmar: 'Continuar',
          perigo: true
        })
        if (!primeira) return

        const segunda = await confirmar({
          titulo: 'Confirmar exclusão',
          texto:
            'Esta ação não pode ser desfeita. Para recuperar a aplicação será preciso importar ' +
            'a planilha novamente.',
          rotuloConfirmar: 'Excluir definitivamente',
          perigo: true
        })
        if (!segunda) return

        const resposta = await window.painel.invocar('importacao:excluir', {
          aplicacaoId: item._id
        })
        if (!resposta.sucesso) {
          mensagem.mostrar(resposta.mensagem ?? 'Não foi possível excluir.')
          return
        }
        await recarregar()
      })
      grupo.append(excluir)
    }

    acoes.append(grupo)
    linha.append(acoes)
    return linha
  }

  async function recarregar(): Promise<void> {
    mensagem.esconder()
    const itens = await window.painel.invocar('importacao:historico', undefined)
    corpo.replaceChildren()

    if (itens.length === 0) {
      const linha = document.createElement('tr')
      const celula = document.createElement('td')
      celula.colSpan = 9
      celula.style.textAlign = 'center'
      celula.style.color = 'var(--cor-texto-suave)'
      celula.style.padding = 'var(--espaco-6)'
      celula.textContent = 'Nenhuma planilha importada ainda.'
      linha.append(celula)
      corpo.append(linha)
      return
    }

    for (const item of itens) corpo.append(montarLinha(item))
  }

  container.append(cabecalho, mensagem.elemento, cartao)
  void recarregar()
  return container
}
