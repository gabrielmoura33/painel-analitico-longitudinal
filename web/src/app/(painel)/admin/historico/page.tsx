import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { Bloco } from '@/ui/componentes/basicos'
import { BotaoExcluirAplicacao } from '@/ui/componentes/botao-excluir-aplicacao'

export const dynamic = 'force-dynamic'

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default async function PaginaHistorico(): Promise<React.ReactElement> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  const itens = await Container.paraRequisicao().importacao().historico()

  // Professor vê o histórico, mas só do que alcança.
  const visiveis = itens.filter((item) => escopo.podeVerCurso(item.cursoId))
  const podeExcluir = escopo.podeAdministrar()

  return (
    <>
      <div className="cabecalho-pagina">
        <div className="migalhas">Administração</div>
        <h1>Histórico de importações</h1>
        <p>O que já entrou, com quais avisos e por quem.</p>
      </div>

      {visiveis.length === 0 ? (
        <Bloco titulo="Nada importado ainda">
          <p className="faixas">A primeira importação aparece aqui com o relatório completo.</p>
        </Bloco>
      ) : null}

      {visiveis.map((item) => (
        <Bloco
          key={item._id}
          titulo={`${item.cursoNome} · ${item.rotulo}`}
          descricao={`${item.arquivoOriginal} · ${dataHora(item.dataImportacao)} · ${item.importadoPor}`}
        >
          <div className="resumo-numeros">
            <div className="resumo-numeros__item">
              <span className="resumo-numeros__valor">{item.totalDiscentes}</span>
              <span className="resumo-numeros__rotulo">discentes</span>
            </div>
            <div className="resumo-numeros__item">
              <span className="resumo-numeros__valor">{item.totalRegistros}</span>
              <span className="resumo-numeros__rotulo">registros</span>
            </div>
            <div className="resumo-numeros__item">
              <span className="resumo-numeros__valor">{item.periodos.length}</span>
              <span className="resumo-numeros__rotulo">períodos</span>
            </div>
            <div className="resumo-numeros__item">
              <span className="resumo-numeros__valor">
                <span className="etiqueta etiqueta--neutra">{item.status}</span>
              </span>
              <span className="resumo-numeros__rotulo">situação</span>
            </div>
          </div>

          {item.ocorrencias.length > 0 ? (
            <ul className="alerta-lista">
              {item.ocorrencias.map((ocorrencia, indice) => (
                <li className="ocorrencia" key={indice} data-severidade={ocorrencia.severidade}>
                  <span className="ocorrencia__mensagem">{ocorrencia.mensagem}</span>
                  {ocorrencia.detalhes && ocorrencia.detalhes.length > 0 ? (
                    <span className="ocorrencia__detalhes">
                      {ocorrencia.detalhes.slice(0, 5).join(' · ')}
                      {ocorrencia.detalhes.length > 5
                        ? ` … e mais ${ocorrencia.detalhes.length - 5}`
                        : ''}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {podeExcluir ? (
            <BotaoExcluirAplicacao
              aplicacaoId={item._id}
              rotulo={`${item.cursoNome} · ${item.rotulo}`}
              registros={item.totalRegistros}
            />
          ) : null}
        </Bloco>
      ))}
    </>
  )
}
