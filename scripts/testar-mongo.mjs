/*
 * Teste de conexão com o MongoDB configurado para o painel.
 *
 * Roda fora do Electron, de propósito: serve para a TI validar o servidor
 * antes de instalar o aplicativo em qualquer máquina.
 *
 *   PAINEL_MONGO_URL='mongodb://usuario:senha@host:porta/?authSource=admin' \
 *     node scripts/testar-mongo.mjs
 *
 * A URL nunca é impressa de volta: o relatório mostra só host, porta e banco.
 */
import { MongoClient } from 'mongodb'

const url = process.env.PAINEL_MONGO_URL
const banco = process.env.PAINEL_MONGO_BANCO ?? 'painel-analitico'

if (!url) {
  console.error('Defina PAINEL_MONGO_URL antes de rodar este teste.')
  process.exit(1)
}

/** Host e porta sem as credenciais, para o relatório. */
function enderecoVisivel(bruta) {
  try {
    const semEsquema = bruta.replace(/^mongodb(\+srv)?:\/\//, '')
    const depoisDoArroba = semEsquema.includes('@')
      ? semEsquema.slice(semEsquema.indexOf('@') + 1)
      : semEsquema
    return depoisDoArroba.split('/')[0]
  } catch {
    return 'endereço não reconhecido'
  }
}

const cliente = new MongoClient(url, { serverSelectionTimeoutMS: 8000 })
let falhou = false

function ok(texto) {
  console.log(`  ok   ${texto}`)
}

function erro(texto) {
  falhou = true
  console.log(`  FALHA ${texto}`)
}

console.log(`\nServidor: ${enderecoVisivel(url)}`)
console.log(`Banco:    ${banco}\n`)

try {
  await cliente.connect()
  const db = cliente.db(banco)

  const ping = await db.admin().command({ ping: 1 })
  if (ping.ok === 1) ok('conexão e autenticação')
  else erro('o servidor respondeu ao ping sem ok=1')

  const info = await db.admin().command({ buildInfo: 1 })
  ok(`MongoDB ${info.version}`)

  // Escrita e leitura numa coleção descartável: permissão de verdade,
  // não só conexão.
  const colecao = db.collection('_teste_painel')
  const marca = `teste-${Date.now()}`
  await colecao.insertOne({ _id: marca, criadoEm: new Date().toISOString() })
  const lido = await colecao.findOne({ _id: marca })
  if (lido) ok('escrita e leitura')
  else erro('gravou mas não releu o documento')
  await colecao.deleteOne({ _id: marca })
  await db.collection('_teste_painel').drop().catch(() => {})

  // A importação usa transação quando o servidor tem replica set. Sem ele
  // o aplicativo segue funcionando, mas uma planilha que falhar no meio
  // deixa dados parciais.
  const sessao = cliente.startSession()
  try {
    await sessao.withTransaction(async () => {
      await db.collection('_teste_transacao').insertOne({ marca }, { session: sessao })
    })
    await db.collection('_teste_transacao').drop().catch(() => {})
    ok('transações disponíveis (replica set ativo)')
  } catch {
    console.log('  AVISO servidor sem replica set: a importação roda sem transação')
  } finally {
    await sessao.endSession()
  }

  const colecoes = await db.listCollections().toArray()
  ok(`coleções já existentes: ${colecoes.length === 0 ? 'nenhuma (banco novo)' : colecoes.map((c) => c.name).join(', ')}`)
} catch (causa) {
  erro(causa instanceof Error ? causa.message : String(causa))
} finally {
  await cliente.close().catch(() => {})
}

console.log(falhou ? '\nTeste falhou.\n' : '\nServidor pronto para o painel.\n')
process.exit(falhou ? 1 : 0)
