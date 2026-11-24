import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { FormularioUsuarioNovo } from '@/ui/componentes/formulario-usuario-novo'

export const dynamic = 'force-dynamic'

export default async function PaginaUsuarioNovo(): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)

  const cursos = await Container.paraRequisicao().cursos().listar()

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">Administração › Usuários</div>
        <h1>Novo usuário</h1>
        <p>A senha inicial é gerada pelo sistema e exibida uma única vez.</p>
      </div>

      <FormularioUsuarioNovo
        cursos={cursos.map((curso) => ({
          _id: curso._id,
          sigla: curso.sigla,
          nome: curso.nome
        }))}
      />
    </>
  )
}
