'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { ContextoPainel } from '@/dominio/modelos/indicadores'

/**
 * Seletores de curso e aplicação.
 *
 * Valem para todas as telas de acompanhamento: nenhum número do painel existe
 * solto, é sempre o desempenho daquele curso naquela aplicação. Trocar
 * qualquer um dos dois reescreve a URL, e a página se refaz no servidor —
 * sem estado duplicado no navegador para sair de sincronia.
 */
export function BarraContexto({ contexto }: { contexto: ContextoPainel }): React.ReactElement {
  const router = useRouter()
  const caminho = usePathname()
  const busca = useSearchParams()

  function trocar(campo: 'curso' | 'aplicacao', valor: string): void {
    const parametros = new URLSearchParams(busca.toString())
    parametros.set(campo, valor)
    // Trocar de curso invalida a aplicação escolhida: ela é de outro curso.
    if (campo === 'curso') parametros.delete('aplicacao')
    router.push(`${caminho}?${parametros.toString()}`)
  }

  return (
    <div className="barra-filtros" data-tour="filtro-global">
      <label className="campo campo__controle--medio">
        <span className="campo__rotulo">Curso</span>
        <select
          className="campo__controle"
          value={contexto.cursoId ?? ''}
          onChange={(evento) => trocar('curso', evento.target.value)}
        >
          {contexto.cursos.map((curso) => (
            <option key={curso._id} value={curso._id}>
              {curso.sigla} — {curso.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="campo campo__controle--medio">
        <span className="campo__rotulo">Aplicação</span>
        <select
          className="campo__controle"
          value={contexto.aplicacaoId ?? ''}
          onChange={(evento) => trocar('aplicacao', evento.target.value)}
        >
          {contexto.aplicacoes.map((aplicacao) => (
            <option key={aplicacao._id} value={aplicacao._id}>
              {aplicacao.rotulo}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
