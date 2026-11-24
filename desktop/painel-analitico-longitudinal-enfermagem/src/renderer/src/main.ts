import './styles/tokens.css'
import './styles/base.css'

import type { ContextoPainel } from '@compartilhado/types/indicadores'
import type { EstadoInicial } from '@compartilhado/types/ipc'

import { montarTopbar } from './componentes/topbar'
import {
  ROTA_PADRAO,
  caminhoAtual,
  ehRotaPublica,
  idDoCursoNaRota,
  navegarPara,
  perfilAutoriza,
  rotaPorCaminho
} from './rotas'
import { montarEditorCurso } from './telas/curso-editor'
import { montarListaCursos } from './telas/cursos-lista'
import { montarDefinirSenha } from './telas/definir-senha'
import { montarDiagnostico } from './telas/diagnostico'
import { montarGuia } from './telas/guia'
import { iniciarJornada } from './telas/jornada'
import { montarHistorico } from './telas/historico'
import { montarImportacao } from './telas/importacao'
import { montarLogin } from './telas/login'
import { montarPlaceholder } from './telas/placeholder'
import { montarPrimeiroAdministrador } from './telas/primeiro-administrador'
import { montarRecuperarSenha } from './telas/recuperar-senha'
import { montarCadastroUsuario } from './telas/usuario-novo'
import { montarVisaoAreas } from './telas/areas'
import { montarVisaoDiscente } from './telas/discente'
import { montarVisaoDocentes } from './telas/docentes'
import { montarVisaoQuestoes } from './telas/questoes'
import { montarVisaoGeral } from './telas/visao-geral'
import { montarVisaoTurma } from './telas/turma'
import { montarListaUsuarios } from './telas/usuarios-lista'

const raiz = document.querySelector<HTMLDivElement>('#raiz')
if (!raiz) throw new Error('Elemento raiz não encontrado no documento.')

const ESTADO_INICIAL: EstadoInicial = {
  sessao: {
    autenticado: false,
    usuarioId: null,
    nome: null,
    perfil: null,
    cursosPermitidos: [],
    primeiroAcesso: false
  },
  precisaConfiguracaoInicial: false,
  possuiAplicacoes: false,
  totalCursos: 0
}

let estado: EstadoInicial = ESTADO_INICIAL

const CONTEXTO_VAZIO: ContextoPainel = {
  cursoId: null,
  aplicacaoId: null,
  cursos: [],
  aplicacoes: []
}

/** Curso e aplicação escolhidos no filtro global da topbar. */
let contexto: ContextoPainel = CONTEXTO_VAZIO

const CHAVE_GUIA = 'painel:guia-visto:'
const CHAVE_JORNADA = 'painel:jornada-vista:'

/** Primeiro acesso desta pessoa: a jornada guiada abre sozinha, uma única vez. */
let jornadaPendente = false

/**
 * O guia já foi aberto para esta pessoa nesta instalação?
 *
 * É preferência de interface, não dado do painel: fica no navegador embutido,
 * por usuário. Se o armazenamento estiver indisponível, o guia deixa de
 * insistir — abrir sozinho a cada execução seria pior do que não abrir.
 */
function jaVisto(chave: string, usuarioId: string): boolean {
  try {
    return localStorage.getItem(chave + usuarioId) === 'sim'
  } catch {
    return true
  }
}

function marcarVisto(chave: string, usuarioId: string): void {
  try {
    localStorage.setItem(chave + usuarioId, 'sim')
  } catch {
    // Sem armazenamento, guia e jornada continuam acessíveis pelo menu.
  }
}

/**
 * Esta pessoa ainda precisa da apresentação do painel?
 *
 * São duas marcas, e não uma: quem já tinha visto o guia escrito antes de a
 * jornada existir recebe a jornada uma vez, em vez de nunca.
 */
function precisaDaApresentacao(usuarioId: string): boolean {
  return !jaVisto(CHAVE_GUIA, usuarioId) || !jaVisto(CHAVE_JORNADA, usuarioId)
}

async function atualizarEstado(): Promise<void> {
  estado = await window.painel.invocar('sistema:estado-inicial', undefined)

  if (!estado.sessao.autenticado || estado.sessao.primeiroAcesso) {
    contexto = CONTEXTO_VAZIO
    return
  }

  contexto = await window.painel.invocar('painel:contexto', {
    cursoId: contexto.cursoId ?? undefined,
    aplicacaoId: contexto.aplicacaoId ?? undefined
  })
}

/**
 * Atualiza o estado e redesenha só a topbar.
 *
 * Usado quando uma tela muda algo que a topbar mostra — a importação de uma
 * aplicação, por exemplo — sem descartar o que a tela está exibindo.
 */
async function atualizarTopbar(): Promise<void> {
  await atualizarEstado()
  const atual = raiz!.firstElementChild
  if (!atual || !atual.classList.contains('topbar')) return
  atual.replaceWith(montarTopbar(estado, contexto, caminhoAtual(), acoesTopbar()))
}

/** Recarrega o estado vindo do main e redesenha a tela. */
async function recarregar(destino?: string): Promise<void> {
  await atualizarEstado()
  if (destino) {
    navegarPara(destino)
    return
  }
  await renderizar()
}

