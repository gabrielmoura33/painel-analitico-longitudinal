/** Escala de cor usada no heatmap: laranja (baixo) → petróleo (alto). */
const PARADAS: Array<{ limite: number; cor: [number, number, number] }> = [
  { limite: 0, cor: [176, 76, 36] },
  { limite: 40, cor: [217, 164, 65] },
  { limite: 70, cor: [139, 178, 182] },
  { limite: 100, cor: [40, 89, 97] }
]

export function corDoPercentual(percentual: number): string {
  const valor = Math.max(0, Math.min(100, percentual))

  for (let i = 0; i < PARADAS.length - 1; i += 1) {
    const inicio = PARADAS[i] as { limite: number; cor: [number, number, number] }
    const fim = PARADAS[i + 1] as { limite: number; cor: [number, number, number] }
    if (valor > fim.limite) continue

    const intervalo = fim.limite - inicio.limite
    const fracao = intervalo === 0 ? 0 : (valor - inicio.limite) / intervalo
    const canais = inicio.cor.map((canal, indice) =>
      Math.round(canal + ((fim.cor[indice] as number) - canal) * fracao)
    )
    return `rgb(${canais.join(', ')})`
  }

  return 'rgb(40, 89, 97)'
}
