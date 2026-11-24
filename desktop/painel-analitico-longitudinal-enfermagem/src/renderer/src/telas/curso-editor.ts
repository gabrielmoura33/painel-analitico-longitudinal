import { AREA_NAO_MAPEADA, indiceDeAreas, mesclarAreas } from '@compartilhado/areas'
import { chaveComparacao } from '@compartilhado/texto'
import type { DadosCurso } from '@compartilhado/types/ipc'
import type { ArquivoEscolhido, PreviaAba, ResumoAba } from '@compartilhado/types/planilha'
import { normalizarRotuloPeriodo } from '@compartilhado/periodos'

import { montarAbas } from '../componentes/abas'
import { criarAreaMensagem, criarCampo } from '../componentes/formulario'
import { confirmar } from '../componentes/modal'
import { navegarPara } from '../rotas'

function campoLigado(
  rotulo: string,
  valorInicial: string,
  aoMudar: (valor: string) => void,
  extras: { tipo?: 'text' | 'number'; dica?: string; curto?: boolean; min?: number; max?: number } = {}
): HTMLElement {
  const campo = criarCampo({
    rotulo,
    tipo: extras.tipo ?? 'text',
    valor: valorInicial,
    dica: extras.dica,
    larguraCurta: extras.curto,
    min: extras.min,
    max: extras.max,
    aoDigitar: aoMudar
  })
  return campo.elemento
}

function secao(titulo: string, descricao: string, conteudo: HTMLElement[]): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'secao'
  const cabecalho = document.createElement('div')
  cabecalho.innerHTML = `<div class="secao__titulo">${titulo}</div><p class="secao__descricao">${descricao}</p>`
  bloco.append(cabecalho, ...conteudo)
  return bloco
}

