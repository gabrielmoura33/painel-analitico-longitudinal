import { PERFIS } from '@compartilhado/constants'
import type { Curso, PerfilUsuario } from '@compartilhado/types/dominio'
import type { FiltroUsuarios, UsuarioResumo } from '@compartilhado/types/ipc'

import { criarAreaMensagem } from '../componentes/formulario'
import { confirmar, mostrarSenhaInicial } from '../componentes/modal'
import { navegarPara } from '../rotas'

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function montarListaUsuarios(usuarioEmSessao: string | null): HTMLElement {
  const container = document.createElement('div')

  /** Cursos do departamento, para montar o escopo de cada usuário. */
  let cursos: Curso[] = []

  function nomeDoCurso(cursoId: string): string {
    const curso = cursos.find((item) => item._id === cursoId)
    if (!curso) return 'curso removido'
    return curso.campus ? `${curso.sigla} · ${curso.campus}` : curso.sigla
  }

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina cabecalho-pagina--com-acao'

  const titulos = document.createElement('div')
  titulos.innerHTML = `
    <div class="migalhas">Administração › Usuários</div>
    <h1>Usuários</h1>
    <p>Quem tem acesso ao painel e com qual perfil.</p>`

  const novo = document.createElement('button')
  novo.className = 'botao'
  novo.type = 'button'
  novo.textContent = 'Novo usuário'
  novo.addEventListener('click', () => navegarPara('/admin/usuarios/novo'))

  cabecalho.append(titulos, novo)

  const avisoSolicitacoes = document.createElement('div')
  avisoSolicitacoes.hidden = true

  const mensagem = criarAreaMensagem()

  const filtros = document.createElement('div')
  filtros.className = 'barra-filtros'

  const busca = document.createElement('input')
  busca.className = 'campo__controle barra-filtros__busca'
  busca.type = 'search'
  busca.placeholder = 'Buscar por nome ou login'

  const filtroPerfil = document.createElement('select')
  filtroPerfil.className = 'campo__controle'
  filtroPerfil.style.width = 'auto'
  filtroPerfil.innerHTML = `
    <option value="">Todos os perfis</option>
    <option value="professor">${PERFIS.professor}</option>
    <option value="coordenador">${PERFIS.coordenador}</option>
    <option value="administrador">${PERFIS.administrador}</option>`

  const filtroSituacao = document.createElement('select')
  filtroSituacao.className = 'campo__controle'
  filtroSituacao.style.width = 'auto'
  filtroSituacao.innerHTML = `
    <option value="">Ativos e inativos</option>
    <option value="ativo">Somente ativos</option>
    <option value="inativo">Somente inativos</option>`

  filtros.append(busca, filtroPerfil, filtroSituacao)

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.style.padding = '0'
  cartao.style.overflow = 'hidden'

  const tabela = document.createElement('table')
  tabela.className = 'tabela'
  tabela.dataset.tour = 'usuarios-tabela'
  tabela.innerHTML = `
    <thead>
      <tr>
        <th>Nome</th><th>Login</th><th>Perfil</th><th>Escopo</th><th>Situação</th>
        <th>Último acesso</th><th></th>
      </tr>
    </thead>
    <tbody></tbody>`
  const corpo = tabela.querySelector('tbody') as HTMLTableSectionElement
  cartao.append(tabela)

  async function carregarSolicitacoes(): Promise<void> {
    const pendentes = await window.painel.invocar('usuario:solicitacoes-pendentes', undefined)
    if (pendentes.length === 0) {
      avisoSolicitacoes.hidden = true
      return
    }
    const logins = pendentes.map((pendente) => pendente.login).join(', ')
    avisoSolicitacoes.className = 'mensagem mensagem--aviso'
    avisoSolicitacoes.textContent =
      pendentes.length === 1
        ? `Há 1 pedido de redefinição de senha pendente: ${logins}.`
        : `Há ${pendentes.length} pedidos de redefinição de senha pendentes: ${logins}.`
    avisoSolicitacoes.hidden = false
  }

  function montarLinha(usuario: UsuarioResumo): HTMLTableRowElement {
    const linha = document.createElement('tr')

    const nome = document.createElement('td')
    nome.textContent = usuario.nomeCompleto
    if (usuario._id === usuarioEmSessao) {
      const marca = document.createElement('span')
      marca.className = 'etiqueta etiqueta--neutra'
      marca.style.marginLeft = '8px'
      marca.textContent = 'você'
      nome.append(marca)
    }

    const login = document.createElement('td')
    login.textContent = usuario.login

    const perfil = document.createElement('td')
    perfil.innerHTML = `<span class="etiqueta etiqueta--neutra">${PERFIS[usuario.perfil]}</span>`

    const escopo = document.createElement('td')
    if (usuario.perfil === 'administrador' || usuario.cursosPermitidos.length === 0) {
      escopo.innerHTML = '<span class="faixas">Todos os cursos</span>'
    } else {
      escopo.textContent = usuario.cursosPermitidos.map(nomeDoCurso).join(', ')
    }

    const situacao = document.createElement('td')
    const etiquetas: string[] = []
    etiquetas.push(
      usuario.ativo
        ? '<span class="etiqueta etiqueta--positiva">Ativo</span>'
        : '<span class="etiqueta etiqueta--atencao">Inativo</span>'
    )
    if (usuario.primeiroAcesso) {
      etiquetas.push('<span class="etiqueta etiqueta--neutra">senha inicial</span>')
    }
    situacao.innerHTML = etiquetas.join(' ')

    const acesso = document.createElement('td')
    acesso.textContent = formatarDataHora(usuario.ultimoAcesso)

    const acoes = document.createElement('td')
    const grupo = document.createElement('div')
    grupo.className = 'acoes-linha'

    const redefinir = document.createElement('button')
    redefinir.className = 'botao--texto'
    redefinir.type = 'button'
    redefinir.textContent = 'Redefinir senha'
    redefinir.addEventListener('click', async () => {
      const confirmou = await confirmar({
        titulo: 'Redefinir a senha?',
        texto:
          `Uma nova senha inicial será gerada para ${usuario.nomeCompleto}. ` +
          'A senha atual deixa de valer imediatamente e o usuário precisará trocá-la no próximo acesso.',
        rotuloConfirmar: 'Redefinir'
      })
      if (!confirmou) return

      const resultado = await window.painel.invocar('usuario:redefinir-senha', {
        usuarioId: usuario._id
      })
      if (!resultado.sucesso) {
        mensagem.mostrar(resultado.mensagem)
        return
      }
      await mostrarSenhaInicial(resultado.usuario.nomeCompleto, resultado.senhaInicial)
      await recarregar()
    })

    /*
     * Três perfis não cabem num botão de alternar: o seletor diz, de uma vez,
     * em que nível a pessoa está e para quais pode ir.
     */
    const seletorPerfil = document.createElement('select')
    seletorPerfil.className = 'campo__controle'
    seletorPerfil.style.width = 'auto'
    for (const [valor, rotulo] of Object.entries(PERFIS)) {
      const opcao = document.createElement('option')
      opcao.value = valor
      opcao.textContent = rotulo
      seletorPerfil.append(opcao)
    }
    seletorPerfil.value = usuario.perfil
    seletorPerfil.addEventListener('change', async () => {
      const resultado = await window.painel.invocar('usuario:alterar-perfil', {
        usuarioId: usuario._id,
        perfil: seletorPerfil.value as PerfilUsuario
      })
      if (!resultado.sucesso) {
        mensagem.mostrar(resultado.mensagem)
        seletorPerfil.value = usuario.perfil
        return
      }
      await recarregar()
    })

    const definirEscopo = document.createElement('button')
    definirEscopo.className = 'botao--texto'
    definirEscopo.type = 'button'
    definirEscopo.textContent = 'Escopo de cursos'
    definirEscopo.hidden = usuario.perfil === 'administrador'
    definirEscopo.addEventListener('click', async () => {
      const marcados = new Set(usuario.cursosPermitidos)

      const conteudo = document.createElement('div')
      conteudo.className = 'chips'
      if (cursos.length === 0) {
        const vazio = document.createElement('span')
        vazio.className = 'faixas'
        vazio.textContent = 'Nenhum curso cadastrado ainda.'
        conteudo.append(vazio)
      }
      for (const curso of cursos) {
        const rotulo = document.createElement('label')
        rotulo.className = 'chip'
        const caixa = document.createElement('input')
        caixa.type = 'checkbox'
        caixa.checked = marcados.has(curso._id)
        caixa.addEventListener('change', () => {
          if (caixa.checked) marcados.add(curso._id)
          else marcados.delete(curso._id)
        })
        rotulo.append(caixa, document.createTextNode(nomeDoCurso(curso._id)))
        conteudo.append(rotulo)
      }

      const confirmou = await confirmar({
        titulo: `Escopo de ${usuario.nomeCompleto}`,
        texto:
          'Marque os cursos que esta pessoa enxerga. Nenhum marcado significa todos ' +
          'os cursos do departamento.',
        conteudo,
        rotuloConfirmar: 'Salvar escopo'
      })
      if (!confirmou) return

      const resultado = await window.painel.invocar('usuario:alterar-escopo', {
        usuarioId: usuario._id,
        cursosPermitidos: [...marcados]
      })
      if (!resultado.sucesso) {
        mensagem.mostrar(resultado.mensagem)
        return
      }
      await recarregar()
    })

    const situacaoBotao = document.createElement('button')
    situacaoBotao.className = 'botao--texto'
    situacaoBotao.type = 'button'
    situacaoBotao.textContent = usuario.ativo ? 'Desativar' : 'Reativar'
    if (usuario.ativo) situacaoBotao.dataset.perigo = 'true'
    situacaoBotao.addEventListener('click', async () => {
      if (usuario.ativo) {
        const confirmou = await confirmar({
          titulo: 'Desativar este usuário?',
          texto:
            `${usuario.nomeCompleto} perderá o acesso ao painel imediatamente. ` +
            'O histórico de importações feitas por ele é preservado.',
          rotuloConfirmar: 'Desativar',
          perigo: true
        })
        if (!confirmou) return
      }

      const resultado = await window.painel.invocar('usuario:alterar-situacao', {
        usuarioId: usuario._id,
        ativo: !usuario.ativo
      })
      if (!resultado.sucesso) {
        mensagem.mostrar(resultado.mensagem)
        return
      }
      await recarregar()
    })

    grupo.append(redefinir, seletorPerfil, definirEscopo, situacaoBotao)
    acoes.append(grupo)

    linha.append(nome, login, perfil, escopo, situacao, acesso, acoes)
    return linha
  }

  async function recarregar(): Promise<void> {
    mensagem.esconder()

    const filtro: FiltroUsuarios = {}
    if (busca.value.trim()) filtro.busca = busca.value.trim()
    if (filtroPerfil.value) filtro.perfil = filtroPerfil.value as PerfilUsuario
    if (filtroSituacao.value) filtro.ativo = filtroSituacao.value === 'ativo'

    cursos = await window.painel.invocar('curso:listar', undefined)
    const usuarios = await window.painel.invocar('usuario:listar', filtro)
    corpo.replaceChildren()

    if (usuarios.length === 0) {
      const linha = document.createElement('tr')
      const celula = document.createElement('td')
      celula.colSpan = 7
      celula.style.textAlign = 'center'
      celula.style.color = 'var(--cor-texto-suave)'
      celula.style.padding = 'var(--espaco-6)'
      celula.textContent = 'Nenhum usuário encontrado com esses filtros.'
      linha.append(celula)
      corpo.append(linha)
    } else {
      for (const usuario of usuarios) corpo.append(montarLinha(usuario))
    }

    await carregarSolicitacoes()
  }

  busca.addEventListener('input', () => void recarregar())
  filtroPerfil.addEventListener('change', () => void recarregar())
  filtroSituacao.addEventListener('change', () => void recarregar())

  container.append(cabecalho, avisoSolicitacoes, mensagem.elemento, filtros, cartao)
  void recarregar()
  return container
}
