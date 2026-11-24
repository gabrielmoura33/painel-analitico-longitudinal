'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { pedirRedefinicaoDeSenha } from '@/app/acoes/sessao'
import type { ResultadoOperacao } from '@/dominio/modelos/resultado'

export function FormularioRecuperarSenha(): React.ReactElement {
  const [estado, acao, enviando] = useActionState<ResultadoOperacao | null, FormData>(
    pedirRedefinicaoDeSenha,
    null
  )

  if (estado?.sucesso) {
    return (
      <div className="acesso__formulario">
        <div className="mensagem mensagem--sucesso" role="status">
          {estado.mensagem}
        </div>
        <Link className="botao botao--bloco" href="/login">
          Voltar ao login
        </Link>
      </div>
    )
  }

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
        <input className="campo__controle" id="login" name="login" required autoFocus />
      </div>

      <button className="botao botao--bloco" type="submit" disabled={enviando}>
        {enviando ? 'Registrando…' : 'Registrar pedido'}
      </button>

      <Link className="campo__link" href="/login">
        Voltar ao login
      </Link>
    </form>
  )
}
