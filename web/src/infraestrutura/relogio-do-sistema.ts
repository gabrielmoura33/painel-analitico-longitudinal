import type { Relogio } from '@/dominio/portas/relogio'

/** Relógio de produção. O teste injeta outro e controla o tempo. */
export class RelogioDoSistema implements Relogio {
  public agora(): Date {
    return new Date()
  }

  public agoraEmTexto(): string {
    return this.agora().toISOString()
  }
}
