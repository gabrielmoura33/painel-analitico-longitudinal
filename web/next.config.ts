import type { NextConfig } from 'next'

/**
 * Configuração do Next.
 *
 * `cacheComponents` vem ligado no projeto gerado e foi desligado de
 * propósito. Ele pressupõe páginas que podem ser pré-renderizadas e só então
 * completadas com as partes dinâmicas. Aqui não há parte estática: toda tela
 * depende do usuário em sessão, do escopo de cursos dele e de dados pessoais
 * sob LGPD. Manter o recurso ligado obrigaria a marcar cada página com
 * `'use cache'` e Suspense para, no fim, não cachear nada — e um descuido
 * nessa marcação serviria a página de uma pessoa para outra.
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
  partialPrefetching: false
}

export default nextConfig
