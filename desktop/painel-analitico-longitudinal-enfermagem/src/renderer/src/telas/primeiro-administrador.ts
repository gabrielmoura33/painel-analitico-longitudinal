import { REGRAS_SENHA, formatarCpf } from '@compartilhado/validacao'

import {
  criarAreaMensagem,
  criarCaixaSelecao,
  criarCampo,
  criarListaRegras
} from '../componentes/formulario'
import { montarMolduraAcesso } from '../componentes/moldura-acesso'

/**
 * Primeira execução da instalação.
 *
 * Em vez de nascer com um administrador e uma senha padrão — que valeria em
 * toda instalação e nunca seria trocada —, o sistema pede que o primeiro
 * administrador seja criado aqui, com senha própria.
 */
export function montarPrimeiroAdministrador(aoConcluir: () => Promise<void>): HTMLElement {
  const formulario = document.createElement('form')

  const titulo = document.createElement('h1')
  titulo.className = 'acesso__titulo'
  titulo.textContent = 'Primeiro acesso à instalação'

  const subtitulo = document.createElement('p')
  subtitulo.className = 'acesso__subtitulo'
  subtitulo.textContent =
    'Nenhum usuário foi cadastrado ainda. Crie o administrador que vai gerenciar o painel.'

  const mensagem = criarAreaMensagem()

  const nome = criarCampo({ rotulo: 'Nome completo', placeholder: 'Ex.: Maria da Silva', autoFoco: true })

  const cpf = criarCampo({ rotulo: 'CPF', placeholder: '000.000.000-00' })
  cpf.entrada.addEventListener('input', () => {
    cpf.entrada.value = formatarCpf(cpf.entrada.value)
  })

  const nascimento = criarCampo({ rotulo: 'Data de nascimento', tipo: 'date' })
  const login = criarCampo({ rotulo: 'Login', placeholder: 'Ex.: maria.silva' })

  const regras = criarListaRegras(REGRAS_SENHA)
  const senha = criarCampo({
    rotulo: 'Senha',
    tipo: 'password',
    placeholder: 'Crie sua senha',
    aoDigitar: (valor) => regras.avaliar(valor)
  })
  const confirmacao = criarCampo({
    rotulo: 'Confirmar senha',
    tipo: 'password',
    placeholder: 'Repita a senha'
  })

  const aceite = criarCaixaSelecao('Li e aceito o termo de tratamento de dados')

  const criar = document.createElement('button')
  criar.type = 'submit'
  criar.className = 'botao botao--bloco'
  criar.textContent = 'Criar administrador'

  regras.avaliar('')

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensagem.esconder()

    if (senha.valor() !== confirmacao.valor()) {
      confirmacao.definirErro('As senhas não conferem.')
      return
    }

    criar.disabled = true
    const resultado = await window.painel.invocar('sessao:criar-primeiro-administrador', {
      nomeCompleto: nome.valor(),
      cpf: cpf.valor(),
      dataNascimento: nascimento.valor(),
      login: login.valor(),
      senha: senha.valor(),
      aceitouTermo: aceite.marcada()
    })
    criar.disabled = false

    if (!resultado.sucesso) {
      mensagem.mostrar(resultado.mensagem ?? 'Não foi possível criar o administrador.')
      return
    }

    await aoConcluir()
  })

  const grade = document.createElement('div')
  grade.className = 'grade-2'
  grade.append(cpf.elemento, nascimento.elemento)

  formulario.append(
    titulo,
    subtitulo,
    mensagem.elemento,
    nome.elemento,
    grade,
    login.elemento,
    senha.elemento,
    regras.elemento,
    confirmacao.elemento,
    aceite.elemento,
    criar
  )

  return montarMolduraAcesso(formulario, true)
}
