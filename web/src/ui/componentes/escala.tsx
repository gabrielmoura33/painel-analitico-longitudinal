/**
 * Cor de uma célula da matriz, de 0% a 100%.
 *
 * A escala é fixa, nunca ajustada aos dados da tela. Reescalar pelo mínimo e
 * máximo observados faria duas aplicações com desempenhos diferentes
 * produzirem o mesmo desenho — e a leitura comparativa, que é o ponto da
 * matriz, deixaria de valer.
 */
export function corDaEscala(percentual: number | null): string {
  if (percentual === null) return 'var(--cor-superficie-2, #f1f3f5)'
  const posicao = Math.max(0, Math.min(100, percentual)) / 100
  // Vermelho (0%) → âmbar (50%) → verde (100%), em matiz HSL.
  const matiz = Math.round(posicao * 120)
  return `hsl(${matiz} 62% ${92 - posicao * 22}%)`
}

export function LegendaEscala(): React.ReactElement {
  return (
    <div className="legenda-escala">
      <span>0%</span>
      <span
        className="legenda-escala__barra"
        style={{
          background: `linear-gradient(to right, ${corDaEscala(0)}, ${corDaEscala(50)}, ${corDaEscala(100)})`
        }}
        aria-hidden="true"
      />
      <span>100%</span>
    </div>
  )
}
