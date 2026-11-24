import { Bloco, EstadoVazio, Kpi, variacaoEmTexto } from '@/ui/componentes/basicos'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { SerieLongitudinal } from '@/ui/graficos/serie-longitudinal'
import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'

export const dynamic = 'force-dynamic'

export default async function PaginaVisaoGeral({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const { indicadores, contexto } = await contextoDaPagina(await searchParams)

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    return (
      <EstadoVazio texto="Nenhuma aplicação importada ainda. Importe uma planilha para começar." />
    )
  }

  const visao = await indicadores.visaoGeral(contexto.cursoId, contexto.aplicacaoId)
  if (!visao) return <EstadoVazio texto="Não foi possível montar a visão geral." />

  const percentual = (valor: number): string => `${valor.toFixed(1)}%`

  return (
    <>
      <BarraContexto contexto={contexto} />

      <div className="cabecalho-pagina">
        <div className="migalhas">{visao.cursoNome}</div>
        <h1>Visão geral</h1>
        <p>
          Aplicação {visao.aplicacao.rotulo} · {visao.kpis.totalDiscentes} discentes avaliados
        </p>
      </div>

      <div className="kpis">
        <Kpi
          rotulo="Acerto médio"
          valor={percentual(visao.kpis.percentualMedio)}
          nota={variacaoEmTexto(visao.variacao.percentualMedio)}
        />
        <Kpi
          rotulo="Total de acertos"
          valor={`${visao.kpis.acertosMedios.toFixed(1)} de ${visao.kpis.totalQuestoes}`}
        />
        <Kpi
          rotulo="Nota média pela régua"
          valor={visao.kpis.notaMedia.toFixed(1)}
          nota={variacaoEmTexto(visao.variacao.notaMedia, 'pontos')}
        />
        <Kpi rotulo="Discentes avaliados" valor={String(visao.kpis.totalDiscentes)} />
        <Kpi rotulo="Áreas abaixo de 50%" valor={String(visao.kpis.areasCriticas)} />
      </div>

      <div className="graficos">
        <Bloco
          titulo="Série longitudinal"
          descricao="Uma aplicação por ponto, na ordem em que foram importadas."
        >
          <SerieLongitudinal pontos={visao.serie} />
        </Bloco>

        <Bloco titulo="Acerto por período" descricao="Dentro desta aplicação.">
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
              {visao.porPeriodo.map((linha) => (
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
      </div>

      <Bloco titulo="Componentes" descricao="Geral e específico cobram coisas diferentes.">
        <div className="kpis">
          {visao.porComponente.map((componente) => (
            <Kpi
              key={componente.nome}
              rotulo={componente.nome}
              valor={percentual(componente.percentual)}
              nota={`${componente.questoes} questões`}
            />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="Áreas de conhecimento"
        descricao="Da pior para a melhor, com o histórico das aplicações anteriores."
      >
        <table className="tabela">
          <thead>
            <tr>
              <th>Área</th>
              <th>Questões</th>
              <th>Acerto</th>
              <th>Histórico</th>
              <th>Variação</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {visao.areas.map((area) => (
              <tr key={area.tema}>
                <td>{area.tema}</td>
                <td>{area.questoes}</td>
                <td>{percentual(area.percentual)}</td>
                <td>
                  {area.percentualHistorico === null
                    ? '—'
                    : percentual(area.percentualHistorico)}
                </td>
                <td>{area.variacao === null ? '—' : `${area.variacao.toFixed(1)} p.p.`}</td>
                <td>
                  <span
                    className={
                      area.situacao === 'critica'
                        ? 'etiqueta etiqueta--atencao'
                        : area.situacao === 'boa'
                          ? 'etiqueta etiqueta--positiva'
                          : 'etiqueta etiqueta--neutra'
                    }
                  >
                    {area.situacao === 'critica'
                      ? 'crítica'
                      : area.situacao === 'boa'
                        ? 'boa'
                        : 'atenção'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    </>
  )
}
