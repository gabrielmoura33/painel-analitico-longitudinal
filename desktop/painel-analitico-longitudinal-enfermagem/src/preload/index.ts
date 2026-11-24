import { contextBridge, ipcRenderer, webUtils } from 'electron'

import type { ApiPainel, CanalIpc, EntradaDe, SaidaDe } from '@compartilhado/types/ipc'

/**
 * Única ponte entre renderer e main.
 *
 * O renderer não enxerga `ipcRenderer`, `require` nem nada do Node: recebe
 * apenas `invocar`, e só consegue chamar canais que existam no contrato.
 */
const api: ApiPainel = {
  invocar<C extends CanalIpc>(canal: C, entrada: EntradaDe<C>): Promise<SaidaDe<C>> {
    return ipcRenderer.invoke(canal, entrada) as Promise<SaidaDe<C>>
  },

  /**
   * Caminho real de um arquivo escolhido na interface, seja arrastado para a
   * janela ou selecionado por um campo de arquivo. É o único modo suportado de
   * obter o caminho: `File.path` não existe mais no Electron.
   */
  caminhoDoArquivo(arquivo: File): string {
    return webUtils.getPathForFile(arquivo)
  }
}

contextBridge.exposeInMainWorld('painel', api)
