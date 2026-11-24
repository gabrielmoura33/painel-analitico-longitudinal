import { criarAreaMensagem, criarCampo } from '../componentes/formulario'
import { montarMolduraAcesso } from '../componentes/moldura-acesso'
import { navegarPara } from '../rotas'

/**
 * Pedido de redefinição de senha.
 *
 * O cadastro de usuários não coleta e-mail, então não existe canal para enviar
 * link: o pedido vira pendência para o administrador, que redefine a senha e a
 * entrega pelo canal institucional.
 */
export function montarRecuperarSenha(): HTMLElement {
  const formulario = document.createElement('form')

  const titulo = document.createElement('h1')
  titulo.className = 'acesso__titulo'
  titulo.textContent = 'Recuperar acesso'

  const subtitulo = document.createElement('p')
  subtitulo.className = 'acesso__subtitulo'
  subtitulo.textContent =
    'Informe seu usuário. O pedido será encaminhado ao administrador, que gera uma nova senha inicial.'

  const mensagem = criarAreaMensagem()
  const usuario = criarCampo({ rotulo: 'Usuário', placeholder: 'Digite seu usuário', autoFoco: true })

  const enviar = document.createElement('button')
  enviar.type = 'submit'
  enviar.className = 'botao botao--bloco'
  enviar.textContent = 'Solicitar redefinição'

  const voltar = document.createElement('button')
  voltar.type = 'button'
  voltar.className = 'botao botao--secundario botao--bloco'
  voltar.style.marginTop = 'var(--espaco-3)'
  voltar.textContent = 'Voltar para o login'
  voltar.addEventListener('click', () => navegarPara('/login'))

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()

    if (!usuario.valor().trim()) {
      usuario.definirErro('Informe o usuário.')
      return
    }

    enviar.disabled = true
    const resultado = await window.painel.invocar('senha:solicitar-redefinicao', {
      login: usuario.valor()
    })
    enviar.disabled = false

    // A resposta é sempre a mesma, exista o login ou não.
    mensagem.mostrar(resultado.mensagem ?? 'Pedido registrado.', 'sucesso')
    usuario.limpar()
  })

  formulario.append(titulo, subtitulo, mensagem.elemento, usuario.elemento, enviar, voltar)
  return montarMolduraAcesso(formulario)
}
