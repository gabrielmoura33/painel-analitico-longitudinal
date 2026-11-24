import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@/ui/estilos/tokens.css'
import '@/ui/estilos/base.css'

export const metadata: Metadata = {
  title: 'Painel Analítico Longitudinal',
  description:
    'Acompanhamento longitudinal de desempenho acadêmico a partir do Teste de Progresso'
}

/**
 * Casca da aplicação.
 *
 * `lang="pt-BR"` não é detalhe: é o que faz o leitor de tela pronunciar os
 * nomes em português e o que orienta a ordenação de texto nas tabelas.
 */
export default function LayoutRaiz({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
