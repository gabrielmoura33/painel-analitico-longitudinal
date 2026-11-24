'use client'

import { useActionState } from 'react'

import { criarPrimeiroAdministrador } from '@/app/acoes/sessao'
import type { ResultadoOperacao } from '@/dominio/modelos/resultado'
import { Validacao } from '@/dominio/regras/validacao'

/**
 * Cadastro do primeiro administrador.
 *
 * Em vez de a instalação nascer com um usuário e uma senha padrão — que
 * ficaria valendo para sempre, em toda implantação —, a primeira pessoa se
 * cadastra na hora, com senha própria.
 */
export function FormularioPrimeiroAcesso(): React.ReactElement {
  const [estado, acao, enviando] = useActionState<ResultadoOperacao | null, FormData>(
    criarPrimeiroAdministrador,
    null
  )

  return (
    <form className="acesso__formulario acesso__formulario--largo" action={acao}>
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

      <div className="campo">
        <label className="campo__rotulo" htmlFor="login">
          Usuário
        </label>
        <input className="campo__controle" id="login" name="login" required />
      </div>

      <div className="campo">
        <label className="campo__rotulo" htmlFor="senha">
          Senha
        </label>
        <input
          className="campo__controle"
          id="senha"
          name="senha"
          type="password"
          autoComplete="new-password"
          required
        />
        <ul className="regras-senha">
          {Validacao.REGRAS_SENHA.map((regra) => (
            <li key={regra.descricao}>{regra.descricao}</li>
          ))}
        </ul>
      </div>

      <label className="caixa-selecao">
        <input type="checkbox" name="aceitouTermo" />
        Li e aceito o termo de tratamento de dados pessoais.
      </label>

      <button className="botao botao--bloco" type="submit" disabled={enviando}>
        {enviando ? 'Criando…' : 'Criar administrador'}
      </button>
    </form>
  )
}
