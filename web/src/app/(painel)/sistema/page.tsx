import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'
import { Bloco } from '@/ui/componentes/basicos'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico.
 *
 * Existe para a primeira pergunta do suporte: onde estão os dados, e qual
 * chave está cifrando os campos sensíveis. Numa instalação compartilhada, a
 * segunda resposta é a que explica por que uma máquina lê nomes e outra não.
 */
export default async function PaginaSistema(): Promise<React.ReactElement> {
  await SessaoHttp.exigirUsuario()
  const container = Container.paraRequisicao()
  const repositorio = container.repositorio

  const contagens = {
    cursos: await repositorio.cursos.contar(),
    aplicacoes: await repositorio.aplicacoes.contar(),
    discentes: await repositorio.discentes.contar(),
    desempenho: await repositorio.desempenho.contar(),
    usuarios: await repositorio.usuarios.contar()
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Diagnóstico do sistema</h1>
        <p>O que informar ao suporte quando algo não parecer certo.</p>
      </div>

      <Bloco titulo="Onde ficam os dados" descricao="">
        <dl className="definicoes" data-tour="diagnostico-dados">
          <dt>Local dos dados</dt>
          <dd>{repositorio.descricaoLocalDados}</dd>

          <dt>Chave dos campos sensíveis</dt>
          <dd>{container.cofre.origemDaChave}</dd>

          <dt>Sessão lembrada</dt>
          <dd>{container.configuracao.diasDeSessao} dias</dd>
        </dl>
        <p className="campo__dica">
          Numa instalação compartilhada, todas as instâncias precisam da mesma chave. Com chaves
          diferentes, nome, CPF e matrícula gravados por uma ficam ilegíveis para a outra.
        </p>
      </Bloco>

      <Bloco titulo="Volume atual">
        <div className="resumo-numeros">
          {Object.entries(contagens).map(([nome, valor]) => (
            <div className="resumo-numeros__item" key={nome}>
              <span className="resumo-numeros__valor">{valor.toLocaleString('pt-BR')}</span>
              <span className="resumo-numeros__rotulo">{nome}</span>
            </div>
          ))}
        </div>
      </Bloco>
    </>
  )
}
