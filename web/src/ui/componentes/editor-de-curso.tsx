'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import {
  importarAreasDaPlanilha,
  salvarCurso,
  type ResultadoImportacaoAreas
} from '@/app/acoes/administracao'
import type { DadosCurso } from '@/dominio/modelos/dtos'
import { Regua } from '@/dominio/regras/regua'

/**
 * Editor de curso.
 *
 * Mantém o curso inteiro num estado só e envia de uma vez. Era tentador
 * salvar cada seção separadamente, mas as regras são cruzadas — a régua
 * precisa cobrir os períodos da estrutura, os componentes precisam caber no
 * total de questões — e validar um pedaço de cada vez deixaria o curso
 * passar por estados que o domínio recusa.
 *
 * Nada aqui é específico de Enfermagem: é esta tela que torna a plataforma
 * utilizável por outro curso sem tocar no código.
 */
export function EditorDeCurso({
  cursoId,
  inicial
}: {
  cursoId: string | null
  inicial: DadosCurso
}): React.ReactElement {
  const router = useRouter()
  const [curso, setCurso] = useState<DadosCurso>(inicial)
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const [relatorioAreas, setRelatorioAreas] = useState<ResultadoImportacaoAreas | null>(null)
  const arquivoAreas = useRef<HTMLInputElement>(null)

  function alterar(mudanca: Partial<DadosCurso>): void {
    setCurso((atual) => ({ ...atual, ...mudanca }))
  }

  function salvar(): void {
    setErro(null)
    iniciar(async () => {
      const resultado = await salvarCurso(cursoId, curso)
      if (!resultado.sucesso) {
        setErro(resultado.mensagem)
        return
      }
      router.push('/admin/cursos')
    })
  }

  return (
    <div className="cartao cartao--formulario">
      {erro ? (
        <div className="mensagem mensagem--erro" role="alert">
          {erro}
        </div>
      ) : null}

      <section className="secao">
        <h2 className="secao__titulo">Identificação</h2>
        <div className="linha-controles">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="nome">
              Nome
            </label>
            <input
              className="campo__controle"
              id="nome"
              value={curso.nome}
              onChange={(evento) => alterar({ nome: evento.target.value })}
            />
          </div>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="sigla">
              Sigla
            </label>
            <input
              className="campo__controle campo__controle--curto"
              id="sigla"
              value={curso.sigla}
              onChange={(evento) => alterar({ sigla: evento.target.value })}
            />
          </div>
        </div>

        <div className="linha-controles">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="departamento">
              Departamento
            </label>
            <input
              className="campo__controle"
              id="departamento"
              value={curso.departamento}
              onChange={(evento) => alterar({ departamento: evento.target.value })}
            />
          </div>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="campus">
              Campus
            </label>
            <input
              className="campo__controle"
              id="campus"
              value={curso.campus}
              onChange={(evento) => alterar({ campus: evento.target.value })}
            />
            <p className="campo__dica">
              O mesmo curso existe em mais de um campus e aplica a mesma prova.
            </p>
          </div>
        </div>

        <div className="linha-controles">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="instituicao">
              Instituição
            </label>
            <input
              className="campo__controle"
              id="instituicao"
              value={curso.instituicao}
              onChange={(evento) => alterar({ instituicao: evento.target.value })}
            />
          </div>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="instrumento">
              Instrumento avaliativo
            </label>
            <input
              className="campo__controle"
              id="instrumento"
              value={curso.nomeInstrumento}
              onChange={(evento) => alterar({ nomeInstrumento: evento.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Estrutura da prova</h2>
        <div className="linha-controles">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="totalQuestoes">
              Total de questões
            </label>
            <input
              className="campo__controle campo__controle--curto"
              id="totalQuestoes"
              type="number"
              min={1}
              value={curso.estrutura.totalQuestoes}
              onChange={(evento) =>
                alterar({
                  estrutura: {
                    ...curso.estrutura,
                    totalQuestoes: Number(evento.target.value)
                  }
                })
              }
            />
          </div>
          <div className="campo">
            <label className="campo__rotulo" htmlFor="periodos">
              Períodos avaliados
            </label>
            <input
              className="campo__controle"
              id="periodos"
              value={curso.estrutura.periodos.join(', ')}
              onChange={(evento) =>
                alterar({
                  estrutura: {
                    ...curso.estrutura,
                    periodos: evento.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean)
                  }
                })
              }
            />
            <p className="campo__dica">Separados por vírgula, como a planilha os nomeia: 6º, 7º…</p>
          </div>
        </div>

        <h3 className="secao__descricao">Componentes</h3>
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Da questão</th>
              <th>Até a questão</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {curso.estrutura.componentes.map((componente, indice) => (
              <tr key={indice}>
                <td>
                  <input
                    className="campo__controle"
                    value={componente.nome}
                    onChange={(evento) => {
                      const componentes = [...curso.estrutura.componentes]
                      componentes[indice] = { ...componente, nome: evento.target.value }
                      alterar({ estrutura: { ...curso.estrutura, componentes } })
                    }}
                  />
                </td>
                <td>
                  <input
                    className="campo__controle campo__controle--curto"
                    type="number"
                    value={componente.questaoInicial}
                    onChange={(evento) => {
                      const componentes = [...curso.estrutura.componentes]
                      componentes[indice] = {
                        ...componente,
                        questaoInicial: Number(evento.target.value)
                      }
                      alterar({ estrutura: { ...curso.estrutura, componentes } })
                    }}
                  />
                </td>
                <td>
                  <input
                    className="campo__controle campo__controle--curto"
                    type="number"
                    value={componente.questaoFinal}
                    onChange={(evento) => {
                      const componentes = [...curso.estrutura.componentes]
                      componentes[indice] = {
                        ...componente,
                        questaoFinal: Number(evento.target.value)
                      }
                      alterar({ estrutura: { ...curso.estrutura, componentes } })
                    }}
                  />
                </td>
                <td>
                  <button
                    className="botao--texto"
                    type="button"
                    data-perigo="true"
                    onClick={() =>
                      alterar({
                        estrutura: {
                          ...curso.estrutura,
                          componentes: curso.estrutura.componentes.filter(
                            (_item, posicao) => posicao !== indice
                          )
                        }
                      })
                    }
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="botao--secundario"
          type="button"
          onClick={() =>
            alterar({
              estrutura: {
                ...curso.estrutura,
                componentes: [
                  ...curso.estrutura.componentes,
                  { nome: '', questaoInicial: 1, questaoFinal: curso.estrutura.totalQuestoes }
                ]
              }
            })
          }
        >
          Acrescentar componente
        </button>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Régua de notas</h2>
        <p className="secao__descricao">
          A partir do percentual mínimo, cada dez pontos percentuais valem mais um ponto, até o
          teto de 10. Abaixo do mínimo, a nota é a própria nota base. Nenhuma nota fica gravada:
          mudar a régua recalcula os painéis na hora.
        </p>
        <table className="tabela">
          <thead>
            <tr>
              <th>Período</th>
              <th>Nota base</th>
              <th>Percentual mínimo</th>
              <th>Na prática</th>
            </tr>
          </thead>
          <tbody>
            {curso.regua.map((faixa, indice) => (
              <tr key={faixa.periodo || indice}>
                <td>
                  <input
                    className="campo__controle campo__controle--curto"
                    value={faixa.periodo}
                    onChange={(evento) => {
                      const regua = [...curso.regua]
                      regua[indice] = { ...faixa, periodo: evento.target.value }
                      alterar({ regua })
                    }}
                  />
                </td>
                <td>
                  <input
                    className="campo__controle campo__controle--curto"
                    type="number"
                    min={1}
                    max={10}
                    value={faixa.notaBase}
                    onChange={(evento) => {
                      const regua = [...curso.regua]
                      regua[indice] = { ...faixa, notaBase: Number(evento.target.value) }
                      alterar({ regua })
                    }}
                  />
                </td>
                <td>
                  <input
                    className="campo__controle campo__controle--curto"
                    type="number"
                    min={0}
                    max={100}
                    value={faixa.percentualMinimo}
                    onChange={(evento) => {
                      const regua = [...curso.regua]
                      regua[indice] = {
                        ...faixa,
                        percentualMinimo: Number(evento.target.value)
                      }
                      alterar({ regua })
                    }}
                  />
                </td>
                <td className="faixas">
                  {Regua.demonstrarFaixas(faixa.notaBase, faixa.percentualMinimo)
                    .slice(0, 3)
                    .map(
                      (linha) =>
                        `${linha.percentualInicial}–${linha.percentualFinal}% = ${linha.nota}`
                    )
                    .join(' · ')}
                  …
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="botao--secundario"
          type="button"
          onClick={() =>
            alterar({ regua: [...curso.regua, { periodo: '', notaBase: 5, percentualMinimo: 50 }] })
          }
        >
          Acrescentar período
        </button>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Áreas de conhecimento</h2>
        <p className="secao__descricao">
          A planilha traz um tema por questão. As áreas amplas são conhecimento da coordenação
          sobre o instrumento, não dedução do programa — por isso são cadastro. Importar a
          planilha de áreas substitui o tema que ela mencionar e deixa os demais como estão.
        </p>

        <div className="linha-controles">
          <input
            className="campo__controle"
            type="file"
            accept=".xlsx"
            ref={arquivoAreas}
            aria-label="Planilha de áreas"
          />
          <button
            className="botao--secundario"
            type="button"
            disabled={pendente}
            onClick={() => {
              const arquivo = arquivoAreas.current?.files?.[0]
              if (!arquivo) {
                setRelatorioAreas({ sucesso: false, mensagem: 'Escolha a planilha de áreas.' })
                return
              }
              const dados = new FormData()
              dados.set('planilha', arquivo)
              iniciar(async () => {
                const resultado = await importarAreasDaPlanilha(cursoId, curso.areas, dados)
                setRelatorioAreas(resultado)
                if (resultado.sucesso && resultado.areas) alterar({ areas: resultado.areas })
              })
            }}
          >
            Importar planilha de áreas
          </button>
        </div>

        {relatorioAreas && !relatorioAreas.sucesso ? (
          <div className="mensagem mensagem--erro">{relatorioAreas.mensagem}</div>
        ) : null}

        {relatorioAreas?.sucesso && relatorioAreas.relatorio ? (
          <div className="mensagem mensagem--sucesso">
            <p>
              Aba <strong>{relatorioAreas.relatorio.aba}</strong>:{' '}
              {relatorioAreas.relatorio.temasAtribuidos} tema(s) atribuído(s).
            </p>
            {relatorioAreas.relatorio.areasNovas.length > 0 ? (
              <p>Áreas criadas: {relatorioAreas.relatorio.areasNovas.join(', ')}.</p>
            ) : null}
            {relatorioAreas.relatorio.temasMovidos.length > 0 ? (
              <p>Temas que mudaram de área: {relatorioAreas.relatorio.temasMovidos.join(', ')}.</p>
            ) : null}
            {relatorioAreas.relatorio.temasDesconhecidos.length > 0 ? (
              <p>
                Na planilha mas não em nenhuma importação (provável erro de grafia):{' '}
                {relatorioAreas.relatorio.temasDesconhecidos.join(', ')}.
              </p>
            ) : null}
            {relatorioAreas.relatorio.temasSemArea.length > 0 ? (
              <p>
                Temas importados que seguem sem área:{' '}
                {relatorioAreas.relatorio.temasSemArea.length}.
              </p>
            ) : null}
            <p className="campo__dica">Nada foi gravado ainda: salve o curso para efetivar.</p>
          </div>
        ) : null}

        {curso.areas.map((area, indice) => (
          <div className="area-cartao" key={indice}>
            <div className="linha-controles">
              <input
                className="campo__controle"
                value={area.nome}
                aria-label="Nome da área"
                onChange={(evento) => {
                  const areas = [...curso.areas]
                  areas[indice] = { ...area, nome: evento.target.value }
                  alterar({ areas })
                }}
              />
              <button
                className="botao--texto"
                type="button"
                data-perigo="true"
                onClick={() =>
                  alterar({ areas: curso.areas.filter((_item, posicao) => posicao !== indice) })
                }
              >
                Remover área
              </button>
            </div>
            <textarea
              className="campo__controle"
              rows={2}
              value={area.temas.join('\n')}
              aria-label={`Temas de ${area.nome}`}
              onChange={(evento) => {
                const areas = [...curso.areas]
                areas[indice] = {
                  ...area,
                  temas: evento.target.value.split('\n').map((item) => item.trim())
                }
                alterar({ areas })
              }}
            />
            <p className="campo__dica">Um tema por linha.</p>
          </div>
        ))}
        <button
          className="botao--secundario"
          type="button"
          onClick={() => alterar({ areas: [...curso.areas, { nome: '', temas: [] }] })}
        >
          Acrescentar área
        </button>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Leitura da planilha</h2>
        <p className="secao__descricao">
          Onde cada informação fica na planilha do curso. Os discentes são colunas, então a
          matrícula é uma linha — a célula sob cada nome.
        </p>
        <div className="linha-controles">
          {(
            [
              ['colunaQuestao', 'Coluna da questão'],
              ['colunaGabarito', 'Coluna do gabarito'],
              ['colunaTema', 'Coluna do tema'],
              ['colunaDocente', 'Coluna do docente'],
              ['primeiraColunaAluno', 'Primeira coluna de alunos']
            ] as const
          ).map(([campo, rotulo]) => (
            <div className="campo" key={campo}>
              <label className="campo__rotulo" htmlFor={campo}>
                {rotulo}
              </label>
              <input
                className="campo__controle campo__controle--curto"
                id={campo}
                value={curso.perfilImportacao[campo]}
                onChange={(evento) =>
                  alterar({
                    perfilImportacao: {
                      ...curso.perfilImportacao,
                      [campo]: evento.target.value
                    }
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="linha-controles">
          <div className="campo">
            <label className="campo__rotulo" htmlFor="linhaCabecalho">
              Linha do cabeçalho
            </label>
            <input
              className="campo__controle campo__controle--curto"
              id="linhaCabecalho"
              type="number"
              min={1}
              value={curso.perfilImportacao.linhaCabecalho}
              onChange={(evento) =>
                alterar({
                  perfilImportacao: {
                    ...curso.perfilImportacao,
                    linhaCabecalho: Number(evento.target.value)
                  }
                })
              }
            />
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="linhaMatricula">
              Linha da matrícula (opcional)
            </label>
            <input
              className="campo__controle campo__controle--curto"
              id="linhaMatricula"
              type="number"
              min={1}
              value={curso.perfilImportacao.linhaMatricula ?? ''}
              onChange={(evento) =>
                alterar({
                  perfilImportacao: {
                    ...curso.perfilImportacao,
                    linhaMatricula:
                      evento.target.value === '' ? null : Number(evento.target.value)
                  }
                })
              }
            />
            <p className="campo__dica">
              Vazio enquanto a planilha não trouxer matrícula. Sem ela, o reencontro entre
              semestres depende do nome.
            </p>
          </div>

          <div className="campo">
            <label className="campo__rotulo" htmlFor="marcadorAcerto">
              Marcador de acerto
            </label>
            <input
              className="campo__controle campo__controle--curto"
              id="marcadorAcerto"
              value={curso.perfilImportacao.marcadorAcerto}
              onChange={(evento) =>
                alterar({
                  perfilImportacao: {
                    ...curso.perfilImportacao,
                    marcadorAcerto: evento.target.value
                  }
                })
              }
            />
          </div>
        </div>
      </section>

      <div className="acoes-formulario">
        <button className="botao" type="button" onClick={salvar} disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar curso'}
        </button>
        <button className="botao--texto" type="button" onClick={() => router.push('/admin/cursos')}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
