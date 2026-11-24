import Link from 'next/link'

import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { BotaoRemoverCurso } from '@/ui/componentes/botao-remover-curso'

export const dynamic = 'force-dynamic'

export default async function PaginaCursos(): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)

  const container = Container.paraRequisicao()
  const cursos = await container.cursos().listar()

  const aplicacoesPorCurso = new Map<string, number>()
  for (const curso of cursos) {
    aplicacoesPorCurso.set(
      curso._id,
      await container.repositorio.aplicacoes.contar({ cursoId: curso._id })
    )
  }

  return (
    <>
      <div className="cabecalho-pagina cabecalho-pagina--com-acao">
        <div>
          <div className="migalhas">Administração</div>
          <h1>Cursos e réguas</h1>
          <p>
            O curso guarda a estrutura da prova, a conversão de acertos em nota e as áreas de
            conhecimento. Mudar a régua recalcula os painéis na hora, sem reimportar nada.
          </p>
        </div>
        <Link className="botao" href="/admin/cursos/novo">
          Novo curso
        </Link>
      </div>

      <div className="cartao" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tabela" data-tour="cursos-tabela">
          <thead>
            <tr>
              <th>Curso</th>
              <th>Campus</th>
              <th>Departamento</th>
              <th>Questões</th>
              <th>Períodos</th>
              <th>Aplicações</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cursos.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--espaco-6)' }}>
                  Nenhum curso cadastrado. Comece por aqui: a importação depende do curso.
                </td>
              </tr>
            ) : null}

            {cursos.map((curso) => (
              <tr key={curso._id}>
                <td>
                  <Link href={`/admin/cursos/${curso._id}`}>
                    {curso.sigla} — {curso.nome}
                  </Link>
                </td>
                <td>{curso.campus || '—'}</td>
                <td>{curso.departamento || '—'}</td>
                <td>{curso.estrutura.totalQuestoes}</td>
                <td>{curso.estrutura.periodos.join(', ')}</td>
                <td>{aplicacoesPorCurso.get(curso._id) ?? 0}</td>
                <td>
                  <div className="acoes-linha">
                    <Link className="botao--texto" href={`/admin/cursos/${curso._id}`}>
                      Editar
                    </Link>
                    <BotaoRemoverCurso
                      cursoId={curso._id}
                      nome={curso.nome}
                      aplicacoes={aplicacoesPorCurso.get(curso._id) ?? 0}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
