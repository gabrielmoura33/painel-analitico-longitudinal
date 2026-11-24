import { notFound } from 'next/navigation'

import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { EditorDeCurso } from '@/ui/componentes/editor-de-curso'

export const dynamic = 'force-dynamic'

export default async function PaginaEditarCurso({
  params
}: {
  params: Promise<{ cursoId: string }>
}): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)

  const { cursoId } = await params
  const curso = await Container.paraRequisicao().cursos().obter(cursoId)
  if (!curso) notFound()

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">Administração › Cursos</div>
        <h1>{curso.nome}</h1>
        <p>
          {curso.sigla}
          {curso.campus ? ` · ${curso.campus}` : ''}
        </p>
      </div>

      <EditorDeCurso
        cursoId={curso._id}
        inicial={{
          nome: curso.nome,
          sigla: curso.sigla,
          instituicao: curso.instituicao,
          // Cursos anteriores a estes campos não trazem as chaves.
          campus: curso.campus ?? '',
          departamento: curso.departamento ?? '',
          nomeInstrumento: curso.nomeInstrumento,
          estrutura: curso.estrutura,
          areas: curso.areas ?? [],
          regua: curso.regua,
          perfilImportacao: {
            ...curso.perfilImportacao,
            linhaMatricula: curso.perfilImportacao.linhaMatricula ?? null,
            linhaTotal: curso.perfilImportacao.linhaTotal ?? null
          }
        }}
      />
    </>
  )
}
