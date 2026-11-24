import { cursosVisiveis, type EscopoUsuario } from '@compartilhado/acesso'
import type {
  AreaConhecimento,
  Componente,
  Curso,
  FaixaRegua,
  PerfilImportacao
} from '@compartilhado/types/dominio'
import { temasDuplicados } from '@compartilhado/areas'
import type { DadosCurso, ResultadoCurso } from '@compartilhado/types/ipc'
import {
  COMPONENTES_SUGERIDOS,
  PERFIL_IMPORTACAO_SUGERIDO,
  REGUA_SUGERIDA
} from '@compartilhado/constants'

import type { Repositorio } from '../db'

const LETRA_COLUNA = /^[A-Z]{1,3}$/i

function limpar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/** Valores iniciais de um curso novo: ponto de partida editável, não regra fixa. */
export function cursoInicial(): DadosCurso {
  return {
    nome: '',
    sigla: '',
    instituicao: 'PUC Minas',
    campus: '',
    departamento: '',
    nomeInstrumento: 'Teste de Progresso',
    estrutura: {
      totalQuestoes: 35,
      periodos: REGUA_SUGERIDA.map((faixa) => faixa.periodo),
      componentes: COMPONENTES_SUGERIDOS.map((componente) => ({ ...componente }))
    },
    areas: [],
    regua: REGUA_SUGERIDA.map((faixa) => ({ ...faixa })),
    perfilImportacao: { ...PERFIL_IMPORTACAO_SUGERIDO }
  }
}

export class ServicoCursos {
  constructor(private readonly repositorio: Repositorio) {}

  /**
   * Cursos ordenados por nome, já recortados pelo escopo de quem pergunta.
   *
   * O recorte é aqui, no processo principal: a lista alimenta o seletor global
   * e, por ele, todas as telas analíticas. Filtrar só no renderer deixaria os
   * dados a um `invocar` de distância de quem não deve vê-los.
   */
  async listar(escopo?: EscopoUsuario): Promise<Curso[]> {
    const cursos = await this.repositorio.cursos.buscar()
    const ordenados = cursos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return escopo ? cursosVisiveis(escopo, ordenados) : ordenados
  }

  async obter(cursoId: string): Promise<Curso | null> {
    return this.repositorio.cursos.buscarPorId(cursoId)
  }

