'use server'

import { revalidatePath } from 'next/cache'

import type {
  DadosCurso,
  FiltroUsuarios,
  ResultadoCurso,
  UsuarioResumo
} from '@/dominio/modelos/dtos'
import type { AreaConhecimento, PerfilUsuario } from '@/dominio/modelos/dominio'
import type { ResultadoOperacao } from '@/dominio/modelos/resultado'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { MapaDeAreas } from '@/dominio/regras/mapa-de-areas'
import { lerAreasDaPlanilha } from '@/infraestrutura/planilha/leitor-de-areas'
import { abrirPlanilha } from '@/infraestrutura/planilha/leitor-exceljs'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

/**
 * Ações de administração.
 *
 * Cada uma confere o perfil por conta própria, antes de qualquer coisa. Essa
 * repetição é proposital: uma `server action` é um endereço público, e o item
 * de menu escondido não defende nada — quem souber o nome da ação a chama
 * direto. A verificação não pode depender de por onde a pessoa chegou.
 */
async function exigirAdministrador(): Promise<void> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.administracao)
}

/* ---------- Cursos ---------- */

export async function salvarCurso(
  cursoId: string | null,
  dados: DadosCurso
): Promise<ResultadoCurso> {
  await exigirAdministrador()
  const cursos = Container.paraRequisicao().cursos()

  const resultado = cursoId ? await cursos.atualizar(cursoId, dados) : await cursos.criar(dados)
  if (resultado.sucesso) {
    revalidatePath('/admin/cursos')
    revalidatePath('/visao-geral')
  }
  return resultado
}

export async function removerCurso(cursoId: string): Promise<ResultadoOperacao> {
  await exigirAdministrador()
  const resultado = await Container.paraRequisicao().cursos().remover(cursoId)
  if (resultado.sucesso) revalidatePath('/admin/cursos')
  return resultado
}

/* ---------- Usuários ---------- */

export async function listarUsuarios(filtro: FiltroUsuarios): Promise<UsuarioResumo[]> {
  await exigirAdministrador()
  return Container.paraRequisicao().usuarios().listar(filtro)
}

export async function criarUsuario(
  _estadoAnterior: unknown,
  formulario: FormData
): Promise<{ sucesso: boolean; mensagem?: string; senhaInicial?: string; nome?: string }> {
  await exigirAdministrador()

  const perfilBruto = String(formulario.get('perfil') ?? '')
  if (!EscopoDeAcesso.ehPerfilValido(perfilBruto)) {
    return { sucesso: false, mensagem: 'Selecione um perfil válido.' }
  }

  const resultado = await Container.paraRequisicao().usuarios().criar({
    nomeCompleto: String(formulario.get('nomeCompleto') ?? ''),
    cpf: String(formulario.get('cpf') ?? ''),
    dataNascimento: String(formulario.get('dataNascimento') ?? ''),
    login: String(formulario.get('login') ?? ''),
    perfil: perfilBruto,
    cursosPermitidos: formulario.getAll('cursosPermitidos').map(String)
  })

  if (!resultado.sucesso) return { sucesso: false, mensagem: resultado.mensagem }

  revalidatePath('/admin/usuarios')
  /*
   * A senha inicial volta para a tela porque é exibida uma única vez, para
   * ser entregue à pessoa. Não fica gravada em lugar nenhum legível.
   */
  return {
    sucesso: true,
    senhaInicial: resultado.senhaInicial,
    nome: resultado.usuario.nomeCompleto
  }
}

export async function redefinirSenhaDeUsuario(
  usuarioId: string
): Promise<{ sucesso: boolean; mensagem?: string; senhaInicial?: string; nome?: string }> {
  const { usuario } = await SessaoHttp.exigirEscopo()
  await exigirAdministrador()

  const resultado = await Container.paraRequisicao()
    .usuarios()
    .redefinirSenha(usuarioId, usuario._id)

  if (!resultado.sucesso) return { sucesso: false, mensagem: resultado.mensagem }
  revalidatePath('/admin/usuarios')
  return {
    sucesso: true,
    senhaInicial: resultado.senhaInicial,
    nome: resultado.usuario.nomeCompleto
  }
}

