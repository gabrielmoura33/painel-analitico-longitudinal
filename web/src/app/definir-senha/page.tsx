import { redirect } from 'next/navigation'

import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { FormularioDefinirSenha } from '@/ui/componentes/formulario-definir-senha'

export const dynamic = 'force-dynamic'

/**
 * Troca de senha.
 *
 * Fica fora do grupo (painel) de propósito: é para cá que o layout do painel
 * manda quem ainda está com senha inicial, e uma tela dentro dele devolveria
 * a pessoa para cá outra vez, em laço.
 */
export default async function PaginaDefinirSenha(): Promise<React.ReactElement> {
  const usuario = await SessaoHttp.usuario()
  if (!usuario) redirect('/login')

  return (
    <div className="acesso">
      <aside className="acesso__lateral">
        <div className="acesso__instituicao">PUC Minas</div>
        <h1 className="acesso__titulo">
          {usuario.primeiroAcesso ? 'Defina sua senha' : 'Trocar senha'}
        </h1>
        <p className="acesso__subtitulo">
          {usuario.primeiroAcesso
            ? 'A senha inicial serve uma vez só. Escolha a sua antes de entrar no painel.'
            : 'A senha atual deixa de valer assim que a nova for salva.'}
        </p>
      </aside>

      <main className="acesso__painel">
        <h2>{usuario.nomeCompleto}</h2>
        <FormularioDefinirSenha primeiroAcesso={usuario.primeiroAcesso} />
      </main>
    </div>
  )
}
