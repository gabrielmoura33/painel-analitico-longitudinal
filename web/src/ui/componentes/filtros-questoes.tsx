'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Filtros da tela de questões.
 *
 * Mora na URL como o resto do contexto: a docente que encontrar um recorte
 * útil consegue mandar o link para a coordenação em vez de descrever os
 * cliques.
 */
export function FiltrosQuestoes({
  componentes,
  docentes
}: {
  componentes: string[]
  docentes: string[]
}): React.ReactElement {
  const router = useRouter()
  const caminho = usePathname()
  const busca = useSearchParams()

  function ajustar(campo: string, valor: string): void {
    const parametros = new URLSearchParams(busca.toString())
    if (valor === '') parametros.delete(campo)
    else parametros.set(campo, valor)
    router.push(`${caminho}?${parametros.toString()}`)
  }

  return (
    <div className="barra-filtros" data-tour="questoes-filtros">
      <select
        className="campo__controle"
        value={busca.get('componente') ?? ''}
        onChange={(evento) => ajustar('componente', evento.target.value)}
        aria-label="Componente"
      >
        <option value="">Todos os componentes</option>
        {componentes.map((componente) => (
          <option key={componente} value={componente}>
            {componente}
          </option>
        ))}
      </select>

      <select
        className="campo__controle"
        value={busca.get('docente') ?? ''}
        onChange={(evento) => ajustar('docente', evento.target.value)}
        aria-label="Docente responsável"
      >
        <option value="">Todos os docentes</option>
        {docentes.map((docente) => (
          <option key={docente} value={docente}>
            {docente}
          </option>
        ))}
      </select>

      <label className="caixa-selecao">
        <input
          type="checkbox"
          checked={busca.get('criticas') === '1'}
          onChange={(evento) => ajustar('criticas', evento.target.checked ? '1' : '')}
        />
        Só as críticas em todos os períodos
      </label>
    </div>
  )
}
