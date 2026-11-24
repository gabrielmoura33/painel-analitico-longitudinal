import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, app, shell } from 'electron'

import { JANELA, NOME_APLICACAO } from '@compartilhado/constants'

/** Mesma página, ignorando parâmetros e âncora — é o caso de um recarregamento. */
function mesmoDocumento(primeira: string, segunda: string): boolean {
  try {
    const a = new URL(primeira)
    const b = new URL(segunda)
    return a.protocol === b.protocol && a.host === b.host && a.pathname === b.pathname
  } catch {
    return false
  }
}

/**
 * Ícone usado pela janela em desenvolvimento e no Windows/Linux.
 *
 * No aplicativo empacotado quem define o ícone é o electron-builder, a partir
 * de build/icon.png; aqui a busca é só para a execução a partir do código.
 */
function caminhoDoIcone(): string | undefined {
  const candidatos = [
    join(app.getAppPath(), 'build', 'icon.png'),
    join(process.resourcesPath, 'build', 'icon.png')
  ]
  return candidatos.find((caminho) => existsSync(caminho))
}

export function criarJanelaPrincipal(): BrowserWindow {
  const janela = new BrowserWindow({
    width: JANELA.larguraInicial,
    height: JANELA.alturaInicial,
    minWidth: JANELA.larguraMinima,
    minHeight: JANELA.alturaMinima,
    show: false,
    title: NOME_APLICACAO,
    backgroundColor: '#F4F6F5',
    autoHideMenuBar: false,
    icon: caminhoDoIcone(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  janela.once('ready-to-show', () => janela.show())

  const arquivoInterface = join(__dirname, '../renderer/index.html')
  const enderecoInterface =
    process.env.ELECTRON_RENDERER_URL ?? pathToFileURL(arquivoInterface).toString()

  // Links externos abrem no navegador do sistema, nunca dentro do app.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  /*
   * A janela só carrega a própria interface. Recarregar a mesma página é
   * permitido — é o que faz o item "Recarregar" do menu e o que a interface
   * usa ao trocar de sessão —, qualquer outro destino é bloqueado.
   */
  janela.webContents.on('will-navigate', (evento, url) => {
    if (!mesmoDocumento(url, enderecoInterface)) evento.preventDefault()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void janela.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void janela.loadFile(arquivoInterface)
  }

  return janela
}
