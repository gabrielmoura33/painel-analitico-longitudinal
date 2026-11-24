import type { ApiPainel } from '@compartilhado/types/ipc'

declare global {
  interface Window {
    painel: ApiPainel
  }
}

export {}
