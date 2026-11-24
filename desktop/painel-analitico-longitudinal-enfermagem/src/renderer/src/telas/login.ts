import { criarAreaMensagem, criarCaixaSelecao, criarCampo } from '../componentes/formulario'
import { montarMolduraAcesso } from '../componentes/moldura-acesso'
import { navegarPara } from '../rotas'

export function montarLogin(aoEntrar: () => Promise<void>): HTMLElement {
  const formulario = document.createElement('form')

  const titulo = document.createElement('h1')
  titulo.className = 'acesso__titulo'
  titulo.textContent = 'Entrar'

  const subtitulo = document.createElement('p')
  subtitulo.className = 'acesso__subtitulo'
  subtitulo.textContent = 'Use seu usuário e senha institucionais.'

  const mensagem = criarAreaMensagem()

  const usuario = criarCampo({
    rotulo: 'Usuário',
    placeholder: 'Digite seu usuário',
    autoFoco: true
  })

  const senha = criarCampo({
    rotulo: 'Senha',
    tipo: 'password',
    placeholder: 'Digite sua senha',
    acaoRotulo: { texto: 'Esqueci a senha', aoClicar: () => navegarPara('/recuperar-senha') }
  })

  const manterConectado = criarCaixaSelecao('Manter conectado')

  const entrar = document.createElement('button')
  entrar.type = 'submit'
  entrar.className = 'botao botao--bloco'
  entrar.textContent = 'Entrar'

  const rodape = document.createElement('p')
  rodape.className = 'acesso__rodape'
  rodape.textContent = 'Problemas de acesso? Contate o suporte de TI.'

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensagem.esconder()

    if (!usuario.valor().trim()) {
      usuario.definirErro('Informe o usuário.')
      return
    }
    if (!senha.valor()) {
      senha.definirErro('Informe a senha.')
      return
    }

    entrar.disabled = true
    entrar.textContent = 'Entrando…'

    const resultado = await window.painel.invocar('sessao:entrar', {
      login: usuario.valor(),
      senha: senha.valor(),
      manterConectado: manterConectado.marcada()
    })

    entrar.disabled = false
    entrar.textContent = 'Entrar'

    if (!resultado.sucesso) {
      mensagem.mostrar(resultado.mensagem ?? 'Não foi possível entrar.')
      senha.limpar()
      return
    }

    await aoEntrar()
  })

  formulario.append(
    titulo,
    subtitulo,
    mensagem.elemento,
    usuario.elemento,
    senha.elemento,
    manterConectado.elemento,
    entrar,
    rodape
  )

  return montarMolduraAcesso(formulario)
}
