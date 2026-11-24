import Link from 'next/link'

import { ROTEIRO_JORNADA, passosAplicaveis } from '@/dominio/modelos/guia'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { Container } from '@/infraestrutura/container'

export const dynamic = 'force-dynamic'

/**
 * Guia de uso.
 *
 * Mostra só os passos que valem para quem está lendo: quem não importa
 * planilha não precisa ler sobre o assistente de importação, e um guia que
 * descreve telas inacessíveis ensina a procurar o que não existe.
 */
export default async function PaginaGuia(): Promise<React.ReactElement> {
  const usuario = await SessaoHttp.exigirUsuario()
  const aplicacoes = await Container.paraRequisicao().repositorio.aplicacoes.contar()

  const passos = passosAplicaveis({
    ehAdmin: usuario.perfil === 'administrador',
    possuiAplicacoes: aplicacoes > 0
  })

  const ocultos = ROTEIRO_JORNADA.length - passos.length

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Guia de uso</h1>
        <p>O que cada tela responde, e o que esta fonte de dados não permite saber.</p>
      </div>

      <div className="guia-passos">
        {passos.map((passo, indice) => (
          <article className="guia-passo" key={passo.titulo}>
            <span className="guia-passo__marca">{indice + 1}</span>
            <div className="guia-passo__corpo">
              <h2 className="guia-tela__titulo">{passo.titulo}</h2>
              <p className="guia-tela__texto">{passo.texto}</p>
              {passo.experimente ? (
                <p className="guia-jornada__nota">Experimente: {passo.experimente}</p>
              ) : null}
              {passo.caminho ? (
                <Link className="campo__link" href={passo.caminho}>
                  Ir para a tela
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {ocultos > 0 ? (
        <p className="campo__dica">
          {ocultos} passo(s) não aparecem aqui porque tratam de telas fora do seu perfil ou que
          dependem de uma aplicação já importada.
        </p>
      ) : null}
    </>
  )
}
