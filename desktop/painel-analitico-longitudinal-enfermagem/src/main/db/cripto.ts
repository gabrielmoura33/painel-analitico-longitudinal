import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync
} from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Cofre de campos sensíveis.
 *
 * Foi o compromisso assumido com as docentes: nome, CPF, data de nascimento e
 * matrícula não ficam legíveis na base. O painel cifra antes de gravar e
 * decifra ao ler — quem abrir o banco direto, com o driver do Mongo ou com o
 * arquivo do driver local na mão, não lê nada disso.
 *
 * Isto protege os dados **em repouso**. Não substitui controle de acesso nem
 * o que a infraestrutura da PUC fizer em volta do servidor; é a camada que
 * cabe à aplicação.
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
 * ## A chave
 *
 * `PAINEL_CHAVE_DADOS` (32 bytes em hexadecimal ou base64) tem precedência.
 * É o caminho obrigatório quando a base é compartilhada: todas as instalações
 * precisam da mesma chave, ou uma não lê o que a outra gravou.
 *
 * Sem a variável, a chave é gerada e guardada ao lado do banco local, com
 * permissão restrita ao usuário. Serve à instalação de máquina única — e é
 * dito no diagnóstico do sistema, para que ninguém suponha o contrário.
 */

const PREFIXO = 'enc:v1:'
const ARQUIVO_CHAVE = 'chave-dados.key'

export type ModoCifra = 'aleatorio' | 'determinista'

export interface Cofre {
  cifrar(valor: string, modo: ModoCifra): string
  decifrar(valor: string): string
  /** De onde veio a chave, para o diagnóstico do sistema. */
  readonly origemDaChave: string
}

export function pareceCifrado(valor: string): boolean {
  return valor.startsWith(PREFIXO)
}

function lerChaveDoAmbiente(bruta: string): Buffer | null {
  const limpa = bruta.trim()
  if (limpa === '') return null

  const hexadecimal = /^[0-9a-f]{64}$/i.test(limpa) ? Buffer.from(limpa, 'hex') : null
  const chave = hexadecimal ?? Buffer.from(limpa, 'base64')
  return chave.length === 32 ? chave : null
}

function chaveDoArquivo(pastaDados: string): Buffer {
  mkdirSync(pastaDados, { recursive: true })
  const caminho = join(pastaDados, ARQUIVO_CHAVE)

  if (existsSync(caminho)) {
    const guardada = Buffer.from(readFileSync(caminho, 'utf8').trim(), 'base64')
    if (guardada.length === 32) return guardada
  }

  const nova = randomBytes(32)
  writeFileSync(caminho, nova.toString('base64'), { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(caminho, 0o600)
  } catch {
    // Sistemas de arquivo sem permissão POSIX: a chave fica como o sistema permitir.
  }
  return nova
}

export function abrirCofre(pastaDados: string): Cofre {
  const doAmbiente = lerChaveDoAmbiente(process.env.PAINEL_CHAVE_DADOS ?? '')
  const chave = doAmbiente ?? chaveDoArquivo(pastaDados)
  const origemDaChave = doAmbiente
    ? 'variável de ambiente PAINEL_CHAVE_DADOS'
    : `arquivo ${join(pastaDados, ARQUIVO_CHAVE)} (gerado nesta máquina)`

  // Chave separada para derivar IV determinístico: nunca a mesma que cifra.
  const chaveIv = scryptSync(chave, 'painel-iv', 32)

  return {
    origemDaChave,

    cifrar(valor: string, modo: ModoCifra): string {
      if (valor === '' || pareceCifrado(valor)) return valor

      const iv =
        modo === 'determinista'
          ? createHmac('sha256', chaveIv).update(valor, 'utf8').digest().subarray(0, 12)
          : randomBytes(12)

      const cifrador = createCipheriv('aes-256-gcm', chave, iv)
      const corpo = Buffer.concat([cifrador.update(valor, 'utf8'), cifrador.final()])
      const etiqueta = cifrador.getAuthTag()

      return `${PREFIXO}${iv.toString('base64')}:${etiqueta.toString('base64')}:${corpo.toString('base64')}`
    },

    decifrar(valor: string): string {
      // Texto em claro: documento gravado antes de o cofre existir. Devolve como está.
      if (!pareceCifrado(valor)) return valor

      const [ivBruto, etiquetaBruta, corpoBruto] = valor.slice(PREFIXO.length).split(':')
      if (!ivBruto || !etiquetaBruta || !corpoBruto) return valor

      try {
        const decifrador = createDecipheriv(
          'aes-256-gcm',
          chave,
          Buffer.from(ivBruto, 'base64')
        )
        decifrador.setAuthTag(Buffer.from(etiquetaBruta, 'base64'))
        return Buffer.concat([
          decifrador.update(Buffer.from(corpoBruto, 'base64')),
          decifrador.final()
        ]).toString('utf8')
      } catch {
        /*
         * Chave trocada ou documento adulterado. Devolver o texto cifrado é
         * melhor do que derrubar a tela inteira: a pessoa vê que há algo
         * errado naquele campo, e o resto do painel continua utilizável.
         */
        return valor
      }
    }
  }
}
