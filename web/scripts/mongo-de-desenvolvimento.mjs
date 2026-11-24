/**
 * MongoDB efêmero para desenvolvimento e demonstração.
 *
 * Sobe um `mongod` em memória numa porta fixa e fica no ar até receber
 * Ctrl+C. Serve para rodar a aplicação sem depender do servidor compartilhado
 * — e, principalmente, sem precisar da senha dele na linha de comando.
 *
 * Os dados somem quando o processo encerra. É o que se quer aqui.
 */
import { MongoMemoryServer } from 'mongodb-memory-server'

const PORTA = 47017

const servidor = await MongoMemoryServer.create({
  instance: { port: PORTA, dbName: 'painel-analitico' }
})

console.log(`MongoDB de desenvolvimento no ar: ${servidor.getUri()}`)
console.log('Ctrl+C para encerrar.')

const encerrar = async () => {
  await servidor.stop()
  process.exit(0)
}
process.on('SIGINT', encerrar)
process.on('SIGTERM', encerrar)

// Mantém o processo vivo.
await new Promise(() => {})