async function montarConteudo(caminho: string): Promise<HTMLElement> {
  const rota = rotaPorCaminho(caminho)

  if (!rota) {
    const bloco = document.createElement('div')
    bloco.className = 'cartao'
    bloco.textContent = `Rota desconhecida: ${caminho}`
    return bloco
  }

  if (!perfilAutoriza(rota, estado.sessao.perfil)) {
    const bloco = document.createElement('div')
    bloco.className = 'mensagem mensagem--erro'
    bloco.textContent = 'Seu perfil não tem acesso a esta tela.'
    return bloco
  }

  // Sem aplicação importada, nenhuma tela analítica tem o que mostrar.
  if (rota.exigeAplicacao && !estado.possuiAplicacoes) {
    return montarPlaceholder(rota, estado)
  }

  switch (rota.caminho) {
    case '/guia':
      return montarGuia(estado, () => navegarPara(ROTA_PADRAO))
    case '/sistema':
      return montarDiagnostico()
    case '/visao-geral':
      return montarVisaoGeral(contexto)
    case '/analises/turma':
      return montarVisaoTurma(contexto)
    case '/analises/areas':
      return montarVisaoAreas(contexto)
    case '/analises/questoes':
      return montarVisaoQuestoes(contexto)
    case '/analises/docentes':
      return montarVisaoDocentes(contexto)
    case '/analises/discente':
      return montarVisaoDiscente(contexto)
    case '/admin/usuarios':
      return montarListaUsuarios(estado.sessao.usuarioId)
    case '/admin/usuarios/novo':
      return montarCadastroUsuario()
    case '/admin/cursos':
      return montarListaCursos()
    case '/admin/cursos/novo':
      return montarEditorCurso(null)
    case '/importacoes':
      return montarImportacao(atualizarTopbar)
    case '/admin/historico':
      return montarHistorico(estado.sessao.perfil === 'administrador')
    default: {
      const cursoId = idDoCursoNaRota(rota.caminho)
      if (cursoId) return montarEditorCurso(cursoId)
      return montarPlaceholder(rota, estado)
    }
  }
}

function acoesTopbar(): {
  aoSair: () => Promise<void>
  aoTrocarContexto: (cursoId: string, aplicacaoId: string | null) => Promise<void>
} {
  return {
    aoSair: async () => {
      await window.painel.invocar('sessao:sair', undefined)
      await recarregar('/login')
    },
    aoTrocarContexto: async (cursoId, aplicacaoId) => {
      contexto = await window.painel.invocar('painel:contexto', {
        cursoId,
        aplicacaoId: aplicacaoId ?? undefined
      })
      await renderizar()
    }
  }
}

async function renderizar(): Promise<void> {
  const caminho = caminhoAtual()

  // 1. Instalação nova: antes de tudo, criar o primeiro administrador.
  if (estado.precisaConfiguracaoInicial) {
    raiz!.replaceChildren(montarPrimeiroAdministrador(() => recarregar(ROTA_PADRAO)))
    return
  }

  // 2. Sem sessão: só login e recuperação de senha.
  if (!estado.sessao.autenticado) {
    const tela =
      caminho === '/recuperar-senha'
        ? montarRecuperarSenha()
        : montarLogin(() => recarregar(ROTA_PADRAO))
    raiz!.replaceChildren(tela)
    return
  }

  // 3. Senha inicial ainda não trocada: nenhuma outra tela fica acessível.
  if (estado.sessao.primeiroAcesso) {
    raiz!.replaceChildren(montarDefinirSenha(() => recarregar(ROTA_PADRAO)))
    return
  }

  // Já autenticado: login e recuperação não fazem mais sentido como destino.
  if (ehRotaPublica(caminho)) {
    navegarPara(ROTA_PADRAO)
    return
  }

  // 4. Primeira vez desta pessoa no painel: o guia abre antes de qualquer tela.
  const usuarioId = estado.sessao.usuarioId
  if (usuarioId && caminho !== '/guia' && precisaDaApresentacao(usuarioId)) {
    marcarVisto(CHAVE_GUIA, usuarioId)
    marcarVisto(CHAVE_JORNADA, usuarioId)
    jornadaPendente = true
    navegarPara('/guia')
    return
  }

  const topbar = montarTopbar(estado, contexto, caminho, acoesTopbar())

  const conteudo = document.createElement('main')
  conteudo.className = 'conteudo'
  conteudo.append(await montarConteudo(caminho))

  raiz!.replaceChildren(topbar, conteudo)

  // A jornada precisa da tela já no documento para acender os elementos dela.
  if (jornadaPendente && caminho === '/guia') {
    jornadaPendente = false
    iniciarJornada(estado)
  }
}

async function iniciar(): Promise<void> {
  try {
    await atualizarEstado()
  } catch (erro) {
    console.error('Não foi possível obter o estado inicial:', erro)
  }

  if (window.location.hash === '') {
    window.location.hash = estado.sessao.autenticado ? ROTA_PADRAO : '/login'
  }

  window.addEventListener('hashchange', () => void renderizar())
  await renderizar()
}

void iniciar()
