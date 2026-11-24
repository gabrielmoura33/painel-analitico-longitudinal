import type { Curso } from '@compartilhado/types/dominio'

import { criarAreaMensagem } from '../componentes/formulario'
import { confirmar } from '../componentes/modal'
import { navegarPara } from '../rotas'

function perfilCompleto(curso: Curso): boolean {
  return (
    curso.estrutura.periodos.length > 0 &&
    curso.estrutura.componentes.length > 0 &&
    curso.regua.length >= curso.estrutura.periodos.length
  )
}

/**
 * Cursos cadastrados.
 *
 * É esta tela que concretiza a independência de curso do projeto: atender um
 * novo curso é cadastrar um perfil aqui, sem tocar em código.
 */
export function montarListaCursos(): HTMLElement {
  const container = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina cabecalho-pagina--com-acao'
  const titulos = document.createElement('div')
  titulos.innerHTML = `
    <div class="migalhas">Administração › Cursos</div>
    <h1>Cursos e réguas</h1>
    <p>Cada curso descreve o próprio instrumento: questões, períodos, componentes e conversão de nota.</p>`

  const novo = document.createElement('button')
  novo.className = 'botao'
  novo.type = 'button'
  novo.textContent = 'Novo curso'
  novo.addEventListener('click', () => navegarPara('/admin/cursos/novo'))
  cabecalho.append(titulos, novo)

  const mensagem = criarAreaMensagem()

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.style.padding = '0'
  cartao.style.overflow = 'hidden'

  const tabela = document.createElement('table')
  tabela.className = 'tabela'
  tabela.dataset.tour = 'cursos-tabela'
  tabela.innerHTML = `
    <thead>
      <tr>
        <th>Curso</th><th>Instrumento</th><th>Questões</th>
        <th>Períodos</th><th>Perfil</th><th></th>
      </tr>
    </thead>
    <tbody></tbody>`
  const corpo = tabela.querySelector('tbody') as HTMLTableSectionElement
  cartao.append(tabela)

  async function recarregar(): Promise<void> {
    mensagem.esconder()
    const cursos = await window.painel.invocar('curso:listar', undefined)
    corpo.replaceChildren()

    if (cursos.length === 0) {
      const linha = document.createElement('tr')
      const celula = document.createElement('td')
      celula.colSpan = 6
      celula.style.textAlign = 'center'
      celula.style.color = 'var(--cor-texto-suave)'
      celula.style.padding = 'var(--espaco-6)'
      celula.textContent =
        'Nenhum curso cadastrado. Cadastre o primeiro para poder importar planilhas.'
      linha.append(celula)
      corpo.append(linha)
      return
    }

    for (const curso of cursos) {
      const linha = document.createElement('tr')

      const nome = document.createElement('td')
      const procedencia = [curso.sigla, curso.departamento, curso.campus, curso.instituicao]
        .filter(Boolean)
        .join(' · ')
      nome.innerHTML = `<strong>${curso.nome}</strong><br /><span class="faixas">${procedencia}</span>`

      const instrumento = document.createElement('td')
      instrumento.textContent = curso.nomeInstrumento

      const questoes = document.createElement('td')
      questoes.textContent = String(curso.estrutura.totalQuestoes)

      const periodos = document.createElement('td')
      periodos.textContent = curso.estrutura.periodos.join(', ') || '—'

      const perfil = document.createElement('td')
      perfil.innerHTML = perfilCompleto(curso)
        ? '<span class="etiqueta etiqueta--positiva">Completo</span>'
        : '<span class="etiqueta etiqueta--atencao">Incompleto</span>'

      const acoes = document.createElement('td')
      const grupo = document.createElement('div')
      grupo.className = 'acoes-linha'

      const editar = document.createElement('button')
      editar.className = 'botao--texto'
      editar.type = 'button'
      editar.textContent = 'Editar'
      editar.addEventListener('click', () => navegarPara(`/admin/cursos/${curso._id}`))

      const remover = document.createElement('button')
      remover.className = 'botao--texto'
      remover.type = 'button'
      remover.dataset.perigo = 'true'
      remover.textContent = 'Remover'
      remover.addEventListener('click', async () => {
        const confirmou = await confirmar({
          titulo: `Remover ${curso.nome}?`,
          texto: 'O cadastro do curso e o perfil de importação serão apagados.',
          rotuloConfirmar: 'Remover',
          perigo: true
        })
        if (!confirmou) return

        const resultado = await window.painel.invocar('curso:remover', { cursoId: curso._id })
        if (!resultado.sucesso) {
          mensagem.mostrar(resultado.mensagem ?? 'Não foi possível remover.')
          return
        }
        await recarregar()
      })

      grupo.append(editar, remover)
      acoes.append(grupo)
      linha.append(nome, instrumento, questoes, periodos, perfil, acoes)
      corpo.append(linha)
    }
  }

  container.append(cabecalho, mensagem.elemento, cartao)
  void recarregar()
  return container
}
