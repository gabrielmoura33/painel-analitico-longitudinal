import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { sair } from '@/app/acoes/sessao'
import { PERFIS } from '@/dominio/modelos/constantes'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

export const dynamic = 'force-dynamic'

interface ItemMenu {
  caminho: string
  titulo: string
  perfis?: readonly string[]
}

/**
 * Menu do painel.
 *
 * Os perfis vêm de `EscopoDeAcesso`, a mesma tabela que o servidor usa para
 * autorizar. Esconder um item aqui é cortesia visual — quem digitar a rota na
 * barra de endereços esbarra na verificação do servidor de qualquer modo.
 */
const MENU: ItemMenu[] = [
  { caminho: '/visao-geral', titulo: 'Visão geral' },
  { caminho: '/analises/discente', titulo: 'Discente' },
  { caminho: '/analises/turma', titulo: 'Turma' },
  { caminho: '/analises/areas', titulo: 'Áreas' },
  { caminho: '/analises/questoes', titulo: 'Questões' },
  { caminho: '/analises/docentes', titulo: 'Docentes' },
  {
    caminho: '/importacoes',
    titulo: 'Importar',
    perfis: EscopoDeAcesso.PERFIS_POR_AREA.importacao
  },
  {
    caminho: '/admin/usuarios',
    titulo: 'Usuários',
    perfis: EscopoDeAcesso.PERFIS_POR_AREA.administracao
  },
  {
    caminho: '/admin/cursos',
    titulo: 'Cursos',
    perfis: EscopoDeAcesso.PERFIS_POR_AREA.administracao
  },
  { caminho: '/admin/historico', titulo: 'Histórico' },
  { caminho: '/guia', titulo: 'Guia' },
  { caminho: '/sistema', titulo: 'Diagnóstico' }
]

export default async function LayoutPainel({
  children
}: {
  children: ReactNode
}): Promise<React.ReactElement> {
  const usuario = await SessaoHttp.usuario()
  if (!usuario) redirect('/login')
  if (usuario.primeiroAcesso) redirect('/definir-senha')

  const visiveis = MENU.filter((item) => !item.perfis || item.perfis.includes(usuario.perfil))

  return (
    <>
      <header className="topbar">
        <div className="topbar__marca">
          <span className="topbar__simbolo" aria-hidden="true">
            PA
          </span>
          <span>
            <span className="topbar__titulo">Painel Analítico</span>
            <span className="topbar__subtitulo">Enfermagem · PUC Minas</span>
          </span>
        </div>

        <nav className="topbar__nav" aria-label="Seções do painel">
          {visiveis.map((item) => (
            <Link className="topbar__link" key={item.caminho} href={item.caminho}>
              {item.titulo}
            </Link>
          ))}
        </nav>

        <div className="topbar__contexto">
          <span className="topbar__etiqueta-contexto">
            {usuario.nomeCompleto} · {PERFIS[usuario.perfil]}
          </span>
          <form action={sair}>
            <button className="topbar__sair botao--texto" type="submit">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="conteudo">{children}</main>
    </>
  )
}
