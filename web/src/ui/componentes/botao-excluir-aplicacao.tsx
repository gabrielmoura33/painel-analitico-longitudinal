'use client'

import { useState, useTransition } from 'react'

import { excluirAplicacao } from '@/app/acoes/administracao'

/**
 * Exclusão de uma aplicação importada.
 *
 * Apaga a aplicação, suas questões e seu desempenho — os discentes
 * permanecem, porque pertencem ao curso e não à aplicação. A confirmação diz
 * o tamanho do que será apagado: "11.375 registros" pesa diferente de
 * "esta importação".
 */
export function BotaoExcluirAplicacao({
  aplicacaoId,
  rotulo,
  registros
}: {
  aplicacaoId: string
  rotulo: string
  registros: number
}): React.ReactElement {
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div className="acoes-formulario">
      {erro ? <span className="campo__erro">{erro}</span> : null}
      <button
        className="botao--texto"
        type="button"
        data-perigo="true"
        disabled={pendente}
        onClick={() => {
          if (
            !confirm(
              `Excluir ${rotulo}? Serão apagados ${registros.toLocaleString('pt-BR')} registros de desempenho e as questões desta aplicação. Os discentes permanecem. Não há como desfazer.`
            )
          ) {
            return
          }
          iniciar(async () => {
            const resultado = await excluirAplicacao(aplicacaoId)
            if (!resultado.sucesso) setErro(resultado.mensagem ?? 'Não foi possível excluir.')
          })
        }}
      >
        {pendente ? 'Excluindo…' : 'Excluir esta importação'}
      </button>
    </div>
  )
}
