/**
 * Derivação e conferência de senha.
 *
 * Porta, e não chamada direta ao bcrypt, porque o custo de hash é alto de
 * propósito: o teste injeta uma implementação barata e deixa de gastar
 * segundos por caso.
 */
export interface HashDeSenha {
  gerar(senha: string): Promise<string>
  conferir(senha: string, hash: string): Promise<boolean>
}
