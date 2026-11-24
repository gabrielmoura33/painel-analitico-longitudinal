'use client'

import { useState, useTransition } from 'react'

import { removerCurso } from '@/app/acoes/administracao'

/**
 * Remoção de curso.
 *
 * Desabilitado quando há aplicações importadas: um curso não pode sumir
 * levando consigo a série longitudinal. O servidor recusaria de qualquer
 * forma — aqui a recusa é dita antes do clique, com o motivo.
 */
export function BotaoRemoverCurso({
  cursoId,
  nome,
  aplicacoes
}: {
  cursoId: string
  nome: string
  aplicacoes: number
}): React.ReactElement {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  if (aplicacoes > 0) {
    return (
      <span className="faixas" title="Exclua as importações antes de remover o curso.">
        {aplicacoes} aplicação(ões)
      </span>
    )
  }

  return (
    <>
      <button
        className="botao--texto"
        type="button"
        data-perigo="true"
        disabled={pendente}
        onClick={() => {
          if (!confirm(`Remover o curso ${nome}? Esta ação não pode ser desfeita.`)) return
          iniciar(async () => {
            const resultado = await removerCurso(cursoId)
            if (!resultado.sucesso) setErro(resultado.mensagem ?? 'Não foi possível remover.')
          })
        }}
      >
        Remover
      </button>
      {erro ? <span className="campo__erro">{erro}</span> : null}
    </>
  )
}
