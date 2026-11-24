'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Busca por nome, matrícula ou pseudônimo.
 *
 * Envia pela URL e deixa o servidor buscar: o nome do discente é cifrado na
 * base e só o servidor consegue decifrá-lo, então filtrar no navegador seria
 * impossível além de indesejável.
 */
export function BuscaDiscente({
  cursoId,
  termoInicial
}: {
  cursoId: string
  termoInicial: string
}): React.ReactElement {
  const router = useRouter()
  const [termo, setTermo] = useState(termoInicial)

  function buscar(evento: React.FormEvent): void {
    evento.preventDefault()
    const parametros = new URLSearchParams({ curso: cursoId })
    if (termo.trim()) parametros.set('busca', termo.trim())
    router.push(`/analises/discente?${parametros.toString()}`)
  }

  return (
    <form className="barra-filtros" onSubmit={buscar}>
      <input
        className="campo__controle barra-filtros__busca"
        type="search"
        placeholder="Nome, matrícula ou pseudônimo"
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
      />
      <button className="botao" type="submit">
        Buscar
      </button>
    </form>
  )
}
