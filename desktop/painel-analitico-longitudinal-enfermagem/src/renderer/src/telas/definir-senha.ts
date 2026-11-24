import { REGRAS_SENHA } from '@compartilhado/validacao'

import {
  criarAreaMensagem,
  criarCaixaSelecao,
  criarCampo,
  criarListaRegras
} from '../componentes/formulario'
import { montarMolduraAcesso } from '../componentes/moldura-acesso'
import { confirmar } from '../componentes/modal'

const TEXTO_TERMO =
  'O Painel Analítico Longitudinal trata dados de desempenho acadêmico de discentes, ' +
  'incluindo nome completo, que é dado pessoal nos termos do art. 5º, I, da Lei 13.709/2018 ' +
  '(LGPD).\n\n' +
  'Ao aceitar, você se compromete a: usar os dados exclusivamente para finalidade pedagógica; ' +
  'não compartilhar visualizações que identifiquem discentes fora do corpo docente responsável; ' +
  'e não exportar nomes reais para fora dos sistemas da instituição.\n\n' +
  'Nas visões coletivas da plataforma os discentes aparecem sempre pseudonimizados. O nome real ' +
  'só é exibido na ficha individual, e cada abertura dessa ficha fica registrada.'

/** Troca obrigatória de senha no primeiro acesso, com aceite do termo. */
export function montarDefinirSenha(aoConcluir: () => Promise<void>): HTMLElement {
  const formulario = document.createElement('form')

  const titulo = document.createElement('h1')
  titulo.className = 'acesso__titulo'
  titulo.textContent = 'Defina sua senha'

  const subtitulo = document.createElement('p')
  subtitulo.className = 'acesso__subtitulo'
  subtitulo.textContent =
    'Este é o seu primeiro acesso. Troque a senha inicial por uma senha pessoal para continuar.'

  const mensagem = criarAreaMensagem()
  const regras = criarListaRegras(REGRAS_SENHA)

  const senhaAtual = criarCampo({
    rotulo: 'Senha atual',
    tipo: 'password',
    placeholder: 'A senha inicial que você recebeu',
    autoFoco: true
  })

  const novaSenha = criarCampo({
    rotulo: 'Nova senha',
    tipo: 'password',
    placeholder: 'Crie sua senha',
    aoDigitar: (valor) => regras.avaliar(valor)
  })

  const confirmacao = criarCampo({
    rotulo: 'Confirmar nova senha',
    tipo: 'password',
    placeholder: 'Repita a nova senha'
  })

  const aceite = criarCaixaSelecao('Li e aceito o termo de tratamento de dados')

  const verTermo = document.createElement('button')
  verTermo.type = 'button'
  verTermo.className = 'campo__link'
  verTermo.textContent = 'Ler o termo'
  verTermo.style.marginBottom = 'var(--espaco-4)'
  verTermo.addEventListener('click', () => {
    const texto = document.createElement('p')
    texto.style.whiteSpace = 'pre-wrap'
    texto.textContent = TEXTO_TERMO
    void confirmar({
      titulo: 'Termo de tratamento de dados',
      conteudo: texto,
      rotuloConfirmar: 'Fechar',
      rotuloCancelar: null as unknown as string
    })
  })

  const salvar = document.createElement('button')
  salvar.type = 'submit'
  salvar.className = 'botao botao--bloco'
  salvar.textContent = 'Definir senha e entrar'

  regras.avaliar('')

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    mensagem.esconder()

    if (novaSenha.valor() !== confirmacao.valor()) {
      confirmacao.definirErro('As senhas não conferem.')
      return
    }

    salvar.disabled = true
    const resultado = await window.painel.invocar('sessao:definir-senha', {
      senhaAtual: senhaAtual.valor(),
      novaSenha: novaSenha.valor(),
      aceitouTermo: aceite.marcada()
    })
    salvar.disabled = false

    if (!resultado.sucesso) {
      mensagem.mostrar(resultado.mensagem ?? 'Não foi possível definir a senha.')
      return
    }

    await aoConcluir()
  })

  formulario.append(
    titulo,
    subtitulo,
    mensagem.elemento,
    senhaAtual.elemento,
    novaSenha.elemento,
    regras.elemento,
    confirmacao.elemento,
    aceite.elemento,
    verTermo,
    salvar
  )

  return montarMolduraAcesso(formulario)
}
