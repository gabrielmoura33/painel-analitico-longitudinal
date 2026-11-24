/**
 * Fonte do tempo.
 *
 * Injetada em vez de `new Date()` espalhado pelo código: é o que permite
 * um teste afirmar que uma sessão expira sem esperar o prazo correr.
 */
export interface Relogio {
  agora(): Date
  /** Instante atual em ISO 8601, formato em que tudo é persistido. */
  agoraEmTexto(): string
}