/** Cadastro e edição de curso: identificação, estrutura, régua e mapeamento. */
export function montarEditorCurso(cursoId: string | null): HTMLElement {
  const container = document.createElement('div')
  const mensagem = criarAreaMensagem()

  let dados: DadosCurso | null = null
  let planilhaEscolhida: ArquivoEscolhido | null = null
  let abasPlanilha: ResumoAba[] = []
  let abaSelecionada = ''
  let previa: PreviaAba | null = null
  let temasImportados: string[] = []

  // ---------- aba 1: identificação ----------

  function abaIdentificacao(): HTMLElement {
    if (!dados) return document.createElement('div')
    const bloco = document.createElement('div')

    const grade = document.createElement('div')
    grade.className = 'grade-2'
    grade.append(
      campoLigado('Sigla', dados.sigla, (valor) => (dados!.sigla = valor)),
      campoLigado('Instituição', dados.instituicao, (valor) => (dados!.instituicao = valor))
    )

    const gradeDepartamento = document.createElement('div')
    gradeDepartamento.className = 'grade-2'
    gradeDepartamento.append(
      campoLigado('Departamento', dados.departamento, (valor) => (dados!.departamento = valor), {
        dica: 'Ex.: Enfermagem. Agrupa os cursos que aplicam o mesmo instrumento.'
      }),
      campoLigado('Campus', dados.campus, (valor) => (dados!.campus = valor), {
        dica: 'Ex.: Coração Eucarístico, Betim. É por campus que a coordenação responde.'
      })
    )

    bloco.append(
      campoLigado('Nome do curso', dados.nome, (valor) => (dados!.nome = valor)),
      grade,
      gradeDepartamento,
      campoLigado(
        'Nome do instrumento avaliativo',
        dados.nomeInstrumento,
        (valor) => (dados!.nomeInstrumento = valor),
        { dica: 'Como a avaliação é chamada no curso. Ex.: Teste de Progresso.' }
      )
    )
    return bloco
  }

  // ---------- aba 2: estrutura ----------

  function abaEstrutura(): HTMLElement {
    if (!dados) return document.createElement('div')
    const bloco = document.createElement('div')

    const chips = document.createElement('div')
    chips.className = 'chips'
    const desenharChips = (): void => {
      chips.replaceChildren()
      for (const periodo of dados!.estrutura.periodos) {
        const chip = document.createElement('span')
        chip.className = 'chip'
        chip.append(document.createTextNode(periodo))
        const remover = document.createElement('button')
        remover.type = 'button'
        remover.textContent = '×'
        remover.title = `Remover ${periodo}`
        remover.addEventListener('click', () => {
          dados!.estrutura.periodos = dados!.estrutura.periodos.filter((item) => item !== periodo)
          dados!.regua = dados!.regua.filter((faixa) => faixa.periodo !== periodo)
          desenharChips()
        })
        chip.append(remover)
        chips.append(chip)
      }
    }
    desenharChips()

    const novoPeriodo = criarCampo({ rotulo: 'Adicionar período', placeholder: 'Ex.: 6º', larguraCurta: true })
    const adicionar = document.createElement('button')
    adicionar.type = 'button'
    adicionar.className = 'botao botao--secundario'
    adicionar.textContent = 'Adicionar'
    adicionar.style.marginTop = '26px'
    adicionar.addEventListener('click', () => {
      const rotulo = normalizarRotuloPeriodo(novoPeriodo.valor())
      if (!rotulo) return
      if (dados!.estrutura.periodos.includes(rotulo)) {
        novoPeriodo.definirErro('Este período já está na lista.')
        return
      }
      dados!.estrutura.periodos.push(rotulo)
      dados!.regua.push({ periodo: rotulo, notaBase: 1, percentualMinimo: 10 })
      novoPeriodo.limpar()
      desenharChips()
    })

    const linhaPeriodo = document.createElement('div')
    linhaPeriodo.className = 'linha-controles'
    linhaPeriodo.append(novoPeriodo.elemento, adicionar)

    const tabelaComponentes = document.createElement('table')
    tabelaComponentes.className = 'tabela tabela--compacta'
    const corpoComponentes = document.createElement('tbody')
    tabelaComponentes.innerHTML =
      '<thead><tr><th>Componente</th><th>Da questão</th><th>Até a questão</th><th></th></tr></thead>'
    tabelaComponentes.append(corpoComponentes)

    const desenharComponentes = (): void => {
      corpoComponentes.replaceChildren()
      dados!.estrutura.componentes.forEach((componente, indice) => {
        const linha = document.createElement('tr')

        const nome = document.createElement('td')
        const entradaNome = document.createElement('input')
        entradaNome.className = 'campo__controle'
        entradaNome.value = componente.nome
        entradaNome.addEventListener('input', () => (componente.nome = entradaNome.value))
        nome.append(entradaNome)

        const criarNumero = (valor: number, aoMudar: (novo: number) => void): HTMLElement => {
          const celula = document.createElement('td')
          const entrada = document.createElement('input')
          entrada.className = 'campo__controle campo__controle--curto'
          entrada.type = 'number'
          entrada.min = '1'
          entrada.value = String(valor)
          entrada.addEventListener('input', () => aoMudar(Number(entrada.value)))
          celula.append(entrada)
          return celula
        }

        const acao = document.createElement('td')
        const remover = document.createElement('button')
        remover.type = 'button'
        remover.className = 'botao--texto'
        remover.dataset.perigo = 'true'
        remover.textContent = 'Remover'
        remover.addEventListener('click', () => {
          dados!.estrutura.componentes.splice(indice, 1)
          desenharComponentes()
        })
        acao.append(remover)

        linha.append(
          nome,
          criarNumero(componente.questaoInicial, (novo) => (componente.questaoInicial = novo)),
          criarNumero(componente.questaoFinal, (novo) => (componente.questaoFinal = novo)),
          acao
        )
        corpoComponentes.append(linha)
      })
    }
    desenharComponentes()

    const adicionarComponente = document.createElement('button')
    adicionarComponente.type = 'button'
    adicionarComponente.className = 'botao botao--secundario'
    adicionarComponente.textContent = 'Adicionar componente'
    adicionarComponente.style.marginTop = 'var(--espaco-3)'
    adicionarComponente.addEventListener('click', () => {
      dados!.estrutura.componentes.push({ nome: '', questaoInicial: 1, questaoFinal: 1 })
      desenharComponentes()
    })

    bloco.append(
      secao('Questões', 'Quantas questões o instrumento tem em cada aplicação.', [
        campoLigado(
          'Total de questões',
          String(dados.estrutura.totalQuestoes),
          (valor) => (dados!.estrutura.totalQuestoes = Number(valor)),
          { tipo: 'number', curto: true, min: 1 }
        )
      ]),
      secao(
        'Períodos avaliados',
        'Os períodos que respondem à mesma prova. É essa simultaneidade que permite comparar turmas e acompanhar coortes.',
        [chips, linhaPeriodo]
      ),
      secao(
        'Componentes',
        'Faixas de questões agrupadas por natureza. Na amostra de Enfermagem, as questões 1 a 8 formam o Componente Geral e as demais o Específico.',
        [tabelaComponentes, adicionarComponente]
      )
    )
    return bloco
  }

  // ---------- aba 3: áreas de conhecimento ----------

  function abaAreas(): HTMLElement {
    if (!dados) return document.createElement('div')
    const bloco = document.createElement('div')

    const listaAreas = document.createElement('div')
    const tabelaTemas = document.createElement('div')

    const desenhar = (): void => {
      // --- áreas cadastradas ---
      listaAreas.replaceChildren()

      if (dados!.areas.length === 0) {
        const vazio = document.createElement('p')
        vazio.className = 'secao__descricao'
        vazio.textContent = 'Nenhuma área cadastrada. Todos os temas entram como "Sem área definida".'
        listaAreas.append(vazio)
      }

      for (const [indice, area] of dados!.areas.entries()) {
        const cartao = document.createElement('div')
        cartao.className = 'area-cartao'

        const linha = document.createElement('div')
        linha.className = 'linha-controles'

        const nome = document.createElement('input')
        nome.className = 'campo__controle'
        nome.value = area.nome
        nome.placeholder = 'Ex.: Urgência'
        nome.addEventListener('input', () => (area.nome = nome.value))
        nome.addEventListener('change', desenhar)

        const remover = document.createElement('button')
        remover.type = 'button'
        remover.className = 'botao--texto'
        remover.dataset.perigo = 'true'
        remover.textContent = 'Remover área'
        remover.addEventListener('click', () => {
          dados!.areas.splice(indice, 1)
          desenhar()
        })

        linha.append(nome, remover)

        const chips = document.createElement('div')
        chips.className = 'chips'
        chips.style.marginTop = 'var(--espaco-3)'
        if (area.temas.length === 0) {
          const vazio = document.createElement('span')
          vazio.className = 'faixas'
          vazio.textContent = 'Nenhum tema atribuído ainda.'
          chips.append(vazio)
        }
        for (const tema of area.temas) {
          const chip = document.createElement('span')
          chip.className = 'chip'
          chip.append(document.createTextNode(tema))
          const tirar = document.createElement('button')
          tirar.type = 'button'
          tirar.textContent = '\u00D7'
          tirar.title = `Tirar ${tema} desta área`
          tirar.addEventListener('click', () => {
            area.temas = area.temas.filter((item) => item !== tema)
            desenhar()
          })
          chip.append(tirar)
          chips.append(chip)
        }

        cartao.append(linha, chips)
        listaAreas.append(cartao)
      }

      // --- temas importados ---
      tabelaTemas.replaceChildren()

      if (temasImportados.length === 0) {
        const aviso = document.createElement('div')
        aviso.className = 'mensagem mensagem--aviso'
        aviso.textContent =
          'Os temas aparecem aqui depois da primeira importação: eles vêm da planilha, ' +
          'não do cadastro.'
        tabelaTemas.append(aviso)
        return
      }

      const indice = indiceDeAreas(dados!.areas)
      const mapeados = temasImportados.filter((tema) => indice.has(chaveComparacao(tema))).length

      const contagem = document.createElement('p')
      contagem.className = 'secao__descricao'
      contagem.textContent = `${mapeados} de ${temasImportados.length} temas atribuídos a uma área.`
      tabelaTemas.append(contagem)

      const tabela = document.createElement('table')
      tabela.className = 'tabela tabela--compacta'
      tabela.innerHTML = '<thead><tr><th>Tema da planilha</th><th style="width:260px">Área</th></tr></thead>'
      const corpo = document.createElement('tbody')

      for (const tema of temasImportados) {
        const linha = document.createElement('tr')

        const celulaTema = document.createElement('td')
        celulaTema.textContent = tema

        const celulaArea = document.createElement('td')
        const seletor = document.createElement('select')
        seletor.className = 'campo__controle'

        const semArea = document.createElement('option')
        semArea.value = ''
        semArea.textContent = AREA_NAO_MAPEADA
        seletor.append(semArea)

        for (const area of dados!.areas) {
          const opcao = document.createElement('option')
          opcao.value = area.nome
          opcao.textContent = area.nome || '(área sem nome)'
          seletor.append(opcao)
        }

        const atual = dados!.areas.find((area) =>
          area.temas.some((item) => chaveComparacao(item) === chaveComparacao(tema))
        )
        seletor.value = atual?.nome ?? ''

        seletor.addEventListener('change', () => {
          for (const area of dados!.areas) {
            area.temas = area.temas.filter(
              (item) => chaveComparacao(item) !== chaveComparacao(tema)
            )
          }
          const destino = dados!.areas.find((area) => area.nome === seletor.value)
          if (destino) destino.temas.push(tema)
          desenhar()
        })

        celulaArea.append(seletor)
        linha.append(celulaTema, celulaArea)
        corpo.append(linha)
      }

      tabela.append(corpo)
      tabelaTemas.append(tabela)
    }

    const adicionar = document.createElement('button')
    adicionar.type = 'button'
    adicionar.className = 'botao botao--secundario'
    adicionar.textContent = 'Adicionar área'
    adicionar.addEventListener('click', () => {
      dados!.areas.push({ nome: '', temas: [] })
      desenhar()
    })

    const resumoImportacao = document.createElement('div')

    function relatar(classe: string, texto: string): void {
      const caixa = document.createElement('div')
      caixa.className = `mensagem mensagem--${classe}`
      caixa.textContent = texto
      resumoImportacao.append(caixa)
    }

    const importar = document.createElement('button')
    importar.type = 'button'
    importar.className = 'botao botao--secundario'
    importar.textContent = 'Importar planilha de áreas'
    importar.addEventListener('click', async () => {
      const arquivo = await window.painel.invocar('arquivo:escolher-planilha', undefined)
      if (!arquivo) return

      const leitura = await window.painel.invocar('planilha:ler-areas', {
        caminho: arquivo.caminho
      })
      resumoImportacao.replaceChildren()

      if (!leitura) {
        relatar(
          'erro',
          `Nenhuma aba de "${arquivo.nome}" tem ao mesmo tempo uma coluna de tema e uma de ` +
            'área. A planilha precisa das duas, com esses títulos na primeira linha preenchida.'
        )
        return
      }

      const resultado = mesclarAreas(dados!.areas, leitura.pares, temasImportados)
      dados!.areas = resultado.areas
      desenhar()

      const partes = [
        `Aba "${leitura.aba}": ${resultado.temasAtribuidos} tema(s) atribuídos a uma área.`
      ]
      if (resultado.areasNovas.length > 0) {
        partes.push(`${resultado.areasNovas.length} área(s) criadas: ${resultado.areasNovas.join(', ')}.`)
      }
      if (resultado.temasMovidos.length > 0) {
        partes.push(`${resultado.temasMovidos.length} tema(s) mudaram de área.`)
      }
      partes.push('Nada foi gravado ainda: confira abaixo e salve o curso.')
      relatar('aviso', partes.join(' '))

      for (const aviso of leitura.avisos) relatar('erro', aviso)

      if (resultado.temasDesconhecidos.length > 0) {
        relatar(
          'erro',
          `${resultado.temasDesconhecidos.length} tema(s) da planilha não batem com nenhum tema ` +
            `importado e provavelmente têm grafia diferente: ` +
            `${resultado.temasDesconhecidos.slice(0, 8).join('; ')}.`
        )
      }
      if (resultado.temasSemArea.length > 0) {
        relatar(
          'erro',
          `${resultado.temasSemArea.length} tema(s) já importados continuam sem área: ` +
            `${resultado.temasSemArea.slice(0, 8).join('; ')}.`
        )
      }
    })

    const botoesAreas = document.createElement('div')
    botoesAreas.className = 'linha-controles'
    botoesAreas.append(adicionar, importar)

    desenhar()

    bloco.append(
      secao(
        'Áreas de conhecimento',
        'A planilha traz um tema por questão. As faixas amplas que organizam o curso — ' +
          'Urgência, Saúde Coletiva, Gestão — são conhecimento das docentes sobre o instrumento, ' +
          'e por isso são cadastradas aqui. Sem esse agrupamento, cada questão vira uma área. ' +
          'O mapeamento pode ser digitado abaixo ou importado de uma planilha com as colunas ' +
          'tema e área.',
        [listaAreas, botoesAreas, resumoImportacao]
      ),
      secao(
        'Temas importados',
        'Atribua cada tema da planilha a uma área. Os que ficarem sem área continuam ' +
          'aparecendo nos painéis, reunidos como "Sem área definida".',
        [tabelaTemas]
      )
    )
    return bloco
  }

  // ---------- aba 4: régua de notas ----------

  function abaRegua(): HTMLElement {
    if (!dados) return document.createElement('div')
    const bloco = document.createElement('div')

    const tabela = document.createElement('table')
    tabela.className = 'tabela tabela--compacta'
    tabela.innerHTML =
      '<thead><tr><th>Período</th><th>Nota base</th><th>% mínimo</th><th>Faixas resultantes</th></tr></thead>'
    const corpo = document.createElement('tbody')
    tabela.append(corpo)

    const descreverFaixas = (notaBase: number, minimo: number): string => {
      const partes = [`até ${minimo}% → ${notaBase}`]
      let nota = notaBase + 1
      let inicio = minimo
      while (nota <= 10) {
        partes.push(`${inicio + 1}–${Math.min(inicio + 10, 100)}% → ${nota}`)
        inicio += 10
        nota += 1
      }
      return partes.join(' · ')
    }

    const desenhar = (): void => {
      corpo.replaceChildren()
      for (const periodo of dados!.estrutura.periodos) {
        let faixa = dados!.regua.find((item) => item.periodo === periodo)
        if (!faixa) {
          faixa = { periodo, notaBase: 1, percentualMinimo: 10 }
          dados!.regua.push(faixa)
        }
        const atual = faixa

        const linha = document.createElement('tr')
        const celulaPeriodo = document.createElement('td')
        celulaPeriodo.textContent = periodo

        const faixas = document.createElement('td')
        faixas.className = 'faixas'
        faixas.textContent = descreverFaixas(atual.notaBase, atual.percentualMinimo)

        const numero = (valor: number, max: number, aoMudar: (novo: number) => void): HTMLElement => {
          const celula = document.createElement('td')
          const entrada = document.createElement('input')
          entrada.className = 'campo__controle campo__controle--curto'
          entrada.type = 'number'
          entrada.min = '0'
          entrada.max = String(max)
          entrada.value = String(valor)
          entrada.addEventListener('input', () => {
            aoMudar(Number(entrada.value))
            faixas.textContent = descreverFaixas(atual.notaBase, atual.percentualMinimo)
          })
          celula.append(entrada)
          return celula
        }

        linha.append(
          celulaPeriodo,
          numero(atual.notaBase, 10, (novo) => (atual.notaBase = novo)),
          numero(atual.percentualMinimo, 100, (novo) => (atual.percentualMinimo = novo)),
          faixas
        )
        corpo.append(linha)
      }
    }
    desenhar()

    const importar = document.createElement('button')
    importar.type = 'button'
    importar.className = 'botao botao--secundario'
    importar.textContent = 'Importar régua da planilha'
    importar.addEventListener('click', () => void importarRegua(desenhar))

    const teste = criarCampo({
      rotulo: 'Testar um percentual',
      tipo: 'number',
      larguraCurta: true,
      min: 0,
      max: 100,
      placeholder: '63'
    })
    const resultadoTeste = document.createElement('p')
    resultadoTeste.className = 'faixas'
    teste.entrada.addEventListener('input', () => {
      const percentual = Number(teste.valor())
      if (teste.valor() === '' || Number.isNaN(percentual)) {
        resultadoTeste.textContent = ''
        return
      }
      resultadoTeste.textContent = dados!.estrutura.periodos
        .map((periodo) => {
          const faixa = dados!.regua.find((item) => item.periodo === periodo)
          if (!faixa) return `${periodo}: —`
          const nota =
            percentual < faixa.percentualMinimo
              ? faixa.notaBase
              : Math.min(faixa.notaBase + Math.ceil((percentual - faixa.percentualMinimo) / 10), 10)
          return `${periodo}: ${nota}`
        })
        .join('  ·  ')
    })

    bloco.append(
      secao(
        'Conversão de acertos em nota',
        'Quem alcança o percentual mínimo recebe a nota base, e cada faixa de dez pontos percentuais acima disso vale mais um ponto, até 10. Abaixo do mínimo a nota é a própria nota base — é assim que a planilha das docentes converte hoje.',
        [tabela, importar]
      ),
      secao('Conferência', 'Digite um percentual e veja a nota que cada período receberia.', [
        teste.elemento,
        resultadoTeste
      ])
    )
    return bloco
  }

  async function importarRegua(aoAplicar: () => void): Promise<void> {
    const arquivo = await window.painel.invocar('arquivo:escolher-planilha', undefined)
    if (!arquivo) return

    const leitura = await window.painel.invocar('planilha:ler-regua', { caminho: arquivo.caminho })
    if (!leitura) {
      mensagem.mostrar('Não encontrei uma aba de conversão de notas nesta planilha.')
      return
    }

    const conteudo = document.createElement('div')
    const resumo = document.createElement('p')
    resumo.style.fontSize = '13px'
    resumo.textContent = `Aba lida: "${leitura.aba}".`
    conteudo.append(resumo)

    const tabela = document.createElement('table')
    tabela.className = 'tabela tabela--compacta'
    tabela.innerHTML =
      '<thead><tr><th>Período</th><th>Nota base</th><th>% mínimo</th><th>Situação</th></tr></thead>'
    const corpo = document.createElement('tbody')
    tabela.append(corpo)

    const aplicaveis: Array<{ periodo: string; notaBase: number; percentualMinimo: number }> = []

    for (const periodo of leitura.periodos) {
      const rotulo = normalizarRotuloPeriodo(periodo.rotuloPeriodo)
      const linha = document.createElement('tr')
      const situacao: string[] = []

      if (!periodo.deducao) {
        situacao.push('sem dados')
      } else {
        if (periodo.deducao.ambiguo) {
          situacao.push(
            `ambíguo: ${periodo.deducao.candidatos.length} configurações explicam os mesmos dados`
          )
        }
        if (periodo.deducao.melhor.divergencias.length > 0) {
          situacao.push(`${periodo.deducao.melhor.divergencias.length} linha(s) não explicada(s)`)
        }
        if (situacao.length === 0) situacao.push('confere com todas as linhas')

        if (!periodo.deducao.ambiguo && dados!.estrutura.periodos.includes(rotulo)) {
          aplicaveis.push({
            periodo: rotulo,
            notaBase: periodo.deducao.melhor.notaBase,
            percentualMinimo: periodo.deducao.melhor.percentualMinimo
          })
        }
      }

      if (!dados!.estrutura.periodos.includes(rotulo)) {
        situacao.push('período não cadastrado neste curso')
      }

      linha.innerHTML = `
        <td>${periodo.rotuloPeriodo} → ${rotulo}</td>
        <td>${periodo.deducao?.melhor.notaBase ?? '—'}</td>
        <td>${periodo.deducao?.melhor.percentualMinimo ?? '—'}%</td>
        <td class="faixas">${situacao.join('; ')}</td>`
      corpo.append(linha)
    }

    conteudo.append(tabela)

    const nota = document.createElement('p')
    nota.style.fontSize = '13px'
    nota.style.marginTop = 'var(--espaco-4)'
    nota.textContent =
      aplicaveis.length > 0
        ? `Serão aplicados ${aplicaveis.length} período(s). Os demais continuam como estão, para você ajustar à mão.`
        : 'Nenhum período pôde ser aplicado automaticamente. Ajuste os valores à mão.'
    conteudo.append(nota)

    const aplicar = await confirmar({
      titulo: 'Régua lida da planilha',
      conteudo,
      rotuloConfirmar: aplicaveis.length > 0 ? 'Aplicar' : 'Fechar'
    })

    if (!aplicar || aplicaveis.length === 0) return

    for (const item of aplicaveis) {
      const faixa = dados!.regua.find((atual) => atual.periodo === item.periodo)
      if (faixa) {
        faixa.notaBase = item.notaBase
        faixa.percentualMinimo = item.percentualMinimo
      }
    }
    aoAplicar()
    mensagem.mostrar(`Régua aplicada a ${aplicaveis.length} período(s).`, 'sucesso')
  }

  // ---------- aba 4: mapeamento de colunas ----------

  function abaMapeamento(): HTMLElement {
    if (!dados) return document.createElement('div')
    const bloco = document.createElement('div')
    const perfil = dados.perfilImportacao

    const grade = document.createElement('div')
    grade.className = 'grade-2'
    grade.append(
      campoLigado('Linha do cabeçalho (nomes dos discentes)', String(perfil.linhaCabecalho), (valor) => (perfil.linhaCabecalho = Number(valor)), { tipo: 'number', min: 1 }),
      campoLigado('Linha de total (opcional)', perfil.linhaTotal === null ? '' : String(perfil.linhaTotal), (valor) => (perfil.linhaTotal = valor === '' ? null : Number(valor)), { tipo: 'number', min: 1 }),
      campoLigado(
        'Linha da matrícula (opcional)',
        perfil.linhaMatricula === null ? '' : String(perfil.linhaMatricula),
        (valor) => (perfil.linhaMatricula = valor === '' ? null : Number(valor)),
        {
          tipo: 'number',
          min: 1,
          dica:
            'Os discentes são colunas, então a matrícula é uma linha: a célula sob o nome de ' +
            'cada pessoa. Em branco, o reencontro entre semestres continua pelo nome.'
        }
      ),
      campoLigado('Coluna da questão', perfil.colunaQuestao, (valor) => (perfil.colunaQuestao = valor)),
      campoLigado('Coluna do gabarito', perfil.colunaGabarito, (valor) => (perfil.colunaGabarito = valor)),
      campoLigado('Coluna do tema', perfil.colunaTema, (valor) => (perfil.colunaTema = valor)),
      campoLigado('Coluna do docente', perfil.colunaDocente, (valor) => (perfil.colunaDocente = valor)),
      campoLigado('Primeira coluna de alunos', perfil.primeiraColunaAluno, (valor) => (perfil.primeiraColunaAluno = valor)),
      campoLigado('Valor que marca acerto', perfil.marcadorAcerto, (valor) => (perfil.marcadorAcerto = valor), { dica: 'Célula vazia é tratada como erro.' })
    )

    const areaPrevia = document.createElement('div')

    const seletorAba = document.createElement('select')
    seletorAba.className = 'campo__controle campo__controle--medio'
    seletorAba.hidden = true
    seletorAba.addEventListener('change', () => {
      abaSelecionada = seletorAba.value
      void atualizarPrevia()
    })

    const escolher = document.createElement('button')
    escolher.type = 'button'
    escolher.className = 'botao botao--secundario'
    escolher.textContent = 'Escolher planilha e conferir'
    escolher.addEventListener('click', async () => {
      const arquivo = await window.painel.invocar('arquivo:escolher-planilha', undefined)
      if (!arquivo) return
      planilhaEscolhida = arquivo
      abasPlanilha = await window.painel.invocar('planilha:resumir', { caminho: arquivo.caminho })
      abaSelecionada = abasPlanilha[0]?.nome ?? ''
      seletorAba.replaceChildren(
        ...abasPlanilha.map((aba) => {
          const opcao = document.createElement('option')
          opcao.value = aba.nome
          opcao.textContent = `${aba.nome} (${aba.linhas} linhas)`
          return opcao
        })
      )
      seletorAba.hidden = false
      seletorAba.value = abaSelecionada
      await atualizarPrevia()
    })

    const atualizar = document.createElement('button')
    atualizar.type = 'button'
    atualizar.className = 'botao botao--secundario'
    atualizar.textContent = 'Atualizar conferência'
    atualizar.addEventListener('click', () => void atualizarPrevia())

    async function atualizarPrevia(): Promise<void> {
      if (!planilhaEscolhida || !abaSelecionada) return
      previa = await window.painel.invocar('planilha:previsualizar', {
        caminho: planilhaEscolhida.caminho,
        aba: abaSelecionada,
        perfil: dados!.perfilImportacao
      })
      desenharPrevia()
    }

    function desenharPrevia(): void {
      areaPrevia.replaceChildren()
      if (!previa) return

      const resumo = document.createElement('div')
      resumo.className = 'mensagem mensagem--aviso'
      resumo.textContent =
        `${previa.questoes.length} questão(ões) e ${previa.discentes.length} discente(s) ` +
        `reconhecidos — ${previa.totalRegistros} registros de desempenho. Nada foi importado.`
      areaPrevia.append(resumo)

      if (previa.avisos.length > 0) {
        const avisos = document.createElement('div')
        avisos.className = 'mensagem mensagem--erro'
        const unicos = [...new Set(previa.avisos)].slice(0, 6)
        avisos.textContent = unicos.join(' ')
        areaPrevia.append(avisos)
      }

      const tabela = document.createElement('table')
      tabela.className = 'tabela tabela--compacta'
      tabela.innerHTML =
        '<thead><tr><th>Questão</th><th>Gabarito</th><th>Tema</th><th>Docente</th><th>Acertos</th></tr></thead>'
      const corpo = document.createElement('tbody')
      for (const questao of previa.questoes.slice(0, 8)) {
        const linha = document.createElement('tr')
        linha.innerHTML = `<td>${questao.numero}</td><td>${questao.gabarito}</td><td>${questao.tema}</td><td>${questao.docente}</td><td>${questao.acertos}</td>`
        corpo.append(linha)
      }
      tabela.append(corpo)
      areaPrevia.append(tabela)

      if (previa.discentes.length > 0) {
        const discentes = document.createElement('p')
        discentes.className = 'faixas'
        discentes.style.marginTop = 'var(--espaco-3)'
        discentes.textContent = `Primeiros discentes lidos: ${previa.discentes.slice(0, 4).join(' · ')}…`
        areaPrevia.append(discentes)
      }
    }

    const controles = document.createElement('div')
    controles.className = 'linha-controles'
    controles.append(escolher, seletorAba, atualizar)

    bloco.append(
      secao(
        'De onde vem cada informação',
        'Posições na planilha. É este mapeamento que permite atender um curso com planilha diferente sem alterar o programa.',
        [grade]
      ),
      secao(
        'Conferir contra um arquivo real',
        'Abre uma planilha e mostra o que seria lido com o mapeamento atual. Nenhum dado é importado nesta tela.',
        [controles, areaPrevia]
      )
    )
    desenharPrevia()
    return bloco
  }

  // ---------- montagem ----------

  async function carregar(): Promise<void> {
    container.replaceChildren()

    if (cursoId) {
      const curso = await window.painel.invocar('curso:obter', { cursoId })
      if (!curso) {
        const erro = document.createElement('div')
        erro.className = 'mensagem mensagem--erro'
        erro.textContent = 'Curso não encontrado.'
        container.append(erro)
        return
      }
      dados = {
        nome: curso.nome,
        sigla: curso.sigla,
        instituicao: curso.instituicao,
        campus: curso.campus ?? '',
        departamento: curso.departamento ?? '',
        nomeInstrumento: curso.nomeInstrumento,
        estrutura: structuredClone(curso.estrutura),
        areas: structuredClone(curso.areas ?? []),
        regua: structuredClone(curso.regua),
        perfilImportacao: structuredClone(curso.perfilImportacao)
      }
    } else {
      dados = await window.painel.invocar('curso:modelo', undefined)
    }

    temasImportados = cursoId
      ? await window.painel.invocar('curso:temas', { cursoId })
      : []

    const cabecalho = document.createElement('div')
    cabecalho.className = 'cabecalho-pagina'
    cabecalho.innerHTML = `
      <div class="migalhas">Administração › Cursos</div>
      <h1>${cursoId ? dados.nome || 'Curso' : 'Novo curso'}</h1>
      <p>Aderir à plataforma é preencher este cadastro — nada aqui exige alteração no programa.</p>`

    const cartao = document.createElement('div')
    cartao.className = 'cartao'

    cartao.append(
      montarAbas([
        { id: 'identificacao', titulo: 'Identificação', montar: abaIdentificacao },
        { id: 'estrutura', titulo: 'Estrutura', montar: abaEstrutura },
        { id: 'areas', titulo: 'Áreas de conhecimento', montar: abaAreas },
        { id: 'regua', titulo: 'Régua de notas', montar: abaRegua },
        { id: 'mapeamento', titulo: 'Mapeamento de colunas', montar: abaMapeamento }
      ])
    )

    const acoes = document.createElement('div')
    acoes.className = 'acoes-formulario'

    const cancelar = document.createElement('button')
    cancelar.type = 'button'
    cancelar.className = 'botao botao--secundario'
    cancelar.textContent = 'Cancelar'
    cancelar.addEventListener('click', () => navegarPara('/admin/cursos'))

    const salvar = document.createElement('button')
    salvar.type = 'button'
    salvar.className = 'botao'
    salvar.textContent = cursoId ? 'Salvar alterações' : 'Cadastrar curso'
    salvar.addEventListener('click', async () => {
      if (!dados) return
      mensagem.esconder()
      salvar.disabled = true

      const resultado = cursoId
        ? await window.painel.invocar('curso:atualizar', { cursoId, dados })
        : await window.painel.invocar('curso:criar', dados)

      salvar.disabled = false

      if (!resultado.sucesso) {
        mensagem.mostrar(resultado.mensagem)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      navegarPara('/admin/cursos')
    })

    acoes.append(cancelar, salvar)
    cartao.append(acoes)
    container.append(cabecalho, mensagem.elemento, cartao)
  }

  void carregar()
  return container
}
