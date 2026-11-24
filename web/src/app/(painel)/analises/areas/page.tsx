import Link from 'next/link'

import { contextoDaPagina, type FiltrosDaUrl } from '@/infraestrutura/http/contexto-pagina'
import { BarraContexto } from '@/ui/componentes/barra-contexto'
import { Bloco, EstadoVazio } from '@/ui/componentes/basicos'
import { LegendaEscala, corDaEscala } from '@/ui/componentes/escala'

export const dynamic = 'force-dynamic'

const ABAS = [
  { chave: 'ranking', titulo: 'Ranking' },
  { chave: 'matriz', titulo: 'Matriz período × área' },
  { chave: 'evolucao', titulo: 'Evolução' }
] as const

export default async function PaginaAreas({
  searchParams
}: {
  searchParams: Promise<FiltrosDaUrl>
}): Promise<React.ReactElement> {
  const filtros = await searchParams
  const { indicadores, contexto } = await contextoDaPagina(filtros)

  if (!contexto.cursoId || !contexto.aplicacaoId) {
    return <EstadoVazio texto="Nenhuma aplicação importada ainda." />
  }

  const visao = await indicadores.visaoAreas(contexto.cursoId, contexto.aplicacaoId)
  if (!visao) return <EstadoVazio texto="Não foi possível montar a visão de áreas." />

  const abaAtual = ABAS.find((aba) => aba.chave === filtros.aba)?.chave ?? 'ranking'
  const pct = (valor: number | null): string => (valor === null ? '—' : `${valor.toFixed(1)}%`)

  const parametros = (aba: string): string => {
    const busca = new URLSearchParams()
    if (contexto.cursoId) busca.set('curso', contexto.cursoId)
    if (contexto.aplicacaoId) busca.set('aplicacao', contexto.aplicacaoId)
    busca.set('aba', aba)
    return `?${busca.toString()}`
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">{visao.cursoNome} › Análises</div>
        <h1>Áreas de conhecimento</h1>
        <p>Aplicação {visao.aplicacao.rotulo}</p>
      </div>

      <BarraContexto contexto={contexto} />

      {!visao.agrupadoPorArea ? (
        <div className="mensagem mensagem--aviso">
          Os temas da planilha ainda não foram agrupados em áreas, então cada linha é um tema de
          questão. O agrupamento é cadastro do curso — a planilha não traz faixas amplas de
          conteúdo.
        </div>
      ) : null}

      {visao.temasSemArea > 0 ? (
        <div className="mensagem mensagem--aviso">
          {visao.temasSemArea} tema(s) importado(s) ainda sem área definida.
        </div>
      ) : null}

      <nav className="abas" data-tour="areas-abas">
        {ABAS.map((aba) => (
          <Link
            className="abas__botao"
            key={aba.chave}
            href={parametros(aba.chave)}
            data-ativo={aba.chave === abaAtual}
          >
            {aba.titulo}
          </Link>
        ))}
      </nav>

      {abaAtual === 'ranking' ? (
        <Bloco titulo="Ranking" descricao="Da pior para a melhor nesta aplicação.">
          <table className="tabela">
            <thead>
              <tr>
                <th>Área</th>
                <th>Questões</th>
                <th>Acerto</th>
                <th>Histórico</th>
                <th>Variação</th>
              </tr>
            </thead>
            <tbody>
              {visao.areas.map((area) => (
                <tr key={area.tema}>
                  <td>{area.tema}</td>
                  <td>{area.questoes}</td>
                  <td>{pct(area.percentual)}</td>
                  <td>{pct(area.percentualHistorico)}</td>
                  <td>{area.variacao === null ? '—' : `${area.variacao.toFixed(1)} p.p.`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloco>
      ) : null}

      {abaAtual === 'matriz' ? (
        <Bloco
          titulo="Matriz período × área"
          descricao="Escala fixa de 0% a 100%: cores parecidas são desempenhos parecidos."
        >
          <LegendaEscala />
          <div className="matriz">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Geral</th>
                  {visao.periodos.map((periodo) => (
                    <th key={periodo}>{periodo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visao.matriz.map((linha) => (
                  <tr key={linha.area}>
                    <td>{linha.area}</td>
                    <td>{pct(linha.percentualGeral)}</td>
                    {linha.celulas.map((celula) => (
                      <td
                        key={celula.periodo}
                        style={{ background: corDaEscala(celula.percentual) }}
                        title={`${celula.questoes} questão(ões), ${celula.respondentes.toFixed(0)} respondente(s)`}
                      >
                        {pct(celula.percentual)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloco>
      ) : null}

      {abaAtual === 'evolucao' ? (
        <Bloco titulo="Evolução" descricao="Cada área entre as aplicações importadas.">
          <table className="tabela">
            <thead>
              <tr>
                <th>Área</th>
                {visao.evolucao.rotulos.map((rotulo) => (
                  <th key={rotulo}>{rotulo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visao.evolucao.series.map((serie) => (
                <tr key={serie.area}>
                  <td>{serie.area}</td>
                  {serie.valores.map((valor) => (
                    <td key={valor.rotulo} style={{ background: corDaEscala(valor.percentual) }}>
                      {pct(valor.percentual)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Bloco>
      ) : null}
    </>
  )
}
