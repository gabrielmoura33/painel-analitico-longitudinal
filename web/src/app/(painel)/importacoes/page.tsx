import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { AssistenteImportacao } from '@/ui/componentes/assistente-importacao'
import { EstadoVazio } from '@/ui/componentes/basicos'

export const dynamic = 'force-dynamic'

export default async function PaginaImportacoes(): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.importacao)

  // Só os cursos do escopo: a coordenação alimenta o próprio campus.
  const cursos = await Container.paraRequisicao().cursos().listar(escopo)

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Importar planilha</h1>
        <p>É por aqui que a série longitudinal cresce. Nada é gravado antes da confirmação.</p>
      </div>

      {cursos.length === 0 ? (
        <EstadoVazio texto="Nenhum curso no seu escopo. Cadastre o curso antes de importar: é ele que diz como ler a planilha." />
      ) : (
        <AssistenteImportacao
          cursos={cursos.map((curso) => ({
            _id: curso._id,
            sigla: curso.sigla,
            nome: curso.nome
          }))}
        />
      )}
    </>
  )
}
