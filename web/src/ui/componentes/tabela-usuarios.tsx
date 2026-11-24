'use client'

import { useState, useTransition } from 'react'

import {
  alterarEscopoDeUsuario,
  alterarPerfilDeUsuario,
  alterarSituacaoDeUsuario,
  redefinirSenhaDeUsuario
} from '@/app/acoes/administracao'
import { PERFIS } from '@/dominio/modelos/constantes'
import type { PerfilUsuario } from '@/dominio/modelos/dominio'
import type { UsuarioResumo } from '@/dominio/modelos/dtos'

interface Curso {
  _id: string
  nome: string
  sigla: string
  campus: string
}

function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Lista de usuários com as ações de administração.
 *
 * As ações rodam no servidor; esta camada só desenha e confirma. A senha
 * inicial aparece num aviso que precisa ser fechado porque ela é exibida uma
 * única vez — não há como recuperá-la depois, só gerar outra.
 */
export function TabelaUsuarios({
  usuarios,
  cursos,
  usuarioEmSessao
}: {
  usuarios: UsuarioResumo[]
  cursos: Curso[]
  usuarioEmSessao: string
}): React.ReactElement {
  const [pendente, iniciar] = useTransition()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null)
  const [editandoEscopo, setEditandoEscopo] = useState<string | null>(null)

  function nomeDoCurso(cursoId: string): string {
    const curso = cursos.find((item) => item._id === cursoId)
    if (!curso) return 'curso removido'
    return curso.campus ? `${curso.sigla} · ${curso.campus}` : curso.sigla
  }

  return (
    <>
      {mensagem ? (
        <div className="mensagem mensagem--erro" role="alert">
          {mensagem}
        </div>
      ) : null}

      {senhaGerada ? (
        <div className="mensagem mensagem--sucesso" role="status">
          <p>
            Senha inicial de <strong>{senhaGerada.nome}</strong>. Ela aparece uma única vez:
            entregue agora.
          </p>
          <p className="senha-destaque">{senhaGerada.senha}</p>
          <button className="botao--texto" type="button" onClick={() => setSenhaGerada(null)}>
            Já anotei
          </button>
        </div>
      ) : null}

      <table className="tabela" data-tour="usuarios-tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Perfil</th>
            <th>Escopo</th>
            <th>Situação</th>
            <th>Último acesso</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {usuarios.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--espaco-6)' }}>
                Nenhum usuário encontrado com esses filtros.
              </td>
            </tr>
          ) : null}

          {usuarios.map((usuario) => (
            <tr key={usuario._id}>
              <td>
                {usuario.nomeCompleto}
                {usuario._id === usuarioEmSessao ? (
                  <span className="etiqueta etiqueta--neutra" style={{ marginLeft: 8 }}>
                    você
                  </span>
                ) : null}
              </td>
              <td>{usuario.login}</td>
              <td>
                <select
                  className="campo__controle"
                  value={usuario.perfil}
                  disabled={pendente}
                  onChange={(evento) => {
                    const perfil = evento.target.value as PerfilUsuario
                    iniciar(async () => {
                      const resultado = await alterarPerfilDeUsuario(usuario._id, perfil)
                      setMensagem(resultado.sucesso ? null : (resultado.mensagem ?? null))
                    })
                  }}
                >
                  {Object.entries(PERFIS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {usuario.perfil === 'administrador' || usuario.cursosPermitidos.length === 0 ? (
                  <span className="faixas">Todos os cursos</span>
                ) : (
                  usuario.cursosPermitidos.map(nomeDoCurso).join(', ')
                )}
                {editandoEscopo === usuario._id ? (
                  <EditorDeEscopo
                    cursos={cursos}
                    marcados={usuario.cursosPermitidos}
                    aoCancelar={() => setEditandoEscopo(null)}
                    aoSalvar={(escolhidos) => {
                      iniciar(async () => {
                        const resultado = await alterarEscopoDeUsuario(usuario._id, escolhidos)
                        setMensagem(resultado.sucesso ? null : (resultado.mensagem ?? null))
                        setEditandoEscopo(null)
                      })
                    }}
                  />
                ) : null}
              </td>
              <td>
                <span
                  className={
                    usuario.ativo ? 'etiqueta etiqueta--positiva' : 'etiqueta etiqueta--atencao'
                  }
                >
                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
                {usuario.primeiroAcesso ? (
                  <span className="etiqueta etiqueta--neutra" style={{ marginLeft: 6 }}>
                    senha inicial
                  </span>
                ) : null}
              </td>
              <td>{dataHora(usuario.ultimoAcesso)}</td>
              <td>
                <div className="acoes-linha">
                  <button
                    className="botao--texto"
                    type="button"
                    disabled={pendente}
                    onClick={() => {
                      if (
                        !confirm(
                          `Gerar nova senha inicial para ${usuario.nomeCompleto}? A senha atual deixa de valer imediatamente.`
                        )
                      ) {
                        return
                      }
                      iniciar(async () => {
                        const resultado = await redefinirSenhaDeUsuario(usuario._id)
                        if (resultado.sucesso && resultado.senhaInicial) {
                          setSenhaGerada({
                            nome: resultado.nome ?? usuario.nomeCompleto,
                            senha: resultado.senhaInicial
                          })
                          setMensagem(null)
                        } else {
                          setMensagem(resultado.mensagem ?? null)
                        }
                      })
                    }}
                  >
                    Redefinir senha
                  </button>

                  {usuario.perfil === 'administrador' ? null : (
                    <button
                      className="botao--texto"
                      type="button"
                      onClick={() => setEditandoEscopo(usuario._id)}
                    >
                      Escopo de cursos
                    </button>
                  )}

                  <button
                    className="botao--texto"
                    type="button"
                    data-perigo={usuario.ativo ? 'true' : undefined}
                    disabled={pendente}
                    onClick={() => {
                      if (
                        usuario.ativo &&
                        !confirm(
                          `${usuario.nomeCompleto} perderá o acesso imediatamente. O histórico de importações é preservado.`
                        )
                      ) {
                        return
                      }
                      iniciar(async () => {
                        const resultado = await alterarSituacaoDeUsuario(
                          usuario._id,
                          !usuario.ativo
                        )
                        setMensagem(resultado.sucesso ? null : (resultado.mensagem ?? null))
                      })
                    }}
                  >
                    {usuario.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function EditorDeEscopo({
  cursos,
  marcados,
  aoSalvar,
  aoCancelar
}: {
  cursos: Curso[]
  marcados: string[]
  aoSalvar: (escolhidos: string[]) => void
  aoCancelar: () => void
}): React.ReactElement {
  const [escolhidos, setEscolhidos] = useState<string[]>(marcados)

  return (
    <div className="chips" style={{ marginTop: 8 }}>
      {cursos.length === 0 ? <span className="faixas">Nenhum curso cadastrado.</span> : null}
      {cursos.map((curso) => (
        <label className="chip" key={curso._id}>
          <input
            type="checkbox"
            checked={escolhidos.includes(curso._id)}
            onChange={(evento) =>
              setEscolhidos((atual) =>
                evento.target.checked
                  ? [...atual, curso._id]
                  : atual.filter((item) => item !== curso._id)
              )
            }
          />
          {curso.sigla}
        </label>
      ))}
      <p className="campo__dica">Nenhum marcado significa todos os cursos do departamento.</p>
      <div className="acoes-formulario">
        <button className="botao" type="button" onClick={() => aoSalvar(escolhidos)}>
          Salvar escopo
        </button>
        <button className="botao--texto" type="button" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
