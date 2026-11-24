/**
 * Uma barra por período: o comportamento da questão ao longo da prova.
 *
 * Alaranjada abaixo de 50%. Uma questão fácil no 10º e difícil no 6º é
 * informação sobre o currículo, não sobre a questão.
 */
export function MiniSerie({
  valores
}: {
  valores: Array<{ periodo: string; percentual: number | null }>
}): React.ReactElement {
  return (
    <div className="mini-serie">
      {valores.map((valor) => (
        <span
          className="mini-serie__barra"
          key={valor.periodo}
          title={`${valor.periodo}: ${valor.percentual === null ? 'sem dado' : `${valor.percentual.toFixed(0)}%`}`}
          data-critica={valor.percentual !== null && valor.percentual < 50}
          style={{ height: `${Math.max(2, valor.percentual ?? 0)}%` }}
        />
      ))}
    </div>
  )
}
