'use client'

import { useActionState, useState, useTransition } from 'react'

import { analisarPlanilha, confirmarImportacao } from '@/app/acoes/importacao'
import type {
  AnaliseImportacao,
  DecisoesImportacao,
  ResultadoImportacao
} from '@/dominio/modelos/importacao'

interface Curso {
  _id: string
  sigla: string
  nome: string
}

const PASSOS = ['Arquivo', 'Conferência', 'Grafias', 'Confirmação'] as const

/**
 * Assistente de importação, em quatro passos.
 *
 * Nada é gravado antes do último. Primeiro o arquivo; depois o programa
 * mostra o que entendeu de cada aba e a pessoa confirma o período; em
 * seguida decide quais grafias parecidas de docente devem ser unificadas; só
 * então a confirmação grava, dentro de uma transação. Se algo falhar no meio,
 * o banco volta ao que era.
 */
export function AssistenteImportacao({ cursos }: { cursos: Curso[] }): React.ReactElement {
  const [estadoAnalise, acaoAnalise, analisando] = useActionState<
    { analise?: AnaliseImportacao; erro?: string } | null,
    FormData
  >(analisarPlanilha, null)

  const analise = estadoAnalise?.analise ?? null

  if (!analise) {
    return (
      <>
        <ListaPassos atual={0} />
        <form className="cartao cartao--formulario" action={acaoAnalise}>
          {estadoAnalise?.erro ? (
            <div className="mensagem mensagem--erro" role="alert">
              {estadoAnalise.erro}
            </div>
          ) : null}

          <div className="campo" data-tour="importacao-arquivo">
            <label className="campo__rotulo" htmlFor="planilha">
              Planilha do Teste de Progresso
            </label>
            <input
              className="campo__controle"
              id="planilha"
              name="planilha"
              type="file"
              accept=".xlsx"
              required
            />
            <p className="campo__dica">Arquivo .xlsx exportado pelo curso.</p>
          </div>

          <div className="linha-controles">
            <div className="campo">
              <label className="campo__rotulo" htmlFor="cursoId">
                Curso
              </label>
              <select className="campo__controle" id="cursoId" name="cursoId" required>
                <option value="">Escolha…</option>
                {cursos.map((curso) => (
                  <option key={curso._id} value={curso._id}>
                    {curso.sigla} — {curso.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label className="campo__rotulo" htmlFor="rotulo">
                Aplicação
              </label>
              <input
                className="campo__controle campo__controle--curto"
                id="rotulo"
                name="rotulo"
                placeholder="2026/1"
                required
              />
              <p className="campo__dica">Ano e semestre, no formato 2026/1.</p>
            </div>
          </div>

          <div className="acoes-formulario">
            <button className="botao" type="submit" disabled={analisando}>
              {analisando ? 'Analisando…' : 'Analisar planilha'}
            </button>
          </div>
        </form>
      </>
    )
  }

  return <ConferenciaDaAnalise analise={analise} />
}

function ListaPassos({ atual }: { atual: number }): React.ReactElement {
  return (
    <ol className="passos" data-tour="importacao-passos">
      {PASSOS.map((passo, indice) => (
        <li className="passo" key={passo} data-ativo={indice === atual} data-feito={indice < atual}>
          <span className="passo__numero">{indice + 1}</span>
          {passo}
        </li>
      ))}
    </ol>
  )
}

function ConferenciaDaAnalise({ analise }: { analise: AnaliseImportacao }): React.ReactElement {
  const [periodos, setPeriodos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      analise.abas
        .filter((aba) => aba.tipo === 'desempenho')
        .map((aba) => [aba.nome, aba.periodoSugerido ?? ''])
    )
  )
  const [escolhidas, setEscolhidas] = useState<string[]>(() =>
    analise.abas.filter((aba) => aba.tipo === 'desempenho').map((aba) => aba.nome)
  )
  const [unificacoes, setUnificacoes] = useState<Record<string, string>>({})
  const [substituir, setSubstituir] = useState(false)
  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [pendente, iniciar] = useTransition()

  const bloqueios = analise.ocorrencias.filter(
    (ocorrencia) =>
      ocorrencia.severidade === 'bloqueante' &&
      (ocorrencia.codigo !== 'aplicacao-ja-importada' || !substituir)
  )

  if (resultado?.sucesso) {
    const resumo = resultado.resumo
    return (
      <>
        <ListaPassos atual={3} />
        <div className="cartao cartao--formulario">
          <div className="mensagem mensagem--sucesso" role="status">
            Importação concluída.
          </div>
          <div className="resumo-numeros">
            <Numero valor={resumo.totalDiscentes} rotulo="discentes" />
            <Numero valor={resumo.discentesNovos} rotulo="novos" />
            <Numero valor={resumo.discentesReencontrados} rotulo="reencontrados" />
            <Numero valor={resumo.discentesSemMatricula} rotulo="sem matrícula" />
            <Numero valor={resumo.totalRegistros} rotulo="registros" />
            <Numero valor={Number(resumo.percentualMedio.toFixed(1))} rotulo="% médio" />
            <Numero valor={Number(resumo.notaMedia.toFixed(1))} rotulo="nota média pela régua" />
          </div>
          {resumo.discentesSemMatricula > 0 ? (
            <div className="mensagem mensagem--aviso">
              {resumo.discentesSemMatricula} discente(s) vieram sem código de matrícula e foram
              reconhecidos pelo nome. Dois homônimos viram uma pessoa só, e uma grafia diferente
              parte a trajetória de alguém em duas.
            </div>
          ) : null}
          <Ocorrencias lista={resultado.ocorrencias} />
          <div className="acoes-formulario">
            <a className="botao" href="/visao-geral">
              Ver o painel
            </a>
            <a className="botao--texto" href="/importacoes">
              Importar outra
            </a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ListaPassos atual={passo} />

      <div className="cartao cartao--formulario">
        <p className="faixas">
          {analise.nomeArquivo} · {analise.cursoNome} · aplicação {analise.rotulo}
        </p>

        {resultado && !resultado.sucesso ? (
          <div className="mensagem mensagem--erro" role="alert">
            {resultado.mensagem}
          </div>
        ) : null}

        {analise.aplicacaoExistente ? (
          <div className="mensagem mensagem--aviso">
            <p>
              Já existe a aplicação <strong>{analise.aplicacaoExistente.rotulo}</strong>,
              importada em{' '}
              {new Date(analise.aplicacaoExistente.dataImportacao).toLocaleDateString('pt-BR')} com{' '}
              {analise.aplicacaoExistente.totalRegistros.toLocaleString('pt-BR')} registros.
            </p>
            <label className="caixa-selecao">
              <input
                type="checkbox"
                checked={substituir}
                onChange={(evento) => setSubstituir(evento.target.checked)}
              />
              Substituir a importação anterior
            </label>
          </div>
        ) : null}

        <Ocorrencias lista={analise.ocorrencias} />

        {passo === 1 ? (
          <>
            <h2 className="secao__titulo">O que entendi de cada aba</h2>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Aba</th>
                  <th>Reconhecida como</th>
                  <th>Questões</th>
                  <th>Discentes</th>
                  <th>Período</th>
                </tr>
              </thead>
              <tbody>
                {analise.abas.map((aba) => (
                  <tr key={aba.nome}>
                    <td>
                      <input
                        type="checkbox"
                        checked={escolhidas.includes(aba.nome)}
                        disabled={aba.tipo !== 'desempenho'}
                        onChange={(evento) =>
                          setEscolhidas((atual) =>
                            evento.target.checked
                              ? [...atual, aba.nome]
                              : atual.filter((nome) => nome !== aba.nome)
                          )
                        }
                      />
                    </td>
                    <td>{aba.nome}</td>
                    <td>
                      <span className="etiqueta etiqueta--neutra">{aba.tipo}</span>
                      <span className="faixas"> {aba.motivo}</span>
                    </td>
                    <td>{aba.totalQuestoes || '—'}</td>
                    <td>{aba.totalDiscentes || '—'}</td>
                    <td>
                      {aba.tipo === 'desempenho' ? (
                        <input
                          className="campo__controle campo__controle--curto"
                          value={periodos[aba.nome] ?? ''}
                          onChange={(evento) =>
                            setPeriodos((atual) => ({ ...atual, [aba.nome]: evento.target.value }))
                          }
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="acoes-formulario">
              <button className="botao" type="button" onClick={() => setPasso(2)}>
                Continuar
              </button>
            </div>
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <h2 className="secao__titulo">Grafias parecidas</h2>
            <p className="secao__descricao">
              Marque as que são a mesma pessoa. Sem a unificação, a mesma docente aparece em duas
              linhas na tela de docentes responsáveis.
            </p>

            {analise.clusters.length === 0 ? (
              <p className="faixas">Nenhuma grafia ambígua encontrada.</p>
            ) : null}

            {analise.clusters.map((cluster) => (
              <div className="area-cartao" key={cluster.chave}>
                <p>
                  <strong>{cluster.campo === 'docente' ? 'Docente' : 'Tema'}</strong>:{' '}
                  {cluster.variantes
                    .map((variante) => `${variante.texto} (${variante.ocorrencias})`)
                    .join(' · ')}
                </p>
                <label className="caixa-selecao">
                  <input
                    type="checkbox"
                    checked={cluster.chave in unificacoes}
                    onChange={(evento) =>
                      setUnificacoes((atual) => {
                        const copia = { ...atual }
                        if (evento.target.checked) copia[cluster.chave] = cluster.sugestao
                        else delete copia[cluster.chave]
                        return copia
                      })
                    }
                  />
                  Unificar como
                </label>
                <input
                  className="campo__controle"
                  value={unificacoes[cluster.chave] ?? cluster.sugestao}
                  disabled={!(cluster.chave in unificacoes)}
                  onChange={(evento) =>
                    setUnificacoes((atual) => ({ ...atual, [cluster.chave]: evento.target.value }))
                  }
                />
              </div>
            ))}

            <div className="acoes-formulario">
              <button className="botao" type="button" onClick={() => setPasso(3)}>
                Continuar
              </button>
              <button className="botao--texto" type="button" onClick={() => setPasso(1)}>
                Voltar
              </button>
            </div>
          </>
        ) : null}

        {passo === 3 ? (
          <>
            <h2 className="secao__titulo">Confirmação</h2>
            <div className="resumo-numeros">
              <Numero valor={escolhidas.length} rotulo="abas" />
              <Numero valor={analise.resumo.totalDiscentes} rotulo="discentes" />
              <Numero valor={analise.resumo.totalQuestoes} rotulo="questões" />
              <Numero valor={analise.resumo.totalRegistros} rotulo="registros" />
            </div>

            {bloqueios.length > 0 ? (
              <div className="mensagem mensagem--erro">
                Há {bloqueios.length} impedimento(s) que precisam ser resolvidos antes de importar.
              </div>
            ) : null}

            <div className="acoes-formulario">
              <button
                className="botao"
                type="button"
                disabled={pendente || bloqueios.length > 0 || escolhidas.length === 0}
                onClick={() => {
                  const decisoes: DecisoesImportacao = {
                    uploadId: analise.uploadId,
                    cursoId: analise.cursoId,
                    rotulo: analise.rotulo,
                    abas: escolhidas.map((nome) => ({
                      nome,
                      periodo: periodos[nome] ?? ''
                    })),
                    unificacoes: Object.entries(unificacoes).map(([chave, para]) => {
                      const cluster = analise.clusters.find((item) => item.chave === chave)
                      return {
                        campo: cluster?.campo ?? 'docente',
                        chaves: cluster?.chavesVariantes ?? [chave],
                        para
                      }
                    }),
                    substituirAnterior: substituir
                  }
                  iniciar(async () => setResultado(await confirmarImportacao(decisoes)))
                }}
              >
                {pendente ? 'Importando…' : 'Importar'}
              </button>
              <button className="botao--texto" type="button" onClick={() => setPasso(2)}>
                Voltar
              </button>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function Numero({ valor, rotulo }: { valor: number; rotulo: string }): React.ReactElement {
  return (
    <div className="resumo-numeros__item">
      <span className="resumo-numeros__valor">{valor.toLocaleString('pt-BR')}</span>
      <span className="resumo-numeros__rotulo">{rotulo}</span>
    </div>
  )
}

function Ocorrencias({
  lista
}: {
  lista: AnaliseImportacao['ocorrencias']
}): React.ReactElement | null {
  if (lista.length === 0) return null
  return (
    <ul className="alerta-lista">
      {lista.map((ocorrencia, indice) => (
        <li className="ocorrencia" key={indice} data-severidade={ocorrencia.severidade}>
          <span className="ocorrencia__mensagem">{ocorrencia.mensagem}</span>
          {ocorrencia.detalhes && ocorrencia.detalhes.length > 0 ? (
            <span className="ocorrencia__detalhes">
              {ocorrencia.detalhes.slice(0, 5).join(' · ')}
              {ocorrencia.detalhes.length > 5 ? ` … e mais ${ocorrencia.detalhes.length - 5}` : ''}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
