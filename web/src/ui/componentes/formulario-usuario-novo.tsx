'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { criarUsuario } from '@/app/acoes/administracao'
import { DESCRICAO_PERFIS, PERFIS } from '@/dominio/modelos/constantes'
import type { PerfilUsuario } from '@/dominio/modelos/dominio'
import { Validacao } from '@/dominio/regras/validacao'

interface Curso {
  _id: string
  sigla: string
  nome: string
}

type Estado = {
  sucesso: boolean
  mensagem?: string
  senhaInicial?: string
  nome?: string
} | null

/**
 * Cadastro de usuário.
 *
 * O escopo de cursos só aparece para quem não é administrador: a chefia do
 * departamento responde por tudo, e marcar cursos para ela seria uma
 * restrição que o servidor recusaria de qualquer modo.
 */
export function FormularioUsuarioNovo({ cursos }: { cursos: Curso[] }): React.ReactElement {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(criarUsuario, null)
  const [perfil, setPerfil] = useState<PerfilUsuario>('professor')

  if (estado?.sucesso && estado.senhaInicial) {
    return (
      <div className="cartao cartao--formulario">
        <div className="mensagem mensagem--sucesso" role="status">
          <p>
            <strong>{estado.nome}</strong> foi cadastrado. Esta senha inicial aparece uma única
            vez — entregue agora, e ela será trocada no primeiro acesso.
          </p>
          <p className="senha-destaque">{estado.senhaInicial}</p>
        </div>
        <div className="acoes-formulario">
          <Link className="botao" href="/admin/usuarios">
            Voltar à lista
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="cartao cartao--formulario" action={acao}>
      {estado && !estado.sucesso && estado.mensagem ? (
        <div className="mensagem mensagem--erro" role="alert">
          {estado.mensagem}
        </div>
      ) : null}

      <div className="campo">
        <label className="campo__rotulo" htmlFor="nomeCompleto">
          Nome completo
        </label>
        <input className="campo__controle" id="nomeCompleto" name="nomeCompleto" required />
      </div>

      <div className="linha-controles">
        <div className="campo">
          <label className="campo__rotulo" htmlFor="cpf">
            CPF
          </label>
          <input className="campo__controle" id="cpf" name="cpf" inputMode="numeric" required />
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="dataNascimento">
            Data de nascimento
          </label>
          <input
            className="campo__controle"
            id="dataNascimento"
            name="dataNascimento"
            type="date"
            required
          />
        </div>
      </div>

      <div className="campo">
        <label className="campo__rotulo" htmlFor="login">
          Login
        </label>
        <input className="campo__controle" id="login" name="login" required />
        <p className="campo__dica">
          Letras, números, ponto, hífen ou sublinhado. A senha inicial é gerada pelo sistema.
        </p>
      </div>

      <fieldset className="perfis">
        <legend className="campo__rotulo">Perfil</legend>
        {(Object.keys(PERFIS) as PerfilUsuario[]).map((chave) => (
          <label className="perfil-cartao" key={chave} data-ativo={perfil === chave}>
            <input
              type="radio"
              name="perfil"
              value={chave}
              checked={perfil === chave}
              onChange={() => setPerfil(chave)}
            />
            <span className="perfil-cartao__titulo">{PERFIS[chave]}</span>
            <span className="perfil-cartao__descricao">{DESCRICAO_PERFIS[chave]}</span>
          </label>
        ))}
      </fieldset>

      {perfil === 'administrador' ? (
        <p className="campo__dica">
          Administrador enxerga todos os cursos do departamento; não há escopo a definir.
        </p>
      ) : (
        <fieldset className="chips">
          <legend className="campo__rotulo">Escopo de cursos</legend>
          {cursos.length === 0 ? (
            <span className="faixas">Nenhum curso cadastrado ainda.</span>
          ) : null}
          {cursos.map((curso) => (
            <label className="chip" key={curso._id}>
              <input type="checkbox" name="cursosPermitidos" value={curso._id} />
              {curso.sigla}
            </label>
          ))}
          <p className="campo__dica">Nenhum marcado significa todos os cursos.</p>
        </fieldset>
      )}

      <ul className="regras-senha">
        {Validacao.REGRAS_SENHA.map((regra) => (
          <li key={regra.descricao}>{regra.descricao}</li>
        ))}
      </ul>

      <div className="acoes-formulario">
        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? 'Cadastrando…' : 'Cadastrar'}
        </button>
        <Link className="botao--texto" href="/admin/usuarios">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
