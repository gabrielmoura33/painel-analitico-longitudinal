'use client'

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { Line } from 'react-chartjs-2'

import type { PontoSerie } from '@/dominio/modelos/indicadores'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

/**
 * O gráfico que é o motivo do projeto: uma aplicação por ponto.
 *
 * O eixo vai de 0 a 100 fixo, e não ajustado aos dados. Escala automática
 * transformaria uma variação de dois pontos percentuais numa montanha — e a
 * leitura errada de uma série longitudinal é exatamente o que o painel
 * existe para evitar.
 */
export function SerieLongitudinal({
  pontos
}: {
  pontos: PontoSerie[]
}): React.ReactElement {
  if (pontos.length === 0) {
    return <p className="faixas">Ainda não há aplicações para formar a série.</p>
  }

  return (
    <Line
      data={{
        labels: pontos.map((ponto) => ponto.rotulo),
        datasets: [
          {
            label: 'Acerto médio (%)',
            data: pontos.map((ponto) => ponto.percentualMedio),
            borderColor: '#1f6feb',
            backgroundColor: '#1f6feb',
            tension: 0.25
          }
        ]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, ticks: { callback: (valor) => `${valor}%` } } },
        plugins: { legend: { display: false } }
      }}
      height={260}
    />
  )
}