  /**
   * Temas distintos já importados para o curso.
   *
   * É a lista que a docente usa para montar as áreas: ela só existe depois de
   * a primeira planilha entrar, porque os temas vêm do instrumento.
   */
  async temasImportados(cursoId: string): Promise<string[]> {
    const questoes = await this.repositorio.questoes.buscar({ cursoId })
    const temas = new Set(questoes.map((questao) => questao.tema).filter(Boolean))
    return [...temas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  async criar(dados: DadosCurso): Promise<ResultadoCurso> {
    const problema = await this.validar(dados, null)
    if (problema) return { sucesso: false, mensagem: problema }

    const agora = new Date().toISOString()
    const curso = await this.repositorio.cursos.inserir({
      ...this.normalizar(dados),
      criadoEm: agora,
      atualizadoEm: agora
    })
    return { sucesso: true, curso }
  }

  async atualizar(cursoId: string, dados: DadosCurso): Promise<ResultadoCurso> {
    const existente = await this.repositorio.cursos.buscarPorId(cursoId)
    if (!existente) return { sucesso: false, mensagem: 'Curso não encontrado.' }

    const problema = await this.validar(dados, cursoId)
    if (problema) return { sucesso: false, mensagem: problema }

    const atualizado = await this.repositorio.cursos.atualizar(cursoId, {
      ...this.normalizar(dados),
      atualizadoEm: new Date().toISOString()
    })
    return atualizado
      ? { sucesso: true, curso: atualizado }
      : { sucesso: false, mensagem: 'Não foi possível salvar o curso.' }
  }

  /**
   * Remove o curso, desde que nada dependa dele. Um curso com aplicações
   * importadas não pode sumir levando consigo a série longitudinal.
   */
  async remover(cursoId: string): Promise<{ sucesso: boolean; mensagem?: string }> {
    const aplicacoes = await this.repositorio.aplicacoes.contar({ cursoId })
    if (aplicacoes > 0) {
      return {
        sucesso: false,
        mensagem:
          `Este curso tem ${aplicacoes} aplicação(ões) importada(s). ` +
          'Exclua as importações antes de remover o curso.'
      }
    }

    const removidos = await this.repositorio.cursos.remover({ _id: cursoId })
    return removidos > 0
      ? { sucesso: true }
      : { sucesso: false, mensagem: 'Curso não encontrado.' }
  }

  private normalizar(dados: DadosCurso): DadosCurso {
    return {
      nome: limpar(dados.nome),
      sigla: limpar(dados.sigla).toUpperCase(),
      instituicao: limpar(dados.instituicao),
      campus: limpar(dados.campus ?? ''),
      departamento: limpar(dados.departamento ?? ''),
      nomeInstrumento: limpar(dados.nomeInstrumento),
      estrutura: {
        totalQuestoes: Math.trunc(dados.estrutura.totalQuestoes),
        periodos: dados.estrutura.periodos.map(limpar).filter(Boolean),
        componentes: dados.estrutura.componentes.map((componente) => ({
          nome: limpar(componente.nome),
          questaoInicial: Math.trunc(componente.questaoInicial),
          questaoFinal: Math.trunc(componente.questaoFinal)
        }))
      },
      areas: dados.areas.map((area) => ({
        nome: limpar(area.nome),
        temas: [...new Set(area.temas.map(limpar).filter(Boolean))]
      })),
      regua: dados.regua.map((faixa) => ({
        periodo: limpar(faixa.periodo),
        notaBase: Math.trunc(faixa.notaBase),
        percentualMinimo: Math.trunc(faixa.percentualMinimo)
      })),
      perfilImportacao: {
        ...dados.perfilImportacao,
        colunaQuestao: dados.perfilImportacao.colunaQuestao.trim().toUpperCase(),
        colunaGabarito: dados.perfilImportacao.colunaGabarito.trim().toUpperCase(),
        colunaTema: dados.perfilImportacao.colunaTema.trim().toUpperCase(),
        colunaDocente: dados.perfilImportacao.colunaDocente.trim().toUpperCase(),
        primeiraColunaAluno: dados.perfilImportacao.primeiraColunaAluno.trim().toUpperCase(),
        marcadorAcerto: dados.perfilImportacao.marcadorAcerto.trim()
      }
    }
  }

  private async validar(dados: DadosCurso, cursoIdAtual: string | null): Promise<string | null> {
    const limpos = this.normalizar(dados)

    if (limpos.nome.length < 2) return 'Informe o nome do curso.'
    if (limpos.sigla.length < 2) return 'Informe a sigla do curso.'
    if (limpos.instituicao.length < 2) return 'Informe a instituição.'
    if (limpos.nomeInstrumento.length < 2) return 'Informe o nome do instrumento avaliativo.'

    const duplicado = (await this.repositorio.cursos.buscar()).find(
      (curso) => curso._id !== cursoIdAtual && curso.sigla === limpos.sigla
    )
    if (duplicado) return `Já existe um curso com a sigla "${limpos.sigla}".`

    const problemaEstrutura = this.validarEstrutura(limpos.estrutura.totalQuestoes, limpos.estrutura.periodos, limpos.estrutura.componentes)
    if (problemaEstrutura) return problemaEstrutura

    const problemaAreas = this.validarAreas(limpos.areas)
    if (problemaAreas) return problemaAreas

    const problemaRegua = this.validarRegua(limpos.regua, limpos.estrutura.periodos)
    if (problemaRegua) return problemaRegua

    return this.validarPerfil(limpos.perfilImportacao)
  }

  private validarEstrutura(
    totalQuestoes: number,
    periodos: string[],
    componentes: Componente[]
  ): string | null {
    if (!Number.isInteger(totalQuestoes) || totalQuestoes < 1) {
      return 'O número de questões deve ser um inteiro maior que zero.'
    }
    if (periodos.length === 0) return 'Informe ao menos um período avaliado.'
    if (new Set(periodos).size !== periodos.length) return 'Há períodos repetidos.'

    const ordenados = [...componentes].sort((a, b) => a.questaoInicial - b.questaoInicial)
    let anterior = 0

    for (const componente of ordenados) {
      if (!componente.nome) return 'Todo componente precisa de um nome.'
      if (componente.questaoInicial < 1 || componente.questaoFinal > totalQuestoes) {
        return `O componente "${componente.nome}" está fora da faixa de 1 a ${totalQuestoes}.`
      }
      if (componente.questaoInicial > componente.questaoFinal) {
        return `O componente "${componente.nome}" tem faixa invertida.`
      }
      if (componente.questaoInicial <= anterior) {
        return `As faixas de questões dos componentes se sobrepõem em "${componente.nome}".`
      }
      anterior = componente.questaoFinal
    }

    return null
  }

  private validarAreas(areas: AreaConhecimento[]): string | null {
    for (const area of areas) {
      if (!area.nome) return 'Toda área de conhecimento precisa de um nome.'
    }

    const nomes = areas.map((area) => area.nome.toLowerCase())
    if (new Set(nomes).size !== nomes.length) return 'Há áreas de conhecimento com o mesmo nome.'

    const duplicados = temasDuplicados(areas)
    if (duplicados.length > 0) {
      return `Estes temas estão em mais de uma área: ${duplicados.slice(0, 5).join(', ')}.`
    }

    return null
  }

  private validarRegua(regua: FaixaRegua[], periodos: string[]): string | null {
    for (const periodo of periodos) {
      const faixa = regua.find((item) => item.periodo === periodo)
      if (!faixa) return `O período ${periodo} está sem régua de notas.`
      if (!Number.isInteger(faixa.notaBase) || faixa.notaBase < 1 || faixa.notaBase > 10) {
        return `A nota base do período ${periodo} deve estar entre 1 e 10.`
      }
      if (
        !Number.isInteger(faixa.percentualMinimo) ||
        faixa.percentualMinimo < 0 ||
        faixa.percentualMinimo > 100
      ) {
        return `O percentual mínimo do período ${periodo} deve estar entre 0 e 100.`
      }
    }
    return null
  }

  private validarPerfil(perfil: PerfilImportacao): string | null {
    const colunas: Array<[string, string]> = [
      ['questão', perfil.colunaQuestao],
      ['gabarito', perfil.colunaGabarito],
      ['tema', perfil.colunaTema],
      ['docente', perfil.colunaDocente],
      ['primeira coluna de alunos', perfil.primeiraColunaAluno]
    ]

    for (const [rotulo, valor] of colunas) {
      if (!LETRA_COLUNA.test(valor)) {
        return `A coluna de ${rotulo} deve ser uma letra de planilha, como "A" ou "AB".`
      }
    }

    if (!Number.isInteger(perfil.linhaCabecalho) || perfil.linhaCabecalho < 1) {
      return 'A linha de cabeçalho deve ser um número de linha válido.'
    }
    if (perfil.linhaTotal !== null) {
      if (!Number.isInteger(perfil.linhaTotal) || perfil.linhaTotal <= perfil.linhaCabecalho) {
        return 'A linha de total deve vir depois da linha de cabeçalho.'
      }
    }
    if (perfil.linhaMatricula !== null) {
      if (!Number.isInteger(perfil.linhaMatricula) || perfil.linhaMatricula < 1) {
        return 'A linha de matrícula deve ser um número de linha válido.'
      }
      if (perfil.linhaMatricula === perfil.linhaCabecalho) {
        return 'A linha de matrícula não pode ser a mesma linha dos nomes dos discentes.'
      }
    }
    if (perfil.marcadorAcerto.length === 0) {
      return 'Informe qual valor marca um acerto na planilha.'
    }

    return null
  }
}
