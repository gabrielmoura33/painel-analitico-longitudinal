import { join } from 'node:path'

import { abrirCofre, type Cofre } from './cripto'
import { comCriptografia } from './criptografado'
import { RepositorioLocal } from './drivers/local'
import { criarRepositorioMongo } from './drivers/mongo'
import type { Repositorio } from './repositorio'

export type DriverPersistencia = 'local' | 'mongo'

export interface OpcoesPersistencia {
  driver: DriverPersistencia
  /** Pasta de dados do usuário, fornecida pelo Electron. */
  pastaDados: string
  urlMongo?: string
  /** Banco dentro do servidor. Omitido, usa `painel-analitico`. */
  bancoMongo?: string
}

/** Guardado para o diagnóstico do sistema dizer de onde veio a chave. */
let cofreEmUso: Cofre | null = null

/**
 * Único ponto do sistema que sabe qual driver está em uso.
 *
 * Trocar de driver é trocar a variável de ambiente PAINEL_DRIVER. Os dois
 * saem daqui já embrulhados pela camada de criptografia: campo sensível
 * cifrado é regra do sistema, não de um driver.
 */
export function criarRepositorio(opcoes: OpcoesPersistencia): Repositorio {
  const cofre = abrirCofre(opcoes.pastaDados)
  cofreEmUso = cofre

  if (opcoes.driver === 'mongo') {
    const url = opcoes.urlMongo ?? process.env.PAINEL_MONGO_URL
    if (!url) {
      throw new Error('Driver "mongo" selecionado sem URL de conexão (PAINEL_MONGO_URL).')
    }
    const mongo = criarRepositorioMongo(url, opcoes.bancoMongo ?? process.env.PAINEL_MONGO_BANCO)
    return comCriptografia(mongo, cofre)
  }

  const local = new RepositorioLocal(join(opcoes.pastaDados, 'painel-analitico.json'))
  return comCriptografia(local, cofre)
}

export function origemDaChaveDeDados(): string {
  return cofreEmUso?.origemDaChave ?? 'cofre ainda não aberto'
}

export function driverConfigurado(): DriverPersistencia {
  return process.env.PAINEL_DRIVER === 'mongo' ? 'mongo' : 'local'
}

export type { Repositorio } from './repositorio'
