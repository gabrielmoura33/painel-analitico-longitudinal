import type { Curso, OcorrenciaImportacao } from '@compartilhado/types/dominio'
import type {
  AnaliseImportacao,
  ClusterGrafiaDTO,
  DecisoesImportacao,
  ResumoCarga
} from '@compartilhado/types/importacao'

import { criarAreaMensagem, criarCampo } from '../componentes/formulario'
import { navegarPara } from '../rotas'

const ROTULOS_PASSO = ['Arquivo', 'Reconhecimento', 'Validação', 'Confirmação']

function formatar(numero: number): string {
  return numero.toLocaleString('pt-BR')
}

function montarOcorrencia(ocorrencia: OcorrenciaImportacao): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'ocorrencia'
  bloco.dataset.severidade = ocorrencia.severidade

  const mensagem = document.createElement('div')
  mensagem.className = 'ocorrencia__mensagem'
  mensagem.textContent = ocorrencia.mensagem
  bloco.append(mensagem)

  if (ocorrencia.detalhes && ocorrencia.detalhes.length > 0) {
    const detalhes = document.createElement('ul')
    detalhes.className = 'ocorrencia__detalhes'
    for (const detalhe of ocorrencia.detalhes.slice(0, 12)) {
      const item = document.createElement('li')
      item.textContent = detalhe
      detalhes.append(item)
    }
    if (ocorrencia.detalhes.length > 12) {
      const resto = document.createElement('li')
      resto.textContent = `… e mais ${ocorrencia.detalhes.length - 12}.`
      detalhes.append(resto)
    }
    bloco.append(detalhes)
  }

  return bloco
}

/**
 * Assistente de importação de planilha, em quatro passos.
 *
 * Os três primeiros passos não gravam nada: leem, reconhecem e validam. A
 * escrita acontece só no quarto, depois que o usuário confirma — e dentro de
 * uma transação, de modo que ou a aplicação entra inteira ou nada entra.
 */
