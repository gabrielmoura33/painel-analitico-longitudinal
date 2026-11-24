import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
)

const COR_PRIMARIA = '#285961'
const COR_APOIO = '#AFC8CB'
const COR_TEXTO = '#6B7280'
const COR_GRADE = '#E5E7EB'

Chart.defaults.font.family =
  '"Segoe UI", "Helvetica Neue", -apple-system, BlinkMacSystemFont, Arial, sans-serif'
Chart.defaults.color = COR_TEXTO

function moldura(altura: number): { envolucro: HTMLElement; canvas: HTMLCanvasElement } {
  const envolucro = document.createElement('div')
  envolucro.style.position = 'relative'
  envolucro.style.height = `${altura}px`
  const canvas = document.createElement('canvas')
  envolucro.append(canvas)
  return { envolucro, canvas }
}

export interface SerieLinha {
  rotulos: string[]
  valores: number[]
  /** Série secundária opcional, desenhada pontilhada (ex.: média da turma). */
  comparacao?: { nome: string; valores: number[] }
  sufixo?: string
}

export function graficoLinha(dados: SerieLinha, altura = 240): HTMLElement {
  const { envolucro, canvas } = moldura(altura)
  const sufixo = dados.sufixo ?? '%'

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: dados.rotulos,
      datasets: [
        {
          data: dados.valores,
          borderColor: COR_PRIMARIA,
          backgroundColor: COR_PRIMARIA,
          pointBackgroundColor: '#fff',
          pointBorderColor: COR_PRIMARIA,
          pointBorderWidth: 2,
          pointRadius: 5,
          tension: 0.25
        },
        ...(dados.comparacao
          ? [
              {
                label: dados.comparacao.nome,
                data: dados.comparacao.valores,
                borderColor: COR_APOIO,
                borderDash: [5, 4],
                pointRadius: 3,
                pointBackgroundColor: COR_APOIO,
                tension: 0.25
              }
            ]
          : [])
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: Boolean(dados.comparacao) },
        tooltip: {
          callbacks: {
            label: (contexto) => `${Number(contexto.parsed.y).toFixed(1)}${sufixo}`
          }
        }
      },
      scales: {
        y: {
          grid: { color: COR_GRADE },
          border: { display: false },
          ticks: { callback: (valor) => `${valor}${sufixo}` }
        },
        x: { grid: { display: false } }
      }
    }
  })

  return envolucro
}

export interface SerieBarras {
  rotulos: string[]
  valores: number[]
  /** Índice destacado em cor forte; os demais ficam em tom de apoio. */
  destaque?: number
  sufixo?: string
}

export function graficoBarras(dados: SerieBarras, altura = 240): HTMLElement {
  const { envolucro, canvas } = moldura(altura)
  const sufixo = dados.sufixo ?? '%'

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dados.rotulos,
      datasets: [
        {
          data: dados.valores,
          backgroundColor: dados.valores.map((_, indice) =>
            dados.destaque === indice ? COR_PRIMARIA : COR_APOIO
          ),
          borderRadius: 4,
          maxBarThickness: 64
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (contexto) => `${Number(contexto.parsed.y).toFixed(1)}${sufixo}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: COR_GRADE },
          border: { display: false },
          ticks: { callback: (valor) => `${valor}${sufixo}` }
        },
        x: { grid: { display: false } }
      }
    }
  })

  return envolucro
}