export async function alterarSituacaoDeUsuario(
  usuarioId: string,
  ativo: boolean
): Promise<ResultadoOperacao> {
  const { usuario } = await SessaoHttp.exigirEscopo()
  await exigirAdministrador()

  const resultado = await Container.paraRequisicao()
    .usuarios()
    .alterarSituacao(usuarioId, ativo, usuario._id)
  if (resultado.sucesso) revalidatePath('/admin/usuarios')
  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

export async function alterarPerfilDeUsuario(
  usuarioId: string,
  perfil: PerfilUsuario
): Promise<ResultadoOperacao> {
  const { usuario } = await SessaoHttp.exigirEscopo()
  await exigirAdministrador()

  const resultado = await Container.paraRequisicao()
    .usuarios()
    .alterarPerfil(usuarioId, perfil, usuario._id)
  if (resultado.sucesso) revalidatePath('/admin/usuarios')
  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

export async function alterarEscopoDeUsuario(
  usuarioId: string,
  cursosPermitidos: string[]
): Promise<ResultadoOperacao> {
  await exigirAdministrador()

  const resultado = await Container.paraRequisicao()
    .usuarios()
    .alterarEscopo(usuarioId, cursosPermitidos)
  if (resultado.sucesso) revalidatePath('/admin/usuarios')
  return resultado.sucesso ? { sucesso: true } : { sucesso: false, mensagem: resultado.mensagem }
}

/* ---------- Importações ---------- */

export async function excluirAplicacao(aplicacaoId: string): Promise<ResultadoOperacao> {
  await exigirAdministrador()
  const resultado = await Container.paraRequisicao().importacao().excluirAplicacao(aplicacaoId)
  if (resultado.sucesso) {
    revalidatePath('/admin/historico')
    revalidatePath('/visao-geral')
  }
  return resultado
}

/* ---------- Áreas a partir da planilha ---------- */

export interface ResultadoImportacaoAreas {
  sucesso: boolean
  mensagem?: string
  areas?: AreaConhecimento[]
  relatorio?: {
    aba: string
    areasNovas: string[]
    temasAtribuidos: number
    temasMovidos: string[]
    temasDesconhecidos: string[]
    temasSemArea: string[]
    avisos: string[]
  }
}

/**
 * Lê a planilha tema → área que a coordenação mantém à mão.
 *
 * A IA fica fora do produto: ela ajuda a preparar a planilha, e o que entra
 * aqui é o arquivo conferido por quem entende do instrumento. Esta ação não
 * grava nada — devolve o resultado da mesclagem para a tela mostrar o que
 * mudaria, e só o salvamento do curso efetiva.
 */
export async function importarAreasDaPlanilha(
  cursoId: string | null,
  areasAtuais: AreaConhecimento[],
  formulario: FormData
): Promise<ResultadoImportacaoAreas> {
  await exigirAdministrador()

  const arquivo = formulario.get('planilha')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { sucesso: false, mensagem: 'Escolha a planilha de áreas.' }
  }

  let leitura
  try {
    const workbook = await abrirPlanilha(new Uint8Array(await arquivo.arrayBuffer()))
    leitura = lerAreasDaPlanilha(workbook)
  } catch (erro) {
    return {
      sucesso: false,
      mensagem: `Não consegui abrir esta planilha. (${erro instanceof Error ? erro.message : String(erro)})`
    }
  }

  if (!leitura) {
    return {
      sucesso: false,
      mensagem:
        'Nenhuma aba tem as duas colunas necessárias. A planilha precisa de uma coluna de tema ' +
        '(ou assunto/conteúdo) e uma de área (ou eixo/campo).'
    }
  }

  const temasImportados = cursoId
    ? await Container.paraRequisicao().cursos().temasImportados(cursoId)
    : []

  const mesclagem = new MapaDeAreas(areasAtuais).mesclarCom(leitura.pares, temasImportados)

  return {
    sucesso: true,
    areas: mesclagem.areas,
    relatorio: {
      aba: leitura.aba,
      areasNovas: mesclagem.areasNovas,
      temasAtribuidos: mesclagem.temasAtribuidos,
      temasMovidos: mesclagem.temasMovidos,
      temasDesconhecidos: mesclagem.temasDesconhecidos,
      temasSemArea: mesclagem.temasSemArea,
      avisos: leitura.avisos
    }
  }
}
