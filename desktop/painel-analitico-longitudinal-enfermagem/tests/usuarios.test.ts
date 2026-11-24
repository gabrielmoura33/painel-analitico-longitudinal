import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RepositorioLocal } from '../src/main/db/drivers/local'
import { ServicoUsuarios } from '../src/main/servicos/usuarios'
import { validarSenha } from '../src/shared/validacao'

const CPF_A = '529.982.247-25'
const CPF_B = '168.995.350-09'

let pasta: string
let repositorio: RepositorioLocal
let usuarios: ServicoUsuarios

async function criar(
  login: string,
  perfil: 'professor' | 'administrador',
  cpf = CPF_A,
  nome = 'Pessoa de Teste'
) {
  const resultado = await usuarios.criar({
    nomeCompleto: nome,
    cpf,
    dataNascimento: '1985-06-12',
    login,
    perfil,
    cursosPermitidos: []
  })
  if (!resultado.sucesso) throw new Error(resultado.mensagem)
  return resultado
}

beforeEach(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'painel-usuarios-'))
  repositorio = new RepositorioLocal(join(pasta, 'dados.json'))
  await repositorio.conectar()
  usuarios = new ServicoUsuarios(repositorio)
})

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('criação de usuário', () => {
  it('gera senha inicial que atende às regras de senha', async () => {
    const criado = await criar('maria.silva', 'professor')
    expect(validarSenha(criado.senhaInicial).valido).toBe(true)
    expect(criado.senhaInicial).toHaveLength(10)
  })

  it('nunca expõe hash de senha à interface', async () => {
    const criado = await criar('maria.silva', 'professor')
    expect(Object.keys(criado.usuario)).not.toContain('senhaHash')
    expect(Object.keys(criado.usuario)).not.toContain('cpf')
  })

  it('normaliza o login e recusa duplicata', async () => {
    const criado = await criar('Maria.Silva', 'professor')
    expect(criado.usuario.login).toBe('maria.silva')

    const repetido = await usuarios.criar({
      nomeCompleto: 'Outra Pessoa',
      cpf: CPF_B,
      dataNascimento: '1985-06-12',
      login: 'MARIA.SILVA',
      perfil: 'professor',
      cursosPermitidos: []
    })
    expect(repetido).toMatchObject({ sucesso: false })
  })

  it('recusa CPF já cadastrado', async () => {
    await criar('maria.silva', 'professor', CPF_A)
    const repetido = await usuarios.criar({
      nomeCompleto: 'Outra Pessoa',
      cpf: CPF_A,
      dataNascimento: '1985-06-12',
      login: 'outra.pessoa',
      perfil: 'professor',
      cursosPermitidos: []
    })
    expect(repetido).toMatchObject({ sucesso: false })
  })

  it('gera senhas iniciais diferentes a cada chamada', async () => {
    const primeira = await criar('maria.silva', 'professor', CPF_A)
    const segunda = await criar('joao.souza', 'professor', CPF_B)
    expect(primeira.senhaInicial).not.toBe(segunda.senhaInicial)
  })
})

describe('regras de proteção do administrador', () => {
  it('impede desativar o próprio usuário', async () => {
    const admin = await criar('admin.um', 'administrador', CPF_A)
    const resultado = await usuarios.alterarSituacao(admin.usuario._id, false, admin.usuario._id)
    expect(resultado).toMatchObject({ sucesso: false })
  })

  it('impede rebaixar o próprio perfil', async () => {
    const admin = await criar('admin.um', 'administrador', CPF_A)
    const resultado = await usuarios.alterarPerfil(
      admin.usuario._id,
      'professor',
      admin.usuario._id
    )
    expect(resultado).toMatchObject({ sucesso: false })
  })

  it('impede deixar a instalação sem administrador ativo', async () => {
    const admin = await criar('admin.um', 'administrador', CPF_A)
    const desativar = await usuarios.alterarSituacao(admin.usuario._id, false, 'outro-id')
    expect(desativar).toMatchObject({ sucesso: false })

    const rebaixar = await usuarios.alterarPerfil(admin.usuario._id, 'professor', 'outro-id')
    expect(rebaixar).toMatchObject({ sucesso: false })
  })

  it('permite desativar um administrador quando há outro ativo', async () => {
    const primeiro = await criar('admin.um', 'administrador', CPF_A)
    await criar('admin.dois', 'administrador', CPF_B)
    const resultado = await usuarios.alterarSituacao(primeiro.usuario._id, false, 'outro-id')
    expect(resultado.sucesso).toBe(true)
  })
})