export function montarImportacao(aoImportar: () => Promise<void>): HTMLElement {
  const container = document.createElement('div')
  const mensagem = criarAreaMensagem()

  let passo = 1
  let cursos: Curso[] = []
  let cursoId = ''
  let caminho = ''
  let nomeArquivo = ''
  let analise: AnaliseImportacao | null = null
  let resultado: ResumoCarga | null = null
  let ocorrenciasFinais: OcorrenciaImportacao[] = []

  const periodosPorAba = new Map<string, string>()
  const abasSelecionadas = new Set<string>()
  const unificacoesAceitas = new Map<string, ClusterGrafiaDTO>()
  let substituirAnterior = false

  function adotarArquivo(arquivo: File): void {
    const caminhoReal = window.painel.caminhoDoArquivo(arquivo)
    if (!caminhoReal) {
      mensagem.mostrar('Não consegui localizar este arquivo no disco. Tente escolhê-lo pelo botão.')
      return
    }
    if (!caminhoReal.toLowerCase().endsWith('.xlsx')) {
      mensagem.mostrar('A planilha precisa estar no formato .xlsx.')
      return
    }
    mensagem.esconder()
    caminho = caminhoReal
    nomeArquivo = arquivo.name
    desenhar()
  }

  const campoRotulo = criarCampo({
    rotulo: 'Aplicação',
    placeholder: '2025/2',
    dica: 'Ano e semestre da aplicação, no formato ano/semestre.'
  })

  function trilha(): HTMLElement {
    const trilha = document.createElement('div')
    trilha.className = 'passos'
    trilha.dataset.tour = 'importacao-passos'
    ROTULOS_PASSO.forEach((rotulo, indice) => {
      const item = document.createElement('div')
      item.className = 'passo'
      item.dataset.estado = indice + 1 === passo ? 'atual' : indice + 1 < passo ? 'concluido' : 'futuro'
      item.innerHTML = `<span class="passo__numero">Passo ${indice + 1}</span>${rotulo}`
      trilha.append(item)
    })
    return trilha
  }

  // ---------- passo 1 ----------

  function montarPasso1(): HTMLElement {
    const bloco = document.createElement('div')

    const zona = document.createElement('div')
    zona.className = 'zona-arquivo'
    zona.dataset.tour = 'importacao-arquivo'
    zona.innerHTML = `
      <div class="zona-arquivo__titulo">${
        caminho ? nomeArquivo : 'Arraste a planilha .xlsx ou clique para selecionar'
      }</div>
      <p class="zona-arquivo__dica">${
        caminho ? caminho : 'Arquivo exportado pelo curso, com uma aba por período.'
      }</p>`

    // Campo de arquivo escondido: atende tanto o clique quanto o teclado.
    const entradaArquivo = document.createElement('input')
    entradaArquivo.type = 'file'
    entradaArquivo.accept = '.xlsx'
    entradaArquivo.className = 'zona-arquivo__entrada'
    entradaArquivo.hidden = true
    entradaArquivo.addEventListener('change', () => {
      const arquivo = entradaArquivo.files?.[0]
      if (arquivo) adotarArquivo(arquivo)
    })

    const escolher = document.createElement('button')
    escolher.type = 'button'
    escolher.className = 'botao botao--secundario'
    escolher.textContent = caminho ? 'Trocar arquivo' : 'Escolher arquivo'
    escolher.addEventListener('click', () => entradaArquivo.click())

    zona.addEventListener('dragover', (evento) => {
      evento.preventDefault()
      zona.dataset.arrastando = 'true'
    })
    zona.addEventListener('dragleave', () => {
      zona.dataset.arrastando = 'false'
    })
    zona.addEventListener('drop', (evento) => {
      evento.preventDefault()
      zona.dataset.arrastando = 'false'
      const arquivo = evento.dataTransfer?.files?.[0]
      if (arquivo) adotarArquivo(arquivo)
    })

    zona.append(escolher, entradaArquivo)

    const seletorCurso = document.createElement('select')
    seletorCurso.className = 'campo__controle'
    seletorCurso.replaceChildren(
      ...cursos.map((curso) => {
        const opcao = document.createElement('option')
        opcao.value = curso._id
        opcao.textContent = `${curso.nome} (${curso.sigla})`
        return opcao
      })
    )
    seletorCurso.value = cursoId
    seletorCurso.addEventListener('change', () => (cursoId = seletorCurso.value))

    const campoCurso = document.createElement('div')
    campoCurso.className = 'campo'
    campoCurso.innerHTML = '<div class="campo__cabecalho"><span class="campo__rotulo">Curso</span></div>'
    campoCurso.append(seletorCurso)

    const grade = document.createElement('div')
    grade.className = 'grade-2'
    grade.append(campoCurso, campoRotulo.elemento)

    const analisar = document.createElement('button')
    analisar.className = 'botao'
    analisar.type = 'button'
    analisar.textContent = 'Analisar arquivo'
    analisar.disabled = !caminho || cursos.length === 0
    analisar.addEventListener('click', async () => {
      mensagem.esconder()
      analisar.disabled = true
      analisar.textContent = 'Analisando…'

      const resposta = await window.painel.invocar('importacao:analisar', {
        caminho,
        cursoId,
        rotulo: campoRotulo.valor()
      })

      analisar.disabled = false
      analisar.textContent = 'Analisar arquivo'

      if ('erro' in resposta) {
        mensagem.mostrar(resposta.erro)
        return
      }

      analise = resposta
      periodosPorAba.clear()
      abasSelecionadas.clear()
      unificacoesAceitas.clear()
      substituirAnterior = false

      for (const aba of resposta.abas) {
        if (aba.tipo !== 'desempenho') continue
        abasSelecionadas.add(aba.nome)
        if (aba.periodoSugerido) periodosPorAba.set(aba.nome, aba.periodoSugerido)
      }

      passo = 2
      desenhar()
    })

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'
    acoes.append(analisar)

    if (cursos.length === 0) {
      const aviso = document.createElement('div')
      aviso.className = 'mensagem mensagem--erro'
      aviso.textContent =
        'Nenhum curso cadastrado. Cadastre o curso e o perfil de importação antes de importar planilhas.'
      bloco.append(aviso)
    }

    bloco.append(zona, grade, acoes)
    return bloco
  }

  // ---------- passo 2 ----------

  function montarPasso2(): HTMLElement {
    const bloco = document.createElement('div')
    if (!analise) return bloco

    const curso = cursos.find((item) => item._id === cursoId)
    const periodosDoCurso = curso?.estrutura.periodos ?? []

    const explicacao = document.createElement('p')
    explicacao.className = 'secao__descricao'
    explicacao.textContent =
      'O reconhecimento é sugestão: confira o período de cada aba e desmarque o que não deve entrar.'

    const tabela = document.createElement('table')
    tabela.className = 'tabela tabela--compacta'
    tabela.innerHTML =
      '<thead><tr><th>Importar</th><th>Aba</th><th>Interpretação</th><th>Questões</th><th>Discentes</th><th>Período</th></tr></thead>'
    const corpo = document.createElement('tbody')

    for (const aba of analise.abas) {
      const linha = document.createElement('tr')

      const marcar = document.createElement('td')
      if (aba.tipo === 'desempenho') {
        const caixa = document.createElement('input')
        caixa.type = 'checkbox'
        caixa.checked = abasSelecionadas.has(aba.nome)
        caixa.addEventListener('change', () => {
          if (caixa.checked) abasSelecionadas.add(aba.nome)
          else abasSelecionadas.delete(aba.nome)
        })
        marcar.append(caixa)
      } else {
        marcar.innerHTML = '<span class="faixas">—</span>'
      }

      const nome = document.createElement('td')
      nome.textContent = aba.nome

      const motivo = document.createElement('td')
      motivo.className = 'faixas'
      motivo.textContent = aba.motivo

      const questoes = document.createElement('td')
      questoes.textContent = aba.tipo === 'desempenho' ? String(aba.totalQuestoes) : '—'

      const discentes = document.createElement('td')
      discentes.textContent = aba.tipo === 'desempenho' ? String(aba.totalDiscentes) : '—'

      const periodo = document.createElement('td')
      if (aba.tipo === 'desempenho') {
        const seletor = document.createElement('select')
        seletor.className = 'campo__controle campo__controle--curto'
        const vazio = document.createElement('option')
        vazio.value = ''
        vazio.textContent = '—'
        seletor.append(vazio)
        for (const opcao of periodosDoCurso) {
          const item = document.createElement('option')
          item.value = opcao
          item.textContent = opcao
          seletor.append(item)
        }
        seletor.value = periodosPorAba.get(aba.nome) ?? ''
        seletor.addEventListener('change', () => {
          if (seletor.value) periodosPorAba.set(aba.nome, seletor.value)
          else periodosPorAba.delete(aba.nome)
        })
        periodo.append(seletor)
      } else {
        periodo.innerHTML = '<span class="faixas">—</span>'
      }

      linha.append(marcar, nome, motivo, questoes, discentes, periodo)
      corpo.append(linha)
    }

    tabela.append(corpo)

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'
    acoes.append(botaoVoltar(1), botaoAvancar(3))

    bloco.append(explicacao, tabela, acoes)
    return bloco
  }

  // ---------- passo 3 ----------

  function montarPasso3(): HTMLElement {
    const bloco = document.createElement('div')
    if (!analise) return bloco

    const ocorrencias = analise.ocorrencias.filter((item) => {
      // O bloqueio por aplicação repetida deixa de valer quando se opta por substituir.
      return !(item.codigo === 'aplicacao-ja-importada' && substituirAnterior)
    })

    const contagem = {
      bloqueante: ocorrencias.filter((item) => item.severidade === 'bloqueante').length,
      atencao: ocorrencias.filter((item) => item.severidade === 'atencao').length,
      informativa: ocorrencias.filter((item) => item.severidade === 'informativa').length
    }

    const contadores = document.createElement('div')
    contadores.className = 'contadores'
    contadores.innerHTML = `
      <div class="contador"><strong>${contagem.bloqueante}</strong>bloqueantes</div>
      <div class="contador"><strong>${contagem.atencao}</strong>de atenção</div>
      <div class="contador"><strong>${contagem.informativa}</strong>informativas</div>`
    bloco.append(contadores)

    if (analise.aplicacaoExistente) {
      const caixa = document.createElement('label')
      caixa.className = 'caixa-selecao'
      const entrada = document.createElement('input')
      entrada.type = 'checkbox'
      entrada.checked = substituirAnterior
      entrada.addEventListener('change', () => {
        substituirAnterior = entrada.checked
        desenhar()
      })
      const texto = document.createElement('span')
      texto.textContent = `Substituir a importação anterior de ${analise.aplicacaoExistente.rotulo}`
      caixa.append(entrada, texto)
      bloco.append(caixa)
    }

    for (const severidade of ['bloqueante', 'atencao', 'informativa'] as const) {
      const doGrupo = ocorrencias.filter((item) => item.severidade === severidade)
      for (const ocorrencia of doGrupo) bloco.append(montarOcorrencia(ocorrencia))
    }

    if (analise.clusters.length > 0) {
      const titulo = document.createElement('div')
      titulo.className = 'secao__titulo'
      titulo.style.marginTop = 'var(--espaco-5)'
      titulo.textContent = 'Unificação de grafias'

      const descricao = document.createElement('p')
      descricao.className = 'secao__descricao'
      descricao.textContent =
        'Formas diferentes de escrever a mesma coisa. Marque para unificar; o que ficar desmarcado entra como está.'

      const marcarTodas = document.createElement('button')
      marcarTodas.type = 'button'
      marcarTodas.className = 'botao botao--secundario'
      marcarTodas.style.marginBottom = 'var(--espaco-3)'
      marcarTodas.textContent =
        unificacoesAceitas.size === analise.clusters.length
          ? 'Desmarcar todas'
          : `Marcar todas (${analise.clusters.length})`
      marcarTodas.addEventListener('click', () => {
        if (unificacoesAceitas.size === analise!.clusters.length) unificacoesAceitas.clear()
        else for (const cluster of analise!.clusters) unificacoesAceitas.set(cluster.chave, cluster)
        desenhar()
      })

      bloco.append(titulo, descricao, marcarTodas)

      for (const cluster of analise.clusters) {
        const linha = document.createElement('label')
        linha.className = 'caixa-selecao'
        linha.style.alignItems = 'flex-start'

        const entrada = document.createElement('input')
        entrada.type = 'checkbox'
        entrada.checked = unificacoesAceitas.has(cluster.chave)
        entrada.addEventListener('change', () => {
          if (entrada.checked) unificacoesAceitas.set(cluster.chave, cluster)
          else unificacoesAceitas.delete(cluster.chave)
        })

        const texto = document.createElement('span')
        texto.innerHTML = `
          <strong>${cluster.campo === 'docente' ? 'Docente' : 'Tema'}:</strong>
          ${cluster.variantes.map((v) => `"${v.texto}" (${v.ocorrencias}×)`).join(' · ')}
          → unificar em <strong>${cluster.sugestao}</strong>`

        linha.append(entrada, texto)
        bloco.append(linha)
      }
    }

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'
    const avancar = botaoAvancar(4)
    avancar.disabled = contagem.bloqueante > 0
    if (contagem.bloqueante > 0) avancar.title = 'Resolva as ocorrências bloqueantes para continuar.'
    acoes.append(botaoVoltar(2), avancar)
    bloco.append(acoes)

    return bloco
  }

  // ---------- passo 4 ----------

  function montarPasso4(): HTMLElement {
    const bloco = document.createElement('div')
    if (!analise) return bloco

    if (resultado) return montarConclusao(resultado)

    const abas = [...abasSelecionadas]
      .map((nome) => ({ nome, periodo: periodosPorAba.get(nome) ?? '' }))
      .filter((aba) => aba.periodo)

    const curso = cursos.find((item) => item._id === cursoId)
    const questoes = analise.abas
      .filter((aba) => abasSelecionadas.has(aba.nome))
      .reduce((soma, aba) => soma + aba.totalQuestoes, 0)
    const registros = analise.abas
      .filter((aba) => abasSelecionadas.has(aba.nome))
      .reduce((soma, aba) => soma + aba.totalQuestoes * aba.totalDiscentes, 0)

    const numeros = document.createElement('div')
    numeros.className = 'resumo-numeros'
    const itens: Array<[string, string]> = [
      ['Curso', curso?.nome ?? '—'],
      ['Aplicação', analise.rotulo],
      ['Períodos', String(abas.length)],
      ['Questões', formatar(questoes)],
      ['Registros de desempenho', formatar(registros)]
    ]
    for (const [rotulo, valor] of itens) {
      const item = document.createElement('div')
      item.className = 'resumo-numeros__item'
      item.innerHTML = `<div class="resumo-numeros__rotulo">${rotulo}</div><div class="resumo-numeros__valor">${valor}</div>`
      numeros.append(item)
    }

    const regua = document.createElement('div')
    regua.className = 'mensagem mensagem--aviso'
    regua.textContent = curso
      ? `Régua aplicada: ${curso.regua
          .filter((faixa) => abas.some((aba) => aba.periodo === faixa.periodo))
          .map((faixa) => `${faixa.periodo} → nota base ${faixa.notaBase} a partir de ${faixa.percentualMinimo}%`)
          .join(' · ')}`
      : ''

    const lgpd = document.createElement('label')
    lgpd.className = 'caixa-selecao'
    const caixaLgpd = document.createElement('input')
    caixaLgpd.type = 'checkbox'
    caixaLgpd.checked = true
    caixaLgpd.disabled = true
    const textoLgpd = document.createElement('span')
    textoLgpd.textContent =
      'Pseudonimizar discentes nas visões coletivas (obrigatório — Lei 13.709/2018)'
    lgpd.append(caixaLgpd, textoLgpd)

    const progresso = document.createElement('div')
    progresso.className = 'barra-progresso'
    progresso.hidden = true
    const preenchimento = document.createElement('div')
    preenchimento.className = 'barra-progresso__preenchimento'
    progresso.append(preenchimento)

    const importar = document.createElement('button')
    importar.className = 'botao'
    importar.type = 'button'
    importar.textContent = 'Importar'
    importar.addEventListener('click', async () => {
      mensagem.esconder()
      importar.disabled = true
      importar.textContent = 'Importando…'
      progresso.hidden = false
      preenchimento.style.width = '35%'

      const decisoes: DecisoesImportacao = {
        caminho: analise!.caminho,
        cursoId,
        rotulo: analise!.rotulo,
        abas,
        unificacoes: [...unificacoesAceitas.values()].map((cluster) => ({
          campo: cluster.campo,
          chaves: cluster.chavesVariantes,
          para: cluster.sugestao
        })),
        substituirAnterior
      }

      const resposta = await window.painel.invocar('importacao:executar', decisoes)
      preenchimento.style.width = '100%'
      importar.disabled = false
      importar.textContent = 'Importar'

      if (!resposta.sucesso) {
        progresso.hidden = true
        mensagem.mostrar(resposta.mensagem)
        return
      }

      resultado = resposta.resumo
      ocorrenciasFinais = resposta.ocorrencias
      desenhar()
      // A topbar precisa saber que agora existe aplicação importada.
      await aoImportar()
    })

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'
    acoes.append(botaoVoltar(3), importar)

    bloco.append(numeros, regua, lgpd, progresso, acoes)
    return bloco
  }

  function montarConclusao(resumo: ResumoCarga): HTMLElement {
    const bloco = document.createElement('div')

    const sucesso = document.createElement('div')
    sucesso.className = 'mensagem mensagem--sucesso'
    sucesso.textContent = 'Importação concluída. Os painéis já consideram esta aplicação.'

    const numeros = document.createElement('div')
    numeros.className = 'resumo-numeros'
    const itens: Array<[string, string]> = [
      ['Períodos', resumo.periodos.join(', ')],
      ['Discentes', formatar(resumo.totalDiscentes)],
      ['Novos neste curso', formatar(resumo.discentesNovos)],
      ['Reencontrados', formatar(resumo.discentesReencontrados)],
      ['Sem matrícula', formatar(resumo.discentesSemMatricula)],
      ['Registros gravados', formatar(resumo.totalRegistros)],
      ['Percentual médio', `${resumo.percentualMedio.toFixed(1)}%`],
      ['Nota média pela régua', resumo.notaMedia.toFixed(2)]
    ]
    for (const [rotulo, valor] of itens) {
      const item = document.createElement('div')
      item.className = 'resumo-numeros__item'
      item.innerHTML = `<div class="resumo-numeros__rotulo">${rotulo}</div><div class="resumo-numeros__valor">${valor}</div>`
      numeros.append(item)
    }

    const relatorio = document.createElement('div')
    if (ocorrenciasFinais.length > 0) {
      const titulo = document.createElement('div')
      titulo.className = 'secao__titulo'
      titulo.textContent = 'Relatório da importação'
      relatorio.append(titulo)
      for (const ocorrencia of ocorrenciasFinais) relatorio.append(montarOcorrencia(ocorrencia))
    }

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'

    const novamente = document.createElement('button')
    novamente.className = 'botao botao--secundario'
    novamente.type = 'button'
    novamente.textContent = 'Importar outra planilha'
    novamente.addEventListener('click', () => {
      passo = 1
      analise = null
      resultado = null
      caminho = ''
      nomeArquivo = ''
      desenhar()
    })

    const verPainel = document.createElement('button')
    verPainel.className = 'botao'
    verPainel.type = 'button'
    verPainel.textContent = 'Ver histórico de importações'
    verPainel.addEventListener('click', () => navegarPara('/admin/historico'))

    acoes.append(novamente, verPainel)
    bloco.append(sucesso, numeros, relatorio, acoes)
    return bloco
  }

  // ---------- navegação ----------

  function botaoVoltar(destino: number): HTMLButtonElement {
    const botao = document.createElement('button')
    botao.className = 'botao botao--secundario'
    botao.type = 'button'
    botao.textContent = 'Voltar'
    botao.addEventListener('click', () => {
      passo = destino
      desenhar()
    })
    return botao
  }

  function botaoAvancar(destino: number): HTMLButtonElement {
    const botao = document.createElement('button')
    botao.className = 'botao'
    botao.type = 'button'
    botao.textContent = 'Continuar'
    botao.addEventListener('click', () => {
      if (destino === 3 && abasSelecionadas.size === 0) {
        mensagem.mostrar('Selecione ao menos uma aba para importar.')
        return
      }
      mensagem.esconder()
      passo = destino
      desenhar()
    })
    return botao
  }

  function desenhar(): void {
    const cabecalho = document.createElement('div')
    cabecalho.className = 'cabecalho-pagina'
    cabecalho.innerHTML = `
      <div class="migalhas">Administração › Importações</div>
      <h1>Importar planilha</h1>
      <p>Cada aplicação entra como um arquivo. O histórico longitudinal se forma pelo acúmulo das importações.</p>`

    const cartao = document.createElement('div')
    cartao.className = 'cartao'
    cartao.append(trilha())

    const conteudo =
      passo === 1
        ? montarPasso1()
        : passo === 2
          ? montarPasso2()
          : passo === 3
            ? montarPasso3()
            : montarPasso4()

    cartao.append(conteudo)
    container.replaceChildren(cabecalho, mensagem.elemento, cartao)
  }

  async function iniciar(): Promise<void> {
    cursos = await window.painel.invocar('curso:listar', undefined)
    cursoId = cursos[0]?._id ?? ''
    desenhar()
  }

  void iniciar()
  return container
}
