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

import type { PontoTrajetoria } from '@/dominio/modelos/indicadores'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

/**
 * A pessoa contra a turma dela.
 *
 * As duas séries juntas são o ponto: "subiu" sozinho não diz nada — subiu
 * mais ou menos que a turma é que é leitura pedagógica.
 */
export function TrajetoriaDoDiscente({
  pontos
}: {
  pontos: PontoTrajetoria[]
}): React.ReactElement {
  if (pontos.length === 0) {
    return <p className="faixas">Esta pessoa ainda não tem resultado registrado.</p>
  }

  return (
    <Line
      data={{
        labels: pontos.map((ponto) => `${ponto.rotulo} (${ponto.periodo})`),
        datasets: [
          {
            label: 'Discente',
            data: pontos.map((ponto) => ponto.percentual),
            borderColor: '#1f6feb',
            backgroundColor: '#1f6feb',
            tension: 0.25
          },
          {
            label: 'Turma do período',
            data: pontos.map((ponto) => ponto.percentualDaTurma),
            borderColor: '#9aa4b2',
            backgroundColor: '#9aa4b2',
            borderDash: [6, 4],
            tension: 0.25
          }
        ]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { min: 0, max: 100, ticks: { callback: (valor) => `${valor}%` } } }
      }}
      height={260}
    />
  )
}
