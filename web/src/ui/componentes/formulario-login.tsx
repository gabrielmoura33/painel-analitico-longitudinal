'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { entrar } from '@/app/acoes/sessao'
import type { ResultadoOperacao } from '@/dominio/modelos/resultado'

/**
 * Formulário de entrada.
 *
 * `useActionState` mantém a mensagem de erro vinda do servidor sem que a
 * página precise de estado próprio nem de chamada manual de rede: o navegador
 * envia o formulário, o servidor responde, e o que volta é renderizado. Em
 * navegador sem JavaScript o envio continua funcionando, que é o
 * comportamento que um formulário de login deve ter.
 */
export function FormularioLogin(): React.ReactElement {
  const [estado, acao, enviando] = useActionState<ResultadoOperacao | null, FormData>(
    entrar,
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
        <label className="campo__rotulo" htmlFor="login">
          Usuário
        </label>
        <input
          className="campo__controle"
          id="login"
          name="login"
          autoComplete="username"
          required
          autoFocus
        />
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
          autoComplete="current-password"
          required
        />
      </div>

      <Link className="campo__link" href="/recuperar-senha">
        Esqueci a senha
      </Link>

      <label className="caixa-selecao">
        <input type="checkbox" name="manterConectado" />
        Manter conectado
      </label>

      <button className="botao botao--bloco" type="submit" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
