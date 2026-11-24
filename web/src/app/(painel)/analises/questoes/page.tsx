import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { Bloco, EstadoVazio, Kpi } from '@/ui/componentes/basicos'
import { FiltrosQuestoes } from '@/ui/componentes/filtros-questoes'
import { MiniSerie } from '@/ui/componentes/mini-serie'

export const dynamic = 'force-dynamic'

export default async function PaginaQuestoes({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const filtros = await searchParams
  const { indicadores, contexto } = await contextoDaPagina(filtros)

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    return <EstadoVazio texto="Nenhuma aplicação importada ainda." />
  }

  const visao = await indicadores.visaoQuestoes(contexto.cursoId, contexto.aplicacaoId)
  if (!visao) return <EstadoVazio texto="Não foi possível montar a visão de questões." />

  const componentes = [...new Set(visao.questoes.map((questao) => questao.componente))].sort()
  const docentes = [...new Set(visao.questoes.map((questao) => questao.docente))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  // Os três filtros se somam.
  const questoes = visao.questoes.filter((questao) => {
    if (filtros.componente && questao.componente !== filtros.componente) return false
    if (filtros.docente && questao.docente !== filtros.docente) return false
    if (filtros.criticas === '1' && !questao.criticaEmTodosOsPeriodos) return false
    return true
  })

  const contar = (dificuldade: string): number =>
    visao.questoes.filter((questao) => questao.dificuldade === dificuldade).length

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">{visao.cursoNome} › Análises</div>
        <h1>Questões</h1>
        <p>Aplicação {visao.aplicacao.rotulo}</p>
      </div>

      <BarraContexto contexto={contexto} />

      <div className="kpis" data-tour="questoes-kpis">
        <Kpi rotulo="Difíceis (abaixo de 50%)" valor={String(contar('dificil'))} />
        <Kpi rotulo="Médias" valor={String(contar('media'))} />
        <Kpi rotulo="Fáceis (70% ou mais)" valor={String(contar('facil'))} />
        <Kpi
          rotulo="Críticas em todos os períodos"
          valor={String(visao.totalCriticas)}
          nota="Candidatas a revisão de enunciado ou conteúdo"
        />
      </div>

      <FiltrosQuestoes componentes={componentes} docentes={docentes} />

      <Bloco titulo="Questões" descricao={`${questoes.length} de ${visao.questoes.length}`}>
        <table className="tabela" data-tour="questoes-tabela">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Tema</th>
              <th>Gabarito</th>
              <th>Docente</th>
              <th>Componente</th>
              <th>Acerto</th>
              <th>Por período</th>
            </tr>
          </thead>
          <tbody>
            {questoes.map((questao) => (
              <tr key={questao.numero}>
                <td>{questao.numero}</td>
                <td>{questao.tema}</td>
                <td>{questao.gabarito}</td>
                <td>{questao.docente || '—'}</td>
                <td>{questao.componente}</td>
                <td>{questao.percentual.toFixed(1)}%</td>
                <td>
                  <MiniSerie valores={questao.porPeriodo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <div className="indisponivel" data-tour="questoes-indisponivel">
        <strong>O que esta fonte não permite saber.</strong> A planilha registra apenas se o
        discente acertou, nunca qual alternativa ele marcou. A distribuição de alternativas
        precisaria de uma mudança na coleta, não no programa.
      </div>
    </>
  )
}
