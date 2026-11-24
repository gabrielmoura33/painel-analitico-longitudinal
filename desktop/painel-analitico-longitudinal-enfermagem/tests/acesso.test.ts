import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { ServicoAutenticacao } from '../src/main/servicos/autenticacao'
import { ServicoUsuarios } from '../src/main/servicos/usuarios'

const CPF_ADMIN = '529.982.247-25'
const CPF_PROFESSORA = '168.995.350-09'

let pasta: string
let repositorio: RepositorioLocal
let autenticacao: ServicoAutenticacao
let usuarios: ServicoUsuarios

async function criarAdministrador(): Promise<void> {
  const resultado = await autenticacao.criarPrimeiroAdministrador({
    nomeCompleto: 'Gabriel de Moura',
    cpf: CPF_ADMIN,
    dataNascimento: '1990-01-10',
    login: 'gabriel.moura',
    senha: 'Senha2026',
    aceitouTermo: true
  })
  expect(resultado.sucesso).toBe(true)
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-acesso-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()
  autenticacao = new ServicoAutenticacao(repositorio)
  usuarios = new ServicoUsuarios(repositorio)
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('primeira execução', () => {
  it('pede configuração inicial enquanto não houver usuário', async () => {
    expect(await autenticacao.precisaConfiguracaoInicial()).toBe(true)
    await criarAdministrador()
    expect(await autenticacao.precisaConfiguracaoInicial()).toBe(false)
  })

  it('deixa o administrador já autenticado e sem pendência de troca de senha', async () => {
    await criarAdministrador()
    const sessao = autenticacao.sessaoAtual()
    expect(sessao.autenticado).toBe(true)
    expect(sessao.perfil).toBe('administrador')
    expect(sessao.primeiroAcesso).toBe(false)
  })

  it('recusa CPF inválido e termo não aceito', async () => {
    const cpfRuim = await autenticacao.criarPrimeiroAdministrador({
      nomeCompleto: 'Teste Silva',
      cpf: '111.111.111-11',
      dataNascimento: '1990-01-10',
      login: 'teste.silva',
      senha: 'Senha2026',
      aceitouTermo: true
    })
    expect(cpfRuim).toMatchObject({ sucesso: false })

    const semTermo = await autenticacao.criarPrimeiroAdministrador({
      nomeCompleto: 'Teste Silva',
      cpf: CPF_ADMIN,
      dataNascimento: '1990-01-10',
      login: 'teste.silva',
      senha: 'Senha2026',
      aceitouTermo: false
    })
    expect(semTermo).toMatchObject({ sucesso: false })
  })

  it('não cria um segundo administrador por esse caminho', async () => {
    await criarAdministrador()
    const segundo = await autenticacao.criarPrimeiroAdministrador({
      nomeCompleto: 'Outro Alguém',
      cpf: CPF_PROFESSORA,
      dataNascimento: '1990-01-10',
      login: 'outro.alguem',
      senha: 'Senha2026',
      aceitouTermo: true
    })
    expect(segundo.sucesso).toBe(false)
  })
})

describe('entrar e sair', () => {
  beforeEach(async () => {
    await criarAdministrador()
    await autenticacao.sair()
  })

  it('autentica com as credenciais corretas', async () => {
    const resultado = await autenticacao.entrar('GABRIEL.MOURA', 'Senha2026', false)
    expect(resultado.sucesso).toBe(true)
    expect(autenticacao.sessaoAtual().nome).toBe('Gabriel de Moura')
  })

  it('dá a mesma mensagem para login inexistente e senha errada', async () => {
    const inexistente = await autenticacao.entrar('nao.existe', 'Senha2026', false)
    const senhaErrada = await autenticacao.entrar('gabriel.moura', 'ErradaDemais1', false)
    expect(inexistente.mensagem).toBe(senhaErrada.mensagem)
    expect(inexistente.sucesso).toBe(false)
    expect(senhaErrada.sucesso).toBe(false)
  })

  it('bloqueia após cinco tentativas falhas', async () => {
    for (let i = 0; i < 5; i += 1) {
      await autenticacao.entrar('gabriel.moura', 'ErradaDemais1', false)
    }
    const bloqueado = await autenticacao.entrar('gabriel.moura', 'Senha2026', false)
    expect(bloqueado.sucesso).toBe(false)
    expect(bloqueado.mensagem).toMatch(/Muitas tentativas/)
  })

  it('guarda e retoma a sessão quando o usuário pede para manter conectado', async () => {
    await autenticacao.entrar('gabriel.moura', 'Senha2026', true)
    expect(await repositorio.sessoes.contar()).toBe(1)

    const outraExecucao = new ServicoAutenticacao(repositorio)
    const sessao = await outraExecucao.retomarSessaoPersistida()
    expect(sessao.autenticado).toBe(true)
  })

  it('não retoma sessão quando o usuário não pediu', async () => {
    await autenticacao.entrar('gabriel.moura', 'Senha2026', false)
    expect(await repositorio.sessoes.contar()).toBe(0)
  })

  it('recusa usuário desativado', async () => {
    const criado = await usuarios.criar({
      nomeCompleto: 'Patrícia Sarsur',
      cpf: CPF_PROFESSORA,
      dataNascimento: '1980-03-15',
      login: 'patricia.sarsur',
      perfil: 'professor',
      cursosPermitidos: []
    })
    if (!criado.sucesso) throw new Error(criado.mensagem)

    await autenticacao.entrar('gabriel.moura', 'Senha2026', false)
    await usuarios.alterarSituacao(criado.usuario._id, false, 'outro-id')
    await autenticacao.sair()

    const tentativa = await autenticacao.entrar('patricia.sarsur', criado.senhaInicial, false)
    expect(tentativa.sucesso).toBe(false)
    expect(tentativa.mensagem).toMatch(/desativado/)
  })
})

describe('primeiro acesso do usuário criado pelo administrador', () => {
  it('nasce exigindo troca de senha e aceite do termo', async () => {
    await criarAdministrador()
    const criado = await usuarios.criar({
      nomeCompleto: 'Renata Lacerda',
      cpf: CPF_PROFESSORA,
      dataNascimento: '1982-07-02',
      login: 'renata.lacerda',
      perfil: 'professor',
      cursosPermitidos: []
    })
    if (!criado.sucesso) throw new Error(criado.mensagem)

    await autenticacao.sair()
    await autenticacao.entrar('renata.lacerda', criado.senhaInicial, false)
    expect(autenticacao.sessaoAtual().primeiroAcesso).toBe(true)

    const semTermo = await autenticacao.definirSenha(criado.senhaInicial, 'NovaSenha1', false)
    expect(semTermo.sucesso).toBe(false)

    const repetida = await autenticacao.definirSenha(
      criado.senhaInicial,
      criado.senhaInicial,
      true
    )
    expect(repetida.sucesso).toBe(false)

    const fraca = await autenticacao.definirSenha(criado.senhaInicial, 'fraca', true)
    expect(fraca.sucesso).toBe(false)

    const ok = await autenticacao.definirSenha(criado.senhaInicial, 'NovaSenha1', true)
    expect(ok.sucesso).toBe(true)
    expect(autenticacao.sessaoAtual().primeiroAcesso).toBe(false)

    await autenticacao.sair()
    expect((await autenticacao.entrar('renata.lacerda', 'NovaSenha1', false)).sucesso).toBe(true)
  })
})

describe('controle de perfil', () => {
  it('exigirPerfil barra quem não é administrador', async () => {
    await criarAdministrador()
    const criado = await usuarios.criar({
      nomeCompleto: 'Patrícia Sarsur',
      cpf: CPF_PROFESSORA,
      dataNascimento: '1980-03-15',
      login: 'patricia.sarsur',
      perfil: 'professor',
      cursosPermitidos: []
    })
    if (!criado.sucesso) throw new Error(criado.mensagem)

    await autenticacao.sair()
    await autenticacao.entrar('patricia.sarsur', criado.senhaInicial, false)

    expect(() => autenticacao.exigirPerfil(['administrador'])).toThrow(/perfil não permite/)
    expect(() => autenticacao.exigirAutenticado()).not.toThrow()
  })

  it('exigirAutenticado barra quem não tem sessão', () => {
    expect(() => autenticacao.exigirAutenticado()).toThrow(/exige usuário autenticado/)
  })
})
