/**
 * Cifra de campo, aplicada na fronteira da persistência.
 *
 * Dois modos porque há duas necessidades em conflito. `aleatorio` é o
 * correto — o mesmo texto gera criptogramas diferentes — mas torna o campo
 * inútil para busca. `determinista` deriva o vetor de inicialização do
 * próprio valor, de modo que a igualdade sobrevive à cifragem; é o que
 * permite checar CPF repetido sem decifrar a base inteira, ao custo de
 * revelar quais registros compartilham o mesmo valor.
 */
export type ModoCifra = 'aleatorio' | 'determinista'

export interface Cofre {
  /** De onde veio a chave em uso, para o diagnóstico do sistema. */
  readonly origemDaChave: string
  cifrar(valor: string, modo: ModoCifra): string
  /** Texto em claro atravessa intacto: é o que dispensa migração de base. */
  decifrar(valor: string): string
}