describe('redefinição de senha', () => {
  it('invalida a senha anterior e volta a exigir troca', async () => {
    const criado = await criar('maria.silva', 'professor')
    const redefinido = await usuarios.redefinirSenha(criado.usuario._id, 'admin-id')
    if (!redefinido.sucesso) throw new Error(redefinido.mensagem)

    expect(redefinido.senhaInicial).not.toBe(criado.senhaInicial)
    expect(redefinido.usuario.primeiroAcesso).toBe(true)
  })

  it('derruba a sessão lembrada do usuário', async () => {
    const criado = await criar('maria.silva', 'professor')
    await repositorio.sessoes.inserir({
      usuarioId: criado.usuario._id,
      criadaEm: new Date().toISOString(),
      expiraEm: new Date(Date.now() + 86_400_000).toISOString()
    })

    await usuarios.redefinirSenha(criado.usuario._id, 'admin-id')
    expect(await repositorio.sessoes.contar({ usuarioId: criado.usuario._id })).toBe(0)
  })
})

describe('pedidos de redefinição', () => {
  it('registra pedido de login existente e ignora inexistente', async () => {
    await criar('maria.silva', 'professor')

    await usuarios.registrarSolicitacaoSenha('MARIA.SILVA')
    await usuarios.registrarSolicitacaoSenha('nao.existe')

    const pendentes = await usuarios.solicitacoesPendentes()
    expect(pendentes).toHaveLength(1)
    expect(pendentes[0]?.login).toBe('maria.silva')
  })

  it('não acumula pedidos repetidos do mesmo usuário', async () => {
    await criar('maria.silva', 'professor')
    await usuarios.registrarSolicitacaoSenha('maria.silva')
    await usuarios.registrarSolicitacaoSenha('maria.silva')
    expect(await usuarios.solicitacoesPendentes()).toHaveLength(1)
  })

  it('marca o pedido como atendido quando o administrador redefine a senha', async () => {
    const criado = await criar('maria.silva', 'professor')
    await usuarios.registrarSolicitacaoSenha('maria.silva')
    await usuarios.redefinirSenha(criado.usuario._id, 'admin-id')
    expect(await usuarios.solicitacoesPendentes()).toHaveLength(0)
  })
})

describe('listagem', () => {
  it('busca por nome sem acento e filtra por perfil e situação', async () => {
    await criar('patricia.sarsur', 'professor', CPF_A, 'Patrícia Sarsur')
    await criar('admin.um', 'administrador', CPF_B, 'Gabriel de Moura')

    expect(await usuarios.listar({ busca: 'patricia' })).toHaveLength(1)
    expect(await usuarios.listar({ busca: 'PATRÍCIA' })).toHaveLength(1)
    expect(await usuarios.listar({ perfil: 'administrador' })).toHaveLength(1)
    expect(await usuarios.listar({ ativo: true })).toHaveLength(2)
  })

  it('ordena por nome em português', async () => {
    await criar('zeca.pagodinho', 'professor', CPF_A, 'Zeca Pagodinho')
    await criar('ana.alves', 'professor', CPF_B, 'Ana Alves')
    const lista = await usuarios.listar()
    expect(lista.map((usuario) => usuario.nomeCompleto)).toEqual(['Ana Alves', 'Zeca Pagodinho'])
  })
})
