import { redirect } from 'next/navigation'

import { Container } from '@/infraestrutura/container'
import { FormularioPrimeiroAcesso } from '@/ui/componentes/formulario-primeiro-acesso'

export const dynamic = 'force-dynamic'

export default async function PaginaPrimeiroAcesso(): Promise<React.ReactElement> {
  const container = Container.paraRequisicao()
  // Instalação já configurada não volta por aqui.
  if (!(await container.autenticacao().precisaConfiguracaoInicial())) redirect('/login')

  return (
    <div className="acesso">
      <aside className="acesso__lateral">
        <div className="acesso__instituicao">PUC Minas</div>
        <h1 className="acesso__titulo">Primeiro acesso</h1>
        <p className="acesso__subtitulo">
          Esta instalação ainda não tem nenhum usuário. Cadastre quem vai administrar o painel.
        </p>
      </aside>

      <main className="acesso__painel">
        <h2>Administrador do painel</h2>
        <p className="faixas">
          Este usuário responde pelo departamento e enxerga todos os cursos.
        </p>
        <FormularioPrimeiroAcesso />
      </main>
    </div>
  )
}
