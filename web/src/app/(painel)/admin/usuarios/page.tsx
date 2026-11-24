import Link from 'next/link'

import type { FiltroUsuarios } from '@/dominio/modelos/dtos'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { TabelaUsuarios } from '@/ui/componentes/tabela-usuarios'

export const dynamic = 'force-dynamic'

export default async function PaginaUsuarios({
  searchParams
}: {
  searchParams: Promise<{ busca?: string; perfil?: string; situacao?: string }>
}): Promise<React.ReactElement> {
  const { usuario, escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)

  const filtros = await searchParams
  const container = Container.paraRequisicao()

  // O perfil vem da barra de endereços: só entra no filtro se for um dos válidos.
  const perfilFiltrado = filtros.perfil ?? null
  const filtro: FiltroUsuarios = {}
  if (filtros.busca) filtro.busca = filtros.busca
  if (EscopoDeAcesso.ehPerfilValido(perfilFiltrado)) filtro.perfil = perfilFiltrado
  if (filtros.situacao) filtro.ativo = filtros.situacao === 'ativo'

  const usuarios = await container.usuarios().listar(filtro)

  const cursos = await container.cursos().listar()
  const pendentes = await container.usuarios().solicitacoesPendentes()

  return (
    <>
      <div className="cabecalho-pagina cabecalho-pagina--com-acao">
        <div>
          <div className="migalhas">Administração</div>
          <h1>Usuários</h1>
          <p>Quem tem acesso ao painel e com qual perfil.</p>
        </div>
        <Link className="botao" href="/admin/usuarios/novo">
          Novo usuário
        </Link>
      </div>

      {pendentes.length > 0 ? (
        <div className="mensagem mensagem--aviso">
          {pendentes.length === 1
            ? `Há 1 pedido de redefinição de senha pendente: ${pendentes[0]?.login}.`
            : `Há ${pendentes.length} pedidos de redefinição pendentes: ${pendentes
                .map((pedido) => pedido.login)
                .join(', ')}.`}
        </div>
      ) : null}

      <div className="cartao" style={{ padding: 0, overflow: 'hidden' }}>
        <TabelaUsuarios
          usuarios={usuarios}
          cursos={cursos.map((curso) => ({
            _id: curso._id,
            nome: curso.nome,
            sigla: curso.sigla,
            campus: curso.campus
          }))}
          usuarioEmSessao={usuario._id}
        />
      </div>
    </>
  )
}
