import { NextResponse, type NextRequest } from 'next/server'

/**
 * Porteiro na frente de tudo.
 *
 * O painel já tem login próprio, com usuário, perfil e escopo de cursos. Este
 * porteiro não substitui aquilo: ele vem antes, e serve a outra finalidade —
 * a URL pública não deve nem revelar que existe um painel da PUC ali, muito
 * menos expor a tela de login a quem varre a internet procurando o que
 * atacar. Com dados de discentes atrás, uma barreira a mais antes da
 * aplicação custa pouco e evita muito.
 *
 * É HTTP Basic: o navegador mostra a caixa de usuário e senha antes de
 * qualquer página carregar. Simples de propósito — a credencial é uma só,
 * compartilhada com quem pode ver o ambiente, e não tem a ver com a
 * identidade de ninguém. Quem é quem, quem vê qual curso e quem pode
 * importar continua sendo decisão do login do painel.
 *
 * Em produção o porteiro é obrigatório: sem a senha configurada a aplicação
 * responde 503 em vez de abrir. Uma variável esquecida numa implantação não
 * pode ser o mesmo que não haver porta.
 */

const USUARIO_PADRAO = 'painel'

/**
 * Comparação em tempo constante.
 *
 * `===` em string sai no primeiro caractere diferente, e a diferença de
 * tempo entre uma senha que erra na primeira letra e outra que erra na
 * última é medível pela rede. O laço abaixo percorre tudo sempre.
 *
 * Escrito à mão porque o middleware roda no runtime Edge, onde
 * `crypto.timingSafeEqual` do Node não existe.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diferenca === 0
}

function pedirCredencial(): NextResponse {
  return new NextResponse('Acesso restrito.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Painel Analítico", charset="UTF-8"',
      'Cache-Control': 'no-store'
    }
  })
}

export function middleware(requisicao: NextRequest): NextResponse {
  const senhaEsperada = process.env.PAINEL_SENHA_SITE
  const usuarioEsperado = process.env.PAINEL_USUARIO_SITE ?? USUARIO_PADRAO

  if (!senhaEsperada) {
    // Fora de produção o porteiro fica de folga, para não atrapalhar o dev.
    if (process.env.NODE_ENV !== 'production') return NextResponse.next()

    /*
     * Em produção, ausência de senha não abre a porta: fecha o prédio. Um
     * deploy sem a variável avisa alto em vez de servir dados de discentes
     * para qualquer um.
     */
    return new NextResponse(
      'Porteiro não configurado: defina PAINEL_SENHA_SITE neste ambiente.',
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const cabecalho = requisicao.headers.get('authorization')
  if (!cabecalho?.startsWith('Basic ')) return pedirCredencial()

  let decodificado: string
  try {
    // `atob` e não `Buffer`: o runtime Edge não tem a API do Node.
    decodificado = atob(cabecalho.slice('Basic '.length))
  } catch {
    return pedirCredencial()
  }

  const separador = decodificado.indexOf(':')
  if (separador === -1) return pedirCredencial()

  const usuario = decodificado.slice(0, separador)
  const senha = decodificado.slice(separador + 1)

  /*
   * As duas comparações rodam sempre, sem curto-circuito: parar na primeira
   * que falha diria ao atacante qual dos dois campos ele já acertou.
   */
  const usuarioConfere = iguaisEmTempoConstante(usuario, usuarioEsperado)
  const senhaConfere = iguaisEmTempoConstante(senha, senhaEsperada)

  if (!usuarioConfere || !senhaConfere) return pedirCredencial()
  return NextResponse.next()
}

export const config = {
  /*
   * Tudo passa pelo porteiro, inclusive as rotas de dados e os arquivos
   * estáticos da aplicação. Ficam de fora apenas o que o próprio Next serve
   * para si (`_next`) e o favicon — nada ali revela dado de ninguém, e
   * exigir credencial neles faria o navegador pedir senha duas vezes.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
