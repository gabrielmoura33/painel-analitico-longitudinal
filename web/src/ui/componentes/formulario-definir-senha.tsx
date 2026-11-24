'use client'

import { useActionState } from 'react'

import { definirSenha } from '@/app/acoes/sessao'
import type { ResultadoOperacao } from '@/dominio/modelos/resultado'
import { Validacao } from '@/dominio/regras/validacao'

export function FormularioDefinirSenha({
  primeiroAcesso
}: {
  primeiroAcesso: boolean
}): React.ReactElement {
  const [estado, acao, enviando] = useActionState<ResultadoOperacao | null, FormData>(
    definirSenha,
    null
  )

  return (
    <form className="acesso__formulario" action={acao}>
      {estado && !estado.sucesso && estado.mensagem ? (
        <div className="mensagem mensagem--erro" role="alert">
          {estado.mensagem}
        </div>
      ) : null}

      <div className="campo">
        <label className="campo__rotulo" htmlFor="senhaAtual">
          {primeiroAcesso ? 'Senha inicial recebida' : 'Senha atual'}
        </label>
        <input
          className="campo__controle"
          id="senhaAtual"
          name="senhaAtual"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>

      <div className="campo">
        <label className="campo__rotulo" htmlFor="novaSenha">
          Nova senha
        </label>
        <input
          className="campo__controle"
          id="novaSenha"
          name="novaSenha"
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

      {primeiroAcesso ? (
        <label className="caixa-selecao">
          <input type="checkbox" name="aceitouTermo" />
          Li e aceito o termo de tratamento de dados pessoais.
        </label>
      ) : null}

      <button className="botao botao--bloco" type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Definir senha'}
      </button>

      <p className="campo__dica">
        Trocar a senha encerra todas as suas sessões: você vai entrar de novo com a nova senha.
      </p>
    </form>
  )
}
