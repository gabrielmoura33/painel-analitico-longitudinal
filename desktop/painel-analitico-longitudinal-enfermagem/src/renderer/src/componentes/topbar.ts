import type { ContextoPainel } from '@compartilhado/types/indicadores'
import type { EstadoInicial } from '@compartilhado/types/ipc'

import { navegarPara } from '../rotas'

export interface AcoesTopbar {
  aoSair: () => Promise<void>
  aoTrocarContexto: (cursoId: string, aplicacaoId: string | null) => Promise<void>
}

interface ItemNav {
  titulo: string
  caminho?: string
  filhos?: Array<{ titulo: string; caminho: string }>
  somenteAdmin?: boolean
}

const ITENS: ItemNav[] = [
  { titulo: 'Visão geral', caminho: '/visao-geral' },
  {
    titulo: 'Análises',
    filhos: [
      { titulo: 'Discente', caminho: '/analises/discente' },
      { titulo: 'Turma', caminho: '/analises/turma' },
      { titulo: 'Áreas de conhecimento', caminho: '/analises/areas' },
      { titulo: 'Questões', caminho: '/analises/questoes' },
      { titulo: 'Docentes responsáveis', caminho: '/analises/docentes' }
    ]
  },
  { titulo: 'Importações', caminho: '/importacoes', somenteAdmin: true },
  { titulo: 'Histórico', caminho: '/admin/historico' },
  {
    titulo: 'Administração',
    somenteAdmin: true,
    filhos: [
      { titulo: 'Usuários', caminho: '/admin/usuarios' },
      { titulo: 'Cursos e réguas', caminho: '/admin/cursos' }
    ]
  },
  { titulo: 'Guia', caminho: '/guia' }
]

function marca(): HTMLElement {
  const elemento = document.createElement('div')
  elemento.className = 'topbar__marca'
  elemento.innerHTML = `
    <div class="topbar__simbolo" aria-hidden="true">+</div>
    <div>
      <div class="topbar__titulo">Painel Analítico</div>
      <div class="topbar__subtitulo">ENFERMAGEM</div>
    </div>`
  return elemento
}

function botaoNav(titulo: string, ativo: boolean): HTMLButtonElement {
  const botao = document.createElement('button')
  botao.className = 'topbar__link'
  botao.type = 'button'
  botao.textContent = titulo
  if (ativo) botao.setAttribute('aria-current', 'page')
  return botao
}

function menuSuspenso(item: ItemNav, caminhoAtivo: string): HTMLElement {
  const container = document.createElement('div')
  container.style.position = 'relative'

  const filhos = item.filhos ?? []
  const ativo = filhos.some((filho) => filho.caminho === caminhoAtivo)
  const gatilho = botaoNav(`${item.titulo} ▾`, ativo)

  const lista = document.createElement('div')
  lista.className = 'menu-suspenso'
  lista.dataset.menuSuspenso = 'true'

  for (const filho of filhos) {
    const opcao = document.createElement('button')
    opcao.type = 'button'
    opcao.className = 'menu-suspenso__item'
    opcao.textContent = filho.titulo
    if (filho.caminho === caminhoAtivo) opcao.dataset.ativo = 'true'
    opcao.addEventListener('click', () => {
      lista.dataset.aberto = 'false'
      navegarPara(filho.caminho)
    })
    lista.append(opcao)
  }

  gatilho.addEventListener('click', (evento) => {
    evento.stopPropagation()
    const estavaAberto = lista.dataset.aberto === 'true'
    document.querySelectorAll<HTMLElement>('[data-menu-suspenso]').forEach((outro) => {
      outro.dataset.aberto = 'false'
    })
    lista.dataset.aberto = estavaAberto ? 'false' : 'true'
  })

  document.addEventListener('click', () => {
    lista.dataset.aberto = 'false'
  })

  container.append(gatilho, lista)
  return container
}

/**
 * Filtro global: curso e aplicação.
 *
 * Toda tela analítica é relativa a esse par, então ele vive na topbar e
 * acompanha a navegação.
 */
function filtroGlobal(contexto: ContextoPainel, acoes: AcoesTopbar): HTMLElement[] {
  if (contexto.cursos.length === 0 || contexto.aplicacoes.length === 0) {
    const etiqueta = document.createElement('span')
    etiqueta.className = 'topbar__etiqueta-contexto'
    etiqueta.textContent =
      contexto.cursos.length === 0 ? 'Nenhum curso cadastrado' : 'Nenhuma aplicação importada'
    return [etiqueta]
  }

  const curso = document.createElement('select')
  curso.className = 'topbar__filtro'
  curso.dataset.tour = 'filtro-global'
  curso.title = 'Curso'
  curso.replaceChildren(
    ...contexto.cursos.map((item) => {
      const opcao = document.createElement('option')
      opcao.value = item._id
      opcao.textContent = item.nome
      return opcao
    })
  )
  curso.value = contexto.cursoId ?? ''
  curso.addEventListener('change', () => void acoes.aoTrocarContexto(curso.value, null))

  const aplicacao = document.createElement('select')
  aplicacao.className = 'topbar__filtro'
  aplicacao.title = 'Aplicação'
  aplicacao.replaceChildren(
    ...contexto.aplicacoes.map((item) => {
      const opcao = document.createElement('option')
      opcao.value = item._id
      opcao.textContent = item.rotulo
      return opcao
    })
  )
  aplicacao.value = contexto.aplicacaoId ?? ''
  aplicacao.addEventListener('change', () =>
    void acoes.aoTrocarContexto(contexto.cursoId ?? '', aplicacao.value)
  )

  return [curso, aplicacao]
}

export function montarTopbar(
  estado: EstadoInicial,
  contexto: ContextoPainel,
  caminhoAtivo: string,
  acoes: AcoesTopbar
): HTMLElement {
  const topbar = document.createElement('header')
  topbar.className = 'topbar'

  const nav = document.createElement('nav')
  nav.className = 'topbar__nav'
  nav.dataset.tour = 'menu'

  const ehAdmin = estado.sessao.perfil === 'administrador'

  for (const item of ITENS) {
    if (item.somenteAdmin && !ehAdmin) continue

    if (item.filhos) {
      nav.append(menuSuspenso(item, caminhoAtivo))
      continue
    }

    const caminho = item.caminho as string
    const botao = botaoNav(item.titulo, caminho === caminhoAtivo)
    botao.addEventListener('click', () => navegarPara(caminho))
    nav.append(botao)
  }

  const area = document.createElement('div')
  area.className = 'topbar__contexto'

  const perfil = document.createElement('span')
  perfil.className = 'topbar__etiqueta-contexto'
  perfil.textContent = ehAdmin ? 'Administrador' : 'Professor'

  const usuario = document.createElement('span')
  usuario.textContent = estado.sessao.nome ?? ''

  const sair = document.createElement('button')
  sair.type = 'button'
  sair.className = 'topbar__sair'
  sair.dataset.tour = 'sessao'
  sair.textContent = 'Sair'
  sair.addEventListener('click', () => void acoes.aoSair())

  area.append(...filtroGlobal(contexto, acoes), perfil, usuario, sair)
  topbar.append(marca(), nav, area)
  return topbar
}
