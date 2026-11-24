import { cursoInicial } from '@/aplicacao/casos/cursos'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { EditorDeCurso } from '@/ui/componentes/editor-de-curso'

export const dynamic = 'force-dynamic'

export default async function PaginaCursoNovo(): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">Administração › Cursos</div>
        <h1>Novo curso</h1>
        <p>Os valores sugeridos vêm do Teste de Progresso de Enfermagem; ajuste o que diferir.</p>
      </div>

      <EditorDeCurso cursoId={null} inicial={cursoInicial()} />
    </>
  )
}
