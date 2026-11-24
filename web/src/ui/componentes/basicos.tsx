import type { ReactNode } from 'react'

/** Cartão de indicador: rótulo, valor e, quando houver, a variação. */
export function Kpi({
  rotulo,
  valor,
  nota
}: {
  rotulo: string
  valor: string
  nota?: string | null
}): React.ReactElement {
  return (
    <div className="kpi">
      <div className="kpi__rotulo">{rotulo}</div>
      <div className="kpi__valor">{valor}</div>
      {nota ? <div className="kpi__nota">{nota}</div> : null}
    </div>
  )
}

export function Bloco({
  titulo,
  descricao,
  children
}: {
  titulo: string
  descricao?: string
  children: ReactNode
}): React.ReactElement {
  return (
    <section className="painel">
      <div className="painel__titulo">{titulo}</div>
      {descricao ? <p className="painel__descricao">{descricao}</p> : null}
      {children}
    </section>
  )
}

export function EstadoVazio({ texto }: { texto: string }): React.ReactElement {
  return (
    <div className="estado-vazio">
      <p>{texto}</p>
    </div>
  )
}

/**
 * Formata variação em pontos percentuais.
 *
 * Nulo vira travessão, nunca zero: "não havia aplicação anterior" e "não
 * mudou nada" são coisas diferentes, e o painel não pode confundi-las.
 */
export function variacaoEmTexto(valor: number | null, unidade = 'p.p.'): string | null {
  if (valor === null) return null
  const sinal = valor > 0 ? '+' : ''
  return `${sinal}${valor.toFixed(1)} ${unidade} vs. aplicação anterior`
}
