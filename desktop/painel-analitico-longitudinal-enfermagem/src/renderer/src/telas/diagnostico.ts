import type { InfoSistema } from '@compartilhado/types/ipc'

/**
 * Tela de diagnóstico.
 *
 * Existe para provar, de ponta a ponta, que o renderer fala com o processo
 * main pela ponte tipada e que o repositório está conectado. É também o que a
 * docente abre quando precisa dizer ao suporte onde os dados moram.
 */
export async function montarDiagnostico(): Promise<HTMLElement> {
  const container = document.createElement('div')

  const cabecalho = document.createElement('div')
  cabecalho.className = 'cabecalho-pagina'
  cabecalho.innerHTML = `
    <h1>Diagnóstico do sistema</h1>
    <p>Informações desta instalação, úteis para suporte.</p>`

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.dataset.tour = 'diagnostico-dados'

  try {
    const info: InfoSistema = await window.painel.invocar('sistema:info', undefined)

    const linhas: Array<[string, string]> = [
      ['Versão da aplicação', info.versaoAplicacao],
      ['Electron', info.versaoElectron],
      ['Node', info.versaoNode],
      ['Plataforma', info.plataforma],
      ['Driver de persistência', info.driverPersistencia],
      ['Local dos dados', info.caminhoDados],
      ['Chave dos campos sensíveis', info.origemChaveDados]
    ]

    const definicoes = document.createElement('dl')
    definicoes.className = 'definicoes'
    for (const [rotulo, valor] of linhas) {
      const dt = document.createElement('dt')
      dt.textContent = rotulo
      const dd = document.createElement('dd')
      dd.textContent = valor
      definicoes.append(dt, dd)
    }
    cartao.append(definicoes)
  } catch (erro) {
    cartao.textContent = `Não foi possível consultar o processo principal: ${String(erro)}`
  }

  const aviso = document.createElement('div')
  aviso.className = 'aviso-fase'
  aviso.textContent =
    'O driver "local" grava tudo em um arquivo único na pasta de dados do usuário — ' +
    'sem servidor e sem instalação. O driver "mongo" existe na mesma interface e é ' +
    'selecionado pela variável de ambiente PAINEL_DRIVER.'

  container.append(cabecalho, cartao, aviso)
  return container
}
