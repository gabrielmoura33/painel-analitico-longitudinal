/**
 * Validações usadas nos dois lados: o renderer dá retorno imediato ao usuário,
 * o processo principal valida de novo antes de gravar. A validação do renderer
 * é conveniência; a que vale é a do main.
 */

export interface ResultadoValidacao {
  valido: boolean
  mensagem?: string
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function formatarCpf(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11)
  const partes = [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 9)].filter(Boolean)
  const verificador = digitos.slice(9, 11)
  const base = partes.join('.')
  return verificador ? `${base}-${verificador}` : base
}

/** Validação real de CPF, com os dois dígitos verificadores. */
export function validarCpf(valor: string): ResultadoValidacao {
  const cpf = somenteDigitos(valor)

  if (cpf.length !== 11) return { valido: false, mensagem: 'O CPF deve ter 11 dígitos.' }
  if (/^(\d)\1{10}$/.test(cpf)) return { valido: false, mensagem: 'CPF inválido.' }

  const digito = (ateIndice: number): number => {
    let soma = 0
    let peso = ateIndice + 1
    for (let i = 0; i < ateIndice; i += 1) {
      soma += Number(cpf[i]) * peso
      peso -= 1
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  if (digito(9) !== Number(cpf[9]) || digito(10) !== Number(cpf[10])) {
    return { valido: false, mensagem: 'CPF inválido.' }
  }
  return { valido: true }
}

export interface RegraSenha {
  descricao: string
  atendida: (senha: string) => boolean
}

export const REGRAS_SENHA: RegraSenha[] = [
  { descricao: 'Pelo menos 8 caracteres', atendida: (senha) => senha.length >= 8 },
  { descricao: 'Pelo menos uma letra maiúscula', atendida: (senha) => /[A-ZÀ-Ý]/.test(senha) },
  { descricao: 'Pelo menos um número', atendida: (senha) => /\d/.test(senha) }
]

export function validarSenha(senha: string): ResultadoValidacao {
  const pendente = REGRAS_SENHA.find((regra) => !regra.atendida(senha))
  return pendente ? { valido: false, mensagem: pendente.descricao } : { valido: true }
}

export function validarLogin(login: string): ResultadoValidacao {
  const limpo = login.trim()
  if (limpo.length < 3) return { valido: false, mensagem: 'O login deve ter ao menos 3 caracteres.' }
  if (!/^[a-z0-9.\-_]+$/i.test(limpo)) {
    return { valido: false, mensagem: 'Use apenas letras, números, ponto, hífen ou sublinhado.' }
  }
  return { valido: true }
}

export function validarNomeCompleto(nome: string): ResultadoValidacao {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (limpo.length < 5 || !limpo.includes(' ')) {
    return { valido: false, mensagem: 'Informe o nome completo.' }
  }
  return { valido: true }
}

export function validarDataNascimento(data: string): ResultadoValidacao {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { valido: false, mensagem: 'Informe uma data válida.' }
  }
  const informada = new Date(`${data}T00:00:00`)
  if (Number.isNaN(informada.getTime())) return { valido: false, mensagem: 'Informe uma data válida.' }
  if (informada > new Date()) return { valido: false, mensagem: 'A data não pode ser futura.' }
  if (informada < new Date('1900-01-01T00:00:00')) {
    return { valido: false, mensagem: 'Informe uma data válida.' }
  }
  return { valido: true }
}

/** Normaliza o login para comparação: minúsculas e sem espaços nas pontas. */
export function normalizarLogin(login: string): string {
  return login.trim().toLowerCase()
}
