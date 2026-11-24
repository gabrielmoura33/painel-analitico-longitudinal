import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto'

import type { Cofre, ModoCifra } from '@/dominio/portas/cofre'

/**
 * Cofre de campos sensíveis, em AES-256-GCM.
 *
 * Foi o compromisso assumido com as docentes: nome, CPF, data de nascimento e
 * matrícula não ficam legíveis na base. A aplicação cifra antes de gravar e
 * decifra ao ler — quem abrir o banco direto não lê nada disso.
 *
 * Isto protege os dados **em repouso**. Não substitui controle de acesso nem
 * o que a infraestrutura fizer em volta do servidor; é a camada que cabe à
 * aplicação.
 *
 * ## Dois modos, por um motivo concreto
 *
 * `aleatorio` sorteia um IV a cada gravação: o mesmo nome gravado duas vezes
 * produz textos cifrados diferentes, que é o que se quer. Mas então não dá
 * para procurar por igualdade — e o cadastro de usuário precisa justamente
 * perguntar "já existe alguém com este CPF?".
 *
 * Para esse caso existe o `determinista`, cujo IV é derivado do próprio valor.
 * Ele permite a busca ao custo de revelar que dois registros têm o mesmo CPF —
 * informação que, ali, já é o próprio propósito da consulta.
 *
 * ## A chave, na versão web
 *
 * Aqui ela vem obrigatoriamente de `PAINEL_CHAVE_DADOS`, 32 bytes em
 * hexadecimal ou base64. A versão desktop podia gerar uma chave e guardá-la ao
 * lado do banco, porque "a máquina" era um lugar estável. Num servidor não é:
 * um contêiner recriado traria uma chave nova e deixaria de ler o que a
 * anterior gravou — perda de dados silenciosa, descoberta tarde. Por isso,
 * sem a variável, a aplicação não sobe.
 */
export class CofreAes implements Cofre {
  private static readonly PREFIXO = 'enc:v1:'
  private static readonly TAMANHO_CHAVE = 32
  private static readonly TAMANHO_IV = 12

  private readonly chave: Buffer
  /** Chave separada para derivar o IV determinístico: nunca a mesma que cifra. */
  private readonly chaveIv: Buffer

  public readonly origemDaChave: string

  public constructor(chave: Buffer, origemDaChave: string) {
    if (chave.length !== CofreAes.TAMANHO_CHAVE) {
      throw new Error(`A chave de dados precisa ter ${CofreAes.TAMANHO_CHAVE} bytes.`)
    }
    this.chave = chave
    this.chaveIv = scryptSync(chave, 'painel-iv', CofreAes.TAMANHO_CHAVE)
    this.origemDaChave = origemDaChave
  }

  /**
   * Monta o cofre a partir do ambiente, falhando alto quando a chave falta.
   *
   * A mensagem traz o comando que gera uma chave válida: quem encontra este
   * erro costuma ser quem está implantando, não quem escreveu o código.
   */
  public static apartirDoAmbiente(bruta: string | undefined): CofreAes {
    const chave = CofreAes.interpretarChave(bruta ?? '')
    if (!chave) {
      throw new Error(
        'PAINEL_CHAVE_DADOS ausente ou inválida. A aplicação não sobe sem ela, porque uma ' +
          'chave diferente da usada na gravação torna nome, CPF e matrícula ilegíveis. ' +
          'Gere com: openssl rand -base64 32'
      )
    }
    return new CofreAes(chave, 'variável de ambiente PAINEL_CHAVE_DADOS')
  }

  private static interpretarChave(bruta: string): Buffer | null {
    const limpa = bruta.trim()
    if (limpa === '') return null

    const hexadecimal = /^[0-9a-f]{64}$/i.test(limpa) ? Buffer.from(limpa, 'hex') : null
    const chave = hexadecimal ?? Buffer.from(limpa, 'base64')
    return chave.length === CofreAes.TAMANHO_CHAVE ? chave : null
  }

  public static pareceCifrado(valor: string): boolean {
    return valor.startsWith(CofreAes.PREFIXO)
  }

  public cifrar(valor: string, modo: ModoCifra): string {
    if (valor === '' || CofreAes.pareceCifrado(valor)) return valor

    const iv =
      modo === 'determinista'
        ? createHmac('sha256', this.chaveIv)
            .update(valor, 'utf8')
            .digest()
            .subarray(0, CofreAes.TAMANHO_IV)
        : randomBytes(CofreAes.TAMANHO_IV)

    const cifrador = createCipheriv('aes-256-gcm', this.chave, iv)
    const corpo = Buffer.concat([cifrador.update(valor, 'utf8'), cifrador.final()])
    const etiqueta = cifrador.getAuthTag()

    return [
      CofreAes.PREFIXO + iv.toString('base64'),
      etiqueta.toString('base64'),
      corpo.toString('base64')
    ].join(':')
  }

  public decifrar(valor: string): string {
    // Texto em claro: documento gravado antes de o cofre existir. Devolve como está.
    if (!CofreAes.pareceCifrado(valor)) return valor

    const [ivBruto, etiquetaBruta, corpoBruto] = valor.slice(CofreAes.PREFIXO.length).split(':')
    if (!ivBruto || !etiquetaBruta || !corpoBruto) return valor

    try {
      const decifrador = createDecipheriv('aes-256-gcm', this.chave, Buffer.from(ivBruto, 'base64'))
      decifrador.setAuthTag(Buffer.from(etiquetaBruta, 'base64'))
      return Buffer.concat([
        decifrador.update(Buffer.from(corpoBruto, 'base64')),
        decifrador.final()
      ]).toString('utf8')
    } catch {
      /*
       * Chave trocada ou documento adulterado. Devolver o texto cifrado é
       * melhor do que derrubar a tela inteira: a pessoa vê que há algo errado
       * naquele campo, e o resto do painel continua utilizável.
       */
      return valor
    }
  }
}
