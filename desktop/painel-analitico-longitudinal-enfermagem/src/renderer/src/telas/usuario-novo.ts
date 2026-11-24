import { ehPerfilValido } from '@compartilhado/acesso'
import { DESCRICAO_PERFIS, PERFIS } from '@compartilhado/constants'
import type { Curso } from '@compartilhado/types/dominio'
import { formatarCpf } from '@compartilhado/validacao'

import { criarAreaMensagem, criarCampo, criarSeletorPerfil } from '../componentes/formulario'
import { mostrarSenhaInicial } from '../componentes/modal'
import { navegarPara } from '../rotas'

/** Cadastro de novo usuário, conforme o mockup aprovado. */
export function montarCadastroUsuario(): HTMLElement {
  const container = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina'
  cabecalho.innerHTML = `
    <div class="migalhas">Administração › Usuários</div>
    <h1>Cadastro de novo usuário</h1>
    <p>Todos os campos são obrigatórios.</p>`

  const cartao = document.createElement('div')
  cartao.className = 'cartao cartao--formulario'

  const formulario = document.createElement('form')
  const mensagem = criarAreaMensagem()

  const nome = criarCampo({ rotulo: 'Nome completo', placeholder: 'Ex.: Maria da Silva', autoFoco: true })

  const cpf = criarCampo({ rotulo: 'CPF', placeholder: '000.000.000-00' })
  cpf.entrada.addEventListener('input', () => {
    cpf.entrada.value = formatarCpf(cpf.entrada.value)
  })

  const nascimento = criarCampo({ rotulo: 'Data de nascimento', tipo: 'date' })

  const login = criarCampo({
    rotulo: 'Login',
    placeholder: 'Ex.: maria.silva',
    dica: 'A senha inicial será exibida uma única vez após o cadastro, para entrega ao usuário.'
  })

  const rotuloPerfil = document.createElement('div')
  rotuloPerfil.className = 'campo__rotulo'
  rotuloPerfil.style.marginBottom = 'var(--espaco-2)'
  rotuloPerfil.textContent = 'Perfil'

  const perfil = criarSeletorPerfil([
    {
      valor: 'professor',
      titulo: PERFIS.professor,
      descricao: DESCRICAO_PERFIS.professor
    },
    {
      valor: 'coordenador',
      titulo: PERFIS.coordenador,
      descricao: DESCRICAO_PERFIS.coordenador
    },
    {
      valor: 'administrador',
      titulo: PERFIS.administrador,
      descricao: DESCRICAO_PERFIS.administrador
    }
  ])

  /*
   * Escopo de cursos.
   *
   * O departamento tem o mesmo curso em mais de um campus, e a coordenação
   * responde pelo seu. Nenhum curso marcado significa todos — é o que vale
   * para o administrador e para uma instalação de um curso só.
   */
  const escopo = document.createElement('div')
  escopo.className = 'secao'
  const escopoCabecalho = document.createElement('div')
  escopoCabecalho.innerHTML =
    '<div class="campo__rotulo">Cursos que este usuário enxerga</div>' +
    '<p class="campo__dica">Nenhum marcado: todos os cursos do departamento. ' +
    'O administrador alcança todos, sempre.</p>'
  const listaCursos = document.createElement('div')
  listaCursos.className = 'chips'
  escopo.append(escopoCabecalho, listaCursos)

  const marcados = new Set<string>()
  let cursos: Curso[] = []

  function desenharCursos(): void {
    listaCursos.replaceChildren()
    const ehAdministrador = perfil.valor() === 'administrador'
    escopo.hidden = ehAdministrador

    if (cursos.length === 0) {
      const vazio = document.createElement('span')
      vazio.className = 'faixas'
      vazio.textContent = 'Nenhum curso cadastrado ainda: o usuário verá todos os que vierem.'
      listaCursos.append(vazio)
      return
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

      const texto = [curso.sigla, curso.campus].filter(Boolean).join(' · ')
      rotulo.append(caixa, document.createTextNode(`${curso.nome}${texto ? ` (${texto})` : ''}`))
      listaCursos.append(rotulo)
    }
  }

  perfil.elemento.addEventListener('change', desenharCursos)

  void (async () => {
    cursos = await window.painel.invocar('curso:listar', undefined)
    desenharCursos()
  })()

  const erroPerfil = document.createElement('p')
  erroPerfil.className = 'campo__erro'
  erroPerfil.hidden = true

  const acoes = document.createElement('div')
  acoes.className = 'acoes-formulario'

  const limpar = document.createElement('button')
  limpar.type = 'button'
  limpar.className = 'botao botao--secundario'
  limpar.textContent = 'Limpar'

  const cadastrar = document.createElement('button')
  cadastrar.type = 'submit'
  cadastrar.className = 'botao'
  cadastrar.textContent = 'Cadastrar usuário'

  const limparFormulario = (): void => {
    nome.limpar()
    cpf.limpar()
    nascimento.limpar()
    login.limpar()
    perfil.limpar()
    marcados.clear()
    desenharCursos()
    erroPerfil.hidden = true
    mensagem.esconder()
  }

  limpar.addEventListener('click', limparFormulario)
  acoes.append(limpar, cadastrar)

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensagem.esconder()
    erroPerfil.hidden = true

    const perfilEscolhido = perfil.valor()
    if (!ehPerfilValido(perfilEscolhido)) {
      erroPerfil.textContent = 'Selecione um perfil.'
      erroPerfil.hidden = false
      return
    }

    cadastrar.disabled = true
    const resultado = await window.painel.invocar('usuario:criar', {
      nomeCompleto: nome.valor(),
      cpf: cpf.valor(),
      dataNascimento: nascimento.valor(),
      login: login.valor(),
      perfil: perfilEscolhido,
      cursosPermitidos: perfilEscolhido === 'administrador' ? [] : [...marcados]
    })
    cadastrar.disabled = false

    if (!resultado.sucesso) {
      mensagem.mostrar(resultado.mensagem)
      return
    }

    await mostrarSenhaInicial(resultado.usuario.nomeCompleto, resultado.senhaInicial)
    navegarPara('/admin/usuarios')
  })

  const grade = document.createElement('div')
  grade.className = 'grade-2'
  grade.append(cpf.elemento, nascimento.elemento)

  formulario.append(
    mensagem.elemento,
    nome.elemento,
    grade,
    login.elemento,
    rotuloPerfil,
    perfil.elemento,
    erroPerfil,
    escopo,
    acoes
  )

  cartao.append(formulario)
  container.append(cabecalho, cartao)
  return container
}
