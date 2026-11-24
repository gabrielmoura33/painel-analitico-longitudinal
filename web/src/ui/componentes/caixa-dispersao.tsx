import type { DispersaoArea } from '@/dominio/modelos/indicadores'

/**
 * Diagrama de caixa por área, desenhado com CSS.
 *
 * Duas áreas com a mesma média podem ter histórias bem diferentes: caixa
 * larga é turma desigual. É a leitura que a média sozinha apaga.
 *
 * Sem biblioteca de gráfico de propósito — são barras posicionadas em
 * porcentagem, e a escala de 0 a 100 é a mesma para todas as linhas, o que
 * permite comparar áreas entre si só de olhar.
 */
export function CaixaDispersao({ areas }: { areas: DispersaoArea[] }): React.ReactElement {
  if (areas.length === 0) {
    return <p className="faixas">Sem dados suficientes para a dispersão.</p>
  }

  return (
    <div>
      {areas.map((area) => (
        <div className="caixa-dispersao" key={area.tema}>
          <div className="caixa-dispersao__rotulo">{area.tema}</div>
          <div
            className="caixa-dispersao__linha"
            style={{
              left: `${area.minimo}%`,
              width: `${Math.max(area.maximo - area.minimo, 0.5)}%`
            }}
          >
            <div
              className="caixa-dispersao__caixa"
              style={{
                left: `${((area.q1 - area.minimo) / Math.max(area.maximo - area.minimo, 1)) * 100}%`,
                width: `${((area.q3 - area.q1) / Math.max(area.maximo - area.minimo, 1)) * 100}%`
              }}
            />
            <div
              className="caixa-dispersao__mediana"
              style={{
                left: `${((area.mediana - area.minimo) / Math.max(area.maximo - area.minimo, 1)) * 100}%`
              }}
            />
          </div>
          <div className="caixa-dispersao__valores">
            {area.minimo.toFixed(0)}% · mediana {area.mediana.toFixed(0)}% ·{' '}
            {area.maximo.toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  )
}
