import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { Bloco, EstadoVazio } from '@/ui/componentes/basicos'

export const dynamic = 'force-dynamic'

export default async function PaginaDocentes({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const filtros = await searchParams
  const { indicadores, contexto } = await contextoDaPagina(filtros)

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    return <EstadoVazio texto="Nenhuma aplicação importada ainda." />
  }

  const visao = await indicadores.visaoDocentes(contexto.cursoId, contexto.aplicacaoId)
  if (!visao) return <EstadoVazio texto="Não foi possível montar a visão de docentes." />

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">{visao.cursoNome} › Análises</div>
        <h1>Docentes responsáveis</h1>
        <p>Aplicação {visao.aplicacao.rotulo}</p>
      </div>

      <BarraContexto contexto={contexto} />

      <Bloco
        titulo="Questões por docente"
        descricao="A mesma pessoa em duas linhas com grafias diferentes significa que a unificação não foi confirmada na importação."
      >
        <table className="tabela" data-tour="docentes-tabela">
          <thead>
            <tr>
              <th>Docente</th>
              <th>Questões</th>
              <th>Acerto médio</th>
              <th>Melhor questão</th>
              <th>Pior questão</th>
            </tr>
          </thead>
          <tbody>
            {visao.docentes.map((docente) => (
              <tr key={docente.docente}>
                <td>{docente.docente || '—'}</td>
                <td>{docente.questoes}</td>
                <td>{docente.percentualMedio.toFixed(1)}%</td>
                <td>
                  {docente.melhor
                    ? `${docente.melhor.numero}. ${docente.melhor.tema} (${docente.melhor.percentual.toFixed(0)}%)`
                    : '—'}
                </td>
                <td>
                  {docente.pior
                    ? `${docente.pior.numero}. ${docente.pior.tema} (${docente.pior.percentual.toFixed(0)}%)`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    </>
  )
}
