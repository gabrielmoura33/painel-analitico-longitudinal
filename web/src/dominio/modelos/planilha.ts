/** Tipos da leitura de planilhas, compartilhados entre o main e a interface. */

export interface ResumoAba {
  nome: string
  linhas: number
  colunas: number
  /** Texto da primeira linha, que nas planilhas da amostra traz o título. */
  titulo: string
}

export interface ParPercentualNota {
  percentual: number
  nota: number
}

export interface AjusteRegua {
  notaBase: number
  percentualMinimo: number
  paresConferidos: number
  divergencias: ParPercentualNota[]
}

export interface DeducaoRegua {
  /** Primeiro candidato, por ordem de nota base. Só use direto se não for ambíguo. */
  melhor: AjusteRegua
  /** Todas as configurações que explicam os dados igualmente bem. */
  candidatos: AjusteRegua[]
  ambiguo: boolean
}

export interface DeducaoPeriodo {
  rotuloPeriodo: string
  totalPares: number
  deducao: DeducaoRegua | null
}

export interface LeituraReguaPlanilha {
  aba: string
  periodos: DeducaoPeriodo[]
}

export interface QuestaoLida {
  numero: number
  gabarito: string
  tema: string
  docente: string
  acertos: number
}

export interface PreviaAba {
  aba: string
  titulo: string
  discentes: string[]
  /** Uma por discente, na mesma ordem. Vazia quando o perfil não aponta a linha de matrícula. */
  matriculas: string[]
  questoes: QuestaoLida[]
  totalRegistros: number
  avisos: string[]
}

export interface ArquivoEscolhido {
  caminho: string
  nome: string
}

/** Um par lido da planilha de áreas: o tema da questão e a área que o abriga. */
export interface ParTemaArea {
  tema: string
  area: string
}

export interface LeituraAreasPlanilha {
  aba: string
  pares: ParTemaArea[]
  avisos: string[]
}

/**
 * Uma questão dentro da matriz lida de uma aba.
 *
 * Na versão desktop estes dois tipos moravam no módulo de leitura, junto da
 * biblioteca que abria o arquivo. Aqui são modelo de domínio: a matriz é o que
 * a aplicação entende de uma planilha, independentemente de quem a leu — o que
 * permite trocar o leitor sem tocar no carregador.
 */
export interface QuestaoMatriz {
  numero: number
  gabarito: string
  tema: string
  docente: string
  /** Uma posição por discente, na mesma ordem de `discentes`. */
  acertos: boolean[]
}

export interface MatrizAba {
  aba: string
  titulo: string
  discentes: string[]
  /** Uma posição por discente, na mesma ordem. Vazia quando a planilha não traz matrícula. */
  matriculas: string[]
  questoes: QuestaoMatriz[]
  avisos: string[]
}
