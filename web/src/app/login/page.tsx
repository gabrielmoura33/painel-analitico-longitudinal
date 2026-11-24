import { redirect } from 'next/navigation'

import { FormularioLogin } from '@/ui/componentes/formulario-login'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

export const dynamic = 'force-dynamic'

export default async function PaginaLogin(): Promise<React.ReactElement> {
  // Já autenticado não vê tela de login.
  if (await SessaoHttp.usuario()) redirect('/visao-geral')

  const container = Container.paraRequisicao()
  if (await container.autenticacao().precisaConfiguracaoInicial()) {
    redirect('/primeiro-acesso')
  }

  return (
    <div className="acesso">
      <aside className="acesso__lateral">
        <div className="acesso__instituicao">PUC Minas</div>
        <h1 className="acesso__titulo">Painel Analítico Longitudinal</h1>
        <p className="acesso__subtitulo">
          Acompanhamento do desempenho no Teste de Progresso ao longo do curso.
        </p>
      </aside>

      <main className="acesso__painel">
        <h2>Entrar</h2>
        <p className="faixas">Use seu usuário e senha institucionais.</p>
        <FormularioLogin />
        <p className="acesso__rodape">Problemas de acesso? Contate o suporte de TI.</p>
      </main>
    </div>
  )
}
