'use server'

import { revalidatePath } from 'next/cache'

import type {
  AnaliseImportacao,
  DecisoesImportacao,
  ResultadoImportacao
} from '@/dominio/modelos/importacao'
import { EscopoDeAcesso } from '@/dominio/regras/escopo-de-acesso'
import { Container } from '@/infraestrutura/container'
import { SessaoHttp } from '@/infraestrutura/http/sessao-http'

/**
 * Ações da importação.
 *
 * Dois passos separados de propósito: `analisar` nunca grava nada, e
 * `importar` só age sobre decisões que a pessoa confirmou na tela. Entre os
 * dois, o arquivo vive no armazém temporário — na web não há caminho de
 * disco para reler.
 */
async function exigirImportador(cursoId: string): Promise<void> {
  const { escopo } = await SessaoHttp.exigirEscopo()
  escopo.exigirPerfil(EscopoDeAcesso.PERFIS_POR_AREA.importacao)
  escopo.exigirCurso(cursoId)
}

export async function analisarPlanilha(
  _estadoAnterior: unknown,
  formulario: FormData
): Promise<{ analise?: AnaliseImportacao; erro?: string }> {
  const cursoId = String(formulario.get('cursoId') ?? '')
  const rotulo = String(formulario.get('rotulo') ?? '').trim()
  const arquivo = formulario.get('planilha')

  if (!cursoId) return { erro: 'Escolha o curso a que esta planilha pertence.' }
  await exigirImportador(cursoId)

  if (!/^\d{4}\/[12]$/.test(rotulo)) {
    return { erro: 'Informe a aplicação no formato ano/semestre, como 2026/1.' }
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: 'Escolha a planilha .xlsx exportada pelo curso.' }
  }

  const container = Container.paraRequisicao()
  const uploadId = await container.armazemDeUpload.guardar(
    new Uint8Array(await arquivo.arrayBuffer()),
    arquivo.name
  )

  const analise = await container.importacao().analisar(uploadId, cursoId, rotulo)
  if ('erro' in analise) {
    await container.armazemDeUpload.descartar(uploadId)
    return { erro: analise.erro }
  }
  return { analise }
}

export async function confirmarImportacao(
  decisoes: DecisoesImportacao
): Promise<ResultadoImportacao> {
  const { usuario } = await SessaoHttp.exigirEscopo()
  await exigirImportador(decisoes.cursoId)

  const container = Container.paraRequisicao()
  const resultado = await container.importacao().importar(decisoes, usuario._id)

  if (resultado.sucesso) {
    await container.armazemDeUpload.descartar(decisoes.uploadId)
    revalidatePath('/visao-geral')
    revalidatePath('/admin/historico')
  }
  return resultado
}
