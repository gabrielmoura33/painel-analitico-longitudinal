import { Menu, app, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { NOME_APLICACAO } from '@compartilhado/constants'

/**
 * Menu nativo em português. Os itens de importação e exportação já aparecem
 * aqui, desabilitados, para que a estrutura não mude quando a Fase 4 chegar.
 */
export function instalarMenu(janela: BrowserWindow): void {
  const ehMac = process.platform === 'darwin'

  const menuApp: MenuItemConstructorOptions[] = ehMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: 'about', label: `Sobre o ${NOME_APLICACAO}` },
            { type: 'separator' },
            { role: 'hide', label: 'Ocultar' },
            { role: 'hideOthers', label: 'Ocultar outros' },
            { role: 'unhide', label: 'Mostrar tudo' },
            { type: 'separator' },
            { role: 'quit', label: `Sair do ${NOME_APLICACAO}` }
          ]
        }
      ]
    : []

  const modelo: MenuItemConstructorOptions[] = [
    ...menuApp,
    {
      label: 'Arquivo',
      submenu: [
        { label: 'Importar planilha…', accelerator: 'CmdOrCtrl+I', enabled: false },
        { label: 'Exportar visão atual…', accelerator: 'CmdOrCtrl+E', enabled: false },
        { type: 'separator' },
        ehMac ? { role: 'close', label: 'Fechar janela' } : { role: 'quit', label: 'Sair' }
      ]
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvimento' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho original' },
        { role: 'zoomIn', label: 'Aumentar' },
        { role: 'zoomOut', label: 'Diminuir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre os dados desta instalação',
          click: () => janela.webContents.send('menu:sobre-dados')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(modelo))
}
