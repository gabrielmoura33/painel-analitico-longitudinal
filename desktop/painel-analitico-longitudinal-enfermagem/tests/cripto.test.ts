import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { abrirCofre, pareceCifrado } from '../src/main/db/cripto'
import { comCriptografia } from '../src/main/db/criptografado'
import { RepositorioLocal } from '../src/main/db/drivers/local'

let pasta: string

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-cripto-'))
  delete process.env.PAINEL_CHAVE_DADOS
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
  delete process.env.PAINEL_CHAVE_DADOS
})

describe('cofre', () => {
  it('cifra e decifra de volta ao original', () => {
    const cofre = abrirCofre(pasta)
    const cifrado = cofre.cifrar('Maria da Silva', 'aleatorio')

    expect(pareceCifrado(cifrado)).toBe(true)
    expect(cifrado).not.toContain('Maria')
    expect(cofre.decifrar(cifrado)).toBe('Maria da Silva')
  })

  it('modo aleatório produz textos diferentes para o mesmo valor', () => {
    const cofre = abrirCofre(pasta)
    expect(cofre.cifrar('Maria', 'aleatorio')).not.toBe(cofre.cifrar('Maria', 'aleatorio'))
  })

  it('modo determinístico repete o texto, que é o que permite buscar', () => {
    const cofre = abrirCofre(pasta)
    expect(cofre.cifrar('52998224725', 'determinista')).toBe(
      cofre.cifrar('52998224725', 'determinista')
    )
  })

  it('texto em claro atravessa intacto: é o documento gravado antes do cofre', () => {
    const cofre = abrirCofre(pasta)
    expect(cofre.decifrar('Maria da Silva')).toBe('Maria da Silva')
  })

  it('a chave do ambiente tem precedência sobre a gerada na máquina', () => {
    const chave = Buffer.alloc(32, 7).toString('base64')
    process.env.PAINEL_CHAVE_DADOS = chave
    const primeiro = abrirCofre(pasta)
    expect(primeiro.origemDaChave).toContain('PAINEL_CHAVE_DADOS')

    const cifrado = primeiro.cifrar('Maria', 'determinista')
    const outraMaquina = abrirCofre(mkdtempSync(join(tmpdir(), 'painel-cripto-2-')))
    expect(outraMaquina.decifrar(cifrado)).toBe('Maria')
  })

  it('chave trocada não derruba a leitura: devolve o texto cifrado', () => {
    process.env.PAINEL_CHAVE_DADOS = Buffer.alloc(32, 1).toString('base64')
    const cifrado = abrirCofre(pasta).cifrar('Maria', 'aleatorio')

    process.env.PAINEL_CHAVE_DADOS = Buffer.alloc(32, 2).toString('base64')
    expect(abrirCofre(pasta).decifrar(cifrado)).toBe(cifrado)
  })
})

describe('repositório com criptografia', () => {
  it('grava cifrado e devolve legível', async () => {
    const caminho = join(pasta, 'dados.json')
    const local = new RepositorioLocal(caminho)
    const repositorio = comCriptografia(local, abrirCofre(pasta))
    await repositorio.conectar()

    const discente = await repositorio.discentes.inserir({
      cursoId: 'c1',
      nomeCompleto: 'Maria da Silva',
      matricula: '20231234',
      pseudonimo: 'ENF-001',
      ativo: true,
      criadoEm: 'x'
    })

    expect(discente.nomeCompleto).toBe('Maria da Silva')
    expect(discente.matricula).toBe('20231234')

    const lido = await repositorio.discentes.buscar({ cursoId: 'c1' })
    expect(lido[0]?.nomeCompleto).toBe('Maria da Silva')

    // No arquivo, nem o nome nem a matrícula aparecem.
    const bruto = readFileSync(caminho, 'utf8')
    expect(bruto).not.toContain('Maria da Silva')
    expect(bruto).not.toContain('20231234')
    // O pseudônimo continua em claro: é ele que as telas coletivas mostram.
    expect(bruto).toContain('ENF-001')

    await repositorio.desconectar()
  })

  it('busca por CPF continua funcionando, porque ele é determinístico', async () => {
    const local = new RepositorioLocal(join(pasta, 'dados.json'))
    const repositorio = comCriptografia(local, abrirCofre(pasta))
    await repositorio.conectar()

    await repositorio.usuarios.inserir({
      nomeCompleto: 'Maria',
      cpf: '52998224725',
      dataNascimento: '1985-06-12',
      login: 'maria',
      senhaHash: 'x',
      perfil: 'administrador',
      cursosPermitidos: [],
      ativo: true,
      primeiroAcesso: false,
      ultimoAcesso: null,
      termoAceitoEm: null,
      criadoEm: 'x'
    })

    const achado = await repositorio.usuarios.buscarUm({ cpf: '52998224725' })
    expect(achado?.nomeCompleto).toBe('Maria')
    expect(await repositorio.usuarios.buscarUm({ login: 'maria' })).not.toBeNull()

    await repositorio.desconectar()
  })

  it('filtrar por campo de IV aleatório é erro de programação, e falha alto', async () => {
    const local = new RepositorioLocal(join(pasta, 'dados.json'))
    const repositorio = comCriptografia(local, abrirCofre(pasta))
    await repositorio.conectar()

    await expect(repositorio.discentes.buscar({ nomeCompleto: 'Maria' })).rejects.toThrow(
      /IV aleatório/
    )

    await repositorio.desconectar()
  })
})
