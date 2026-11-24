import { FormularioRecuperarSenha } from '@/ui/componentes/formulario-recuperar-senha'

export const dynamic = 'force-dynamic'

/**
 * Pedido de redefinição.
 *
 * Não há envio de e-mail: a redefinição é presencial, feita por quem
 * administra o painel, que entrega a nova senha inicial. Esta tela só
 * registra o pedido para que ele apareça na lista de usuários.
 */
export default function PaginaRecuperarSenha(): React.ReactElement {
  return (
    <div className="acesso">
      <aside className="acesso__lateral">
        <div className="acesso__instituicao">PUC Minas</div>
        <h1 className="acesso__titulo">Esqueci a senha</h1>
        <p className="acesso__subtitulo">
          O pedido vai para quem administra o painel, que gera uma nova senha inicial.
        </p>
      </aside>

      <main className="acesso__painel">
        <h2>Pedir nova senha</h2>
        <FormularioRecuperarSenha />
      </main>
    </div>
  )
}
