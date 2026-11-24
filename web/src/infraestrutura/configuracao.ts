import { z } from 'zod'

/**
 * Configuração do servidor, lida do ambiente e validada na partida.
 *
 * O esquema está aqui, e não espalhado em `process.env.X ?? algo` pelo
 * código, por um motivo prático: variável de ambiente ausente é o erro de
 * implantação mais comum, e ele precisa aparecer como uma mensagem que diz o
 * que falta — não como um `undefined` que percorre três camadas e estoura
 * como "cannot read properties of undefined" numa tela qualquer.
 */
const esquema = z.object({
  PAINEL_MONGO_URL: z
    .string()
    .min(1, 'PAINEL_MONGO_URL é obrigatória: string de conexão do MongoDB.'),
  PAINEL_MONGO_BANCO: z.string().min(1).default('painel-analitico'),
  PAINEL_CHAVE_DADOS: z
    .string()
    .min(1, 'PAINEL_CHAVE_DADOS é obrigatória. Gere com: openssl rand -base64 32'),
  /** Duração da sessão "manter conectado", em dias. */
  PAINEL_DIAS_SESSAO: z.coerce.number().int().positive().default(14)
})

export type AmbienteValidado = z.infer<typeof esquema>

export class Configuracao {
  private constructor(private readonly valores: AmbienteValidado) {}

  public static apartirDoAmbiente(ambiente: NodeJS.ProcessEnv = process.env): Configuracao {
    const resultado = esquema.safeParse(ambiente)
    if (!resultado.success) {
      const problemas = resultado.error.issues
        .map((questao) => `  - ${questao.path.join('.')}: ${questao.message}`)
        .join('\n')
      throw new Error(`Configuração inválida:\n${problemas}`)
    }
    return new Configuracao(resultado.data)
  }

  public get urlMongo(): string {
    return this.valores.PAINEL_MONGO_URL
  }

  public get bancoMongo(): string {
    return this.valores.PAINEL_MONGO_BANCO
  }

  public get chaveDeDados(): string {
    return this.valores.PAINEL_CHAVE_DADOS
  }

  public get diasDeSessao(): number {
    return this.valores.PAINEL_DIAS_SESSAO
  }
}
