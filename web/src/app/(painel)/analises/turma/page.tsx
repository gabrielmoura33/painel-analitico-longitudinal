import Link from 'next/link'

import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { Bloco, EstadoVazio, Kpi } from '@/ui/componentes/basicos'
import { CaixaDispersao } from '@/ui/componentes/caixa-dispersao'

export const dynamic = 'force-dynamic'

export default async function PaginaTurma({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const filtros = await searchParams
  const { indicadores, contexto } = await contextoDaPagina(filtros)

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    return <EstadoVazio texto="Nenhuma aplicação importada ainda." />
  }

  const visao = await indicadores.visaoTurma(
    contexto.cursoId,
    contexto.aplicacaoId,
    filtros.periodo
  )
  if (!visao) return <EstadoVazio texto="Não foi possível montar a visão de turma." />

  const percentual = (valor: number): string => `${valor.toFixed(1)}%`

  function urlDoPeriodo(periodo: string): string {
    const parametros = new URLSearchParams()
    if (contexto.cursoId) parametros.set('curso', contexto.cursoId)
    if (contexto.aplicacaoId) parametros.set('aplicacao', contexto.aplicacaoId)
    parametros.set('periodo', periodo)
    return `/analises/turma?${parametros.toString()}`
  }

  return (
    <>
      <BarraContexto contexto={contexto} />

      <div className="cabecalho-pagina">
        <div className="migalhas">{visao.cursoNome} › Turma</div>
        <h1>Turma do {visao.periodo}</h1>
        <p>
          Todos os períodos fazem a mesma prova no mesmo dia — a diferença entre eles é de
          formação, não de prova.
        </p>
      </div>

      <div className="chips" data-tour="turma-periodo">
        {visao.periodosDisponiveis.map((periodo) => (
          <Link
            className="chip"
            key={periodo}
            href={urlDoPeriodo(periodo)}
            aria-current={periodo === visao.periodo ? 'page' : undefined}
          >
            {periodo}
          </Link>
        ))}
      </div>

      <div className="kpis" data-tour="turma-kpis">
        <Kpi rotulo="Discentes" valor={String(visao.kpis.totalDiscentes)} />
        <Kpi
          rotulo="Total de acertos"
          valor={`${visao.kpis.acertosMedios.toFixed(1)} de ${visao.kpis.totalQuestoes}`}
        />
        <Kpi rotulo="% de acerto" valor={percentual(visao.kpis.percentualMedio)} />
        <Kpi rotulo="Nota média pela régua" valor={visao.kpis.notaMedia.toFixed(1)} />
        <Kpi
          rotulo="Acima do mínimo do período"
          valor={percentual(visao.kpis.percentualAcimaDoMinimo)}
        />
      </div>

      <Bloco
        titulo="O que a média esconde"
        descricao="Cada barra vai do pior ao melhor acerto individual na área; a caixa cobre a metade central da turma."
      >
        <div data-tour="turma-dispersao">
          <CaixaDispersao areas={visao.dispersaoPorArea} />
        </div>
      </Bloco>

      <Bloco titulo="Comparativo entre períodos" descricao="Mesma prova, mesmo dia.">
        <table className="tabela">
          <thead>
            <tr>
              <th>Período</th>
              <th>Acerto médio</th>
              <th>Nota média</th>
              <th>Discentes</th>
            </tr>
          </thead>
          <tbody>
            {visao.comparativoPeriodos.map((linha) => (
              <tr key={linha.periodo}>
                <td>{linha.periodo}</td>
                <td>{percentual(linha.percentualMedio)}</td>
                <td>{linha.notaMedia.toFixed(1)}</td>
                <td>{linha.discentes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <Bloco
        titulo="A turma pessoa por pessoa"
        descricao="Identificada por pseudônimo, como manda a Lei Geral de Proteção de Dados."
      >
        <table className="tabela" data-tour="turma-discentes">
          <thead>
            <tr>
              <th>Pseudônimo</th>
              <th>Acertos</th>
              <th>% de acerto</th>
              <th>Nota</th>
              <th>Variação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visao.discentes.map((linha) => (
              <tr key={linha.discenteId}>
                <td>{linha.pseudonimo}</td>
                <td>
                  {linha.acertos} de {linha.totalQuestoes}
                </td>
                <td>{percentual(linha.percentual)}</td>
                <td>{linha.nota.toFixed(1)}</td>
                {/* Travessão, nunca zero: "sem aplicação anterior" não é "não mudou". */}
                <td>{linha.variacao === null ? '—' : `${linha.variacao.toFixed(1)} p.p.`}</td>
                <td>
                  <Link
                    className="botao--texto"
                    href={`/analises/discente?curso=${contexto.cursoId}&discente=${linha.discenteId}`}
                  >
                    Abrir ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    </>
  )
}
