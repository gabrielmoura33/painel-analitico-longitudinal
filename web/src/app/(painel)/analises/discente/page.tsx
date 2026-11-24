import Link from 'next/link'

import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { Bloco, EstadoVazio, Kpi } from '@/ui/componentes/basicos'
import { BuscaDiscente } from '@/ui/componentes/busca-discente'
import { TrajetoriaDoDiscente } from '@/ui/graficos/trajetoria-do-discente'

export const dynamic = 'force-dynamic'

/**
 * A única tela que mostra nome real.
 *
 * As telas coletivas usam pseudônimo porque ali o indivíduo não é o assunto.
 * Aqui ele é — e o acesso tem motivo pedagógico, não curiosidade.
 */
export default async function PaginaDiscente({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const filtros = await searchParams
  const { indicadores, contexto } = await contextoDaPagina(filtros)

  if (!contexto.cursoId) return <EstadoVazio texto="Nenhum curso no seu escopo." />

  const termo = filtros.busca?.trim() ?? ''
  const encontrados = termo.length >= 2
    ? await indicadores.buscarDiscentes(contexto.cursoId, termo)
    : []

  const visao = filtros.discente
    ? await indicadores.visaoDiscente(contexto.cursoId, filtros.discente)
    : null

  const percentual = (valor: number): string => `${valor.toFixed(1)}%`

  return (
    <>
      <BarraContexto contexto={contexto} />

      <div className="cabecalho-pagina">
        <div className="migalhas">Análises › Discente</div>
        <h1>Ficha do discente</h1>
        <p>Busque por nome, matrícula ou pseudônimo.</p>
      </div>

      <div data-tour="discente-busca">
        <BuscaDiscente cursoId={contexto.cursoId} termoInicial={termo} />
      </div>

      {termo.length >= 2 && encontrados.length > 0 && !filtros.discente ? (
        <div className="resultado-busca">
          {encontrados.map((pessoa) => (
            <Link
              className="resultado-busca__item"
              key={pessoa._id}
              href={`/analises/discente?curso=${contexto.cursoId}&discente=${pessoa._id}`}
            >
              <strong>{pessoa.nomeCompleto}</strong>
              <span className="faixas">
                {pessoa.pseudonimo}
                {pessoa.matricula ? ` · matrícula ${pessoa.matricula}` : ' · sem matrícula'} ·{' '}
                {pessoa.aplicacoes} aplicação(ões)
              </span>
            </Link>
          ))}
        </div>
      ) : null}

      {termo.length >= 2 && encontrados.length === 0 ? (
        <EstadoVazio texto="Ninguém encontrado com esse termo." />
      ) : null}

      {visao ? (
        <>
          <div className="cabecalho-pagina">
            <h2>{visao.nomeCompleto}</h2>
            <p>
              {visao.pseudonimo}
              {visao.matricula ? ` · matrícula ${visao.matricula}` : ' · sem matrícula registrada'}
            </p>
          </div>

          {visao.ultimo ? (
            <div className="kpis">
              <Kpi
                rotulo={`Acertos em ${visao.ultimo.rotulo}`}
                valor={`${visao.ultimo.acertos} de ${visao.ultimo.totalQuestoes}`}
              />
              <Kpi rotulo="% de acerto" valor={percentual(visao.ultimo.percentual)} />
              <Kpi rotulo="Nota pela régua" valor={visao.ultimo.nota.toFixed(1)} />
              <Kpi
                rotulo="Posição na turma"
                valor={`${visao.ultimo.percentil.toFixed(0)}º percentil`}
              />
            </div>
          ) : null}

          {visao.alertas.length > 0 ? (
            <div className="alerta-lista">
              {visao.alertas.map((alerta) => (
                <div
                  className={
                    alerta.tipo === 'atencao'
                      ? 'mensagem mensagem--aviso'
                      : 'mensagem mensagem--sucesso'
                  }
                  key={`${alerta.tipo}-${alerta.titulo}`}
                >
                  <strong>{alerta.titulo}</strong> — {alerta.detalhe}
                </div>
              ))}
            </div>
          ) : null}

          <Bloco
            titulo="Trajetória"
            descricao="A pessoa contra a média da turma dela, aplicação por aplicação."
          >
            <TrajetoriaDoDiscente pontos={visao.trajetoria} />
          </Bloco>

          <Bloco titulo="Por área de conhecimento" descricao="Último resultado e a turma.">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Último</th>
                  <th>Turma</th>
                  <th>Variação</th>
                </tr>
              </thead>
              <tbody>
                {visao.areas.map((area) => (
                  <tr key={area.area}>
                    <td>{area.area}</td>
                    <td>
                      {area.ultimoPercentual === null
                        ? '—'
                        : percentual(area.ultimoPercentual)}
                    </td>
                    <td>{area.mediaDaTurma === null ? '—' : percentual(area.mediaDaTurma)}</td>
                    <td>{area.variacao === null ? '—' : `${area.variacao.toFixed(1)} p.p.`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bloco>
        </>
      ) : null}
    </>
  )
}
