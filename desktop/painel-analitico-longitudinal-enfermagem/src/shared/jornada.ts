/**
 * Roteiro da jornada guiada e as regras de quem vê cada passo.
 *
 * Fica em `shared` por ser dado puro, sem nada de interface: assim a camada
 * que desenha a jornada e os testes leem o mesmo roteiro, e um passo que
 * aponte para um elemento inexistente é pego fora da tela.
 */

export interface PassoJornada {
  titulo: string
  texto: string
  /** Rota onde o passo acontece. Ausente, o passo fica onde a pessoa estiver. */
  caminho?: string
  /** Seletor do elemento aceso. Ausente, o cartão aparece centralizado. */
  alvo?: string
  /** Convite para experimentar depois da jornada, quando faz sentido. */
  experimente?: string
  somenteAdmin?: boolean
  exigeAplicacao?: boolean
}

export interface ContextoJornada {
  ehAdmin: boolean
  possuiAplicacoes: boolean
}

/**
 * Roteiro da jornada guiada.
 *
 * A ordem é a de quem nunca viu o painel: primeiro o que vale para todas as
 * telas (curso, aplicação, menu), depois o acompanhamento, depois a entrada de
 * dados e a administração. Cada passo fala de um elemento que existe de fato na
 * tela — nenhum dado de exemplo é inventado para a jornada.
 */
export const ROTEIRO_JORNADA: PassoJornada[] = [
  {
    titulo: 'Bem-vinda ao Painel Analítico',
    texto:
      'Esta jornada percorre o painel inteiro e acende, em cada passo, o elemento de que ' +
      'está falando. Você vê seus próprios dados, não um exemplo. Use Próximo e Anterior, ' +
      'ou as setas do teclado, e saia quando quiser com Esc.',
    caminho: '/guia'
  },
  {
    titulo: 'Curso e aplicação: o par que comanda tudo',
    texto:
      'Estes dois seletores valem para todas as telas de acompanhamento. O primeiro escolhe ' +
      'o curso; o segundo, a aplicação do Teste de Progresso. Nenhum número do painel existe ' +
      'solto: ele é sempre o desempenho daquele curso naquela aplicação.',
    experimente: 'Depois da jornada, troque a aplicação aqui e veja todas as telas mudarem.',
    caminho: '/guia',
    alvo: '[data-tour="filtro-global"]'
  },
  {
    titulo: 'O menu, agrupado por intenção',
    texto:
      'Visão geral responde "como foi o curso". Análises abre as cinco leituras detalhadas — ' +
      'discente, turma, áreas, questões e docentes. Importações e Administração só aparecem ' +
      'para quem administra o painel, e o Guia fica sempre no fim.',
    caminho: '/guia',
    alvo: '[data-tour="menu"]'
  },
  {
    titulo: 'Quem está usando o painel',
    texto:
      'Aqui ficam seu nome e seu perfil. Administrador importa planilhas, cadastra cursos e ' +
      'pessoas; professor usa as telas de acompanhamento. Sair encerra a sessão — e nenhuma ' +
      'tela fica acessível sem entrar de novo.',
    caminho: '/guia',
    alvo: '[data-tour="sessao"]'
  },
  {
    titulo: 'Visão geral: os cinco números do curso',
    texto:
      'Acerto médio, acertos em questões, nota pela régua do curso, quantidade de discentes ' +
      'avaliados e quantas áreas ficaram abaixo de 50%. Onde aparece uma seta, a comparação é ' +
      'sempre com a aplicação imediatamente anterior, em pontos percentuais.',
    caminho: '/visao-geral',
    alvo: '[data-tour="visao-kpis"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Geral e Específico, lado a lado',
    texto:
      'A prova tem dois componentes, e eles cobram coisas diferentes: conhecimento geral nas ' +
      'primeiras questões, conhecimento específico da Enfermagem nas demais. Separar os dois ' +
      'evita atribuir ao curso um resultado que vem da outra parte.',
    caminho: '/visao-geral',
    alvo: '[data-tour="visao-componentes"]',
    exigeAplicacao: true
  },
  {
    titulo: 'A série longitudinal',
    texto:
      'O gráfico da esquerda é o coração do projeto: uma aplicação por ponto, na ordem em que ' +
      'foram importadas. É isso que transforma planilhas isoladas em acompanhamento ao longo ' +
      'do curso. À direita, o acerto de cada período dentro desta aplicação.',
    caminho: '/visao-geral',
    alvo: '[data-tour="visao-graficos"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Distribuição das notas e destaques',
    texto:
      'À esquerda, quantos resultados caíram em cada nota da régua do curso — a média esconde ' +
      'isso. À direita, o que o próprio painel apontou nesta aplicação: áreas acima do ' +
      'esperado e áreas que pedem atenção.',
    caminho: '/visao-geral',
    alvo: '[data-tour="visao-destaques"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Áreas, da pior para a melhor',
    texto:
      'Cada linha traz o acerto nesta aplicação, o acerto histórico, a variação entre os dois ' +
      'e uma situação. Enquanto os temas da planilha não forem agrupados em áreas, cada linha ' +
      'é um tema de questão — a planilha não traz faixas amplas de conteúdo.',
    caminho: '/visao-geral',
    alvo: '[data-tour="visao-areas"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Turma: escolha o período',
    texto:
      'Esta tela olha um período por vez. Todos os períodos fazem a mesma prova no mesmo dia, ' +
      'e é isso que permite compará-los: a diferença entre eles é de formação, não de prova.',
    experimente: 'Troque o período aqui e acompanhe os números logo abaixo.',
    caminho: '/analises/turma',
    alvo: '[data-tour="turma-periodo"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Quanta gente está acima do mínimo',
    texto:
      'Além da média do período, o último cartão mostra a proporção de discentes que alcançou ' +
      'o mínimo esperado para aquele período, conforme a régua cadastrada no curso. Mudar a ' +
      'régua muda este número na hora, sem reimportar nada.',
    caminho: '/analises/turma',
    alvo: '[data-tour="turma-kpis"]',
    exigeAplicacao: true
  },
  {
    titulo: 'O que a média esconde',
    texto:
      'Cada barra vai do pior ao melhor acerto individual naquela área; a caixa cobre a metade ' +
      'central da turma e o traço marca a mediana. Caixa larga é turma desigual — duas áreas ' +
      'com a mesma média podem ter histórias bem diferentes.',
    caminho: '/analises/turma',
    alvo: '[data-tour="turma-dispersao"]',
    exigeAplicacao: true
  },
  {
    titulo: 'A turma pessoa por pessoa, sem nomes',
    texto:
      'Cada linha é um discente, identificado por pseudônimo — ENF-001, ENF-002 — como manda a ' +
      'Lei Geral de Proteção de Dados. A coluna de variação compara a pessoa com o próprio ' +
      'resultado anterior; quem não tem anterior aparece com um travessão, não com zero.',
    caminho: '/analises/turma',
    alvo: '[data-tour="turma-discentes"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Áreas de conhecimento: três leituras',
    texto:
      'Ranking ordena as áreas da pior para a melhor. Matriz período × área cruza as duas ' +
      'coisas e colore cada célula de 0% a 100% — a escala é fixa, então cores parecidas são ' +
      'desempenhos realmente parecidos. Evolução acompanha cada área entre as aplicações.',
    experimente: 'Abra a aba Matriz e passe o mouse numa célula para ver quantas questões a sustentam.',
    caminho: '/analises/areas',
    alvo: '[data-tour="areas-abas"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Questões: quais merecem revisão',
    texto:
      'Os cartões separam as questões difíceis (abaixo de 50%), médias e fáceis (70% ou mais), ' +
      'e contam quantas ficaram abaixo de 50% em todos os períodos ao mesmo tempo. Essas ' +
      'últimas são as candidatas naturais a revisão de enunciado ou de conteúdo.',
    caminho: '/analises/questoes',
    alvo: '[data-tour="questoes-kpis"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Filtrar por componente, docente ou criticidade',
    texto:
      'Os dois seletores reduzem a lista ao componente ou ao docente que interessa, e a caixa ' +
      'de seleção deixa só as questões que foram mal em todos os períodos. Os três se somam.',
    caminho: '/analises/questoes',
    alvo: '[data-tour="questoes-filtros"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Cada questão e seu comportamento por período',
    texto:
      'A tabela traz tema, gabarito, docente responsável, componente e acerto. A coluna "Por ' +
      'período" é uma pequena série: uma barra por período, alaranjada quando ficou abaixo de ' +
      '50%. Uma questão fácil no 10º e difícil no 6º é informação sobre o currículo.',
    caminho: '/analises/questoes',
    alvo: '[data-tour="questoes-tabela"]',
    exigeAplicacao: true
  },
  {
    titulo: 'O que esta fonte não permite saber',
    texto:
      'O painel diz abertamente o que não tem. A planilha registra apenas se o discente ' +
      'acertou, nunca qual alternativa ele marcou — então a análise de distractores precisaria ' +
      'de uma mudança na coleta, não no programa.',
    caminho: '/analises/questoes',
    alvo: '[data-tour="questoes-indisponivel"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Docentes responsáveis',
    texto:
      'Uma linha por docente, com quantas questões ele assina, o acerto médio delas e as ' +
      'questões de melhor e pior desempenho. Se a mesma pessoa aparecer duas vezes com grafias ' +
      'diferentes, é porque a unificação não foi confirmada na importação.',
    caminho: '/analises/docentes',
    alvo: '[data-tour="docentes-tabela"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Discente: a única tela com nome real',
    texto:
      'Busque por nome ou por pseudônimo e abra a ficha. Ela mostra a trajetória da pessoa ' +
      'entre as aplicações, o desempenho por área e a comparação com a turma. Por tratar de ' +
      'dado pessoal, cada abertura fica registrada — use quando houver motivo pedagógico.',
    caminho: '/analises/discente',
    alvo: '[data-tour="discente-busca"]',
    exigeAplicacao: true
  },
  {
    titulo: 'Importar uma aplicação nova',
    texto:
      'Arraste aqui a planilha .xlsx exportada pelo curso, ou escolha pelo botão, informe a ' +
      'que curso ela pertence e o rótulo da aplicação no formato ano/semestre — 2026/1. É por ' +
      'esta tela que a série longitudinal cresce.',
    caminho: '/importacoes',
    alvo: '[data-tour="importacao-arquivo"]',
    somenteAdmin: true
  },
  {
    titulo: 'Quatro passos, e nada é gravado antes do último',
    texto:
      'Primeiro o arquivo; depois o programa mostra o que entendeu de cada aba e você confirma ' +
      'o período de cada uma; em seguida decide quais grafias parecidas de docente devem ser ' +
      'unificadas; só então a confirmação grava. Se algo falhar no meio, o banco volta ao que era.',
    caminho: '/importacoes',
    alvo: '[data-tour="importacao-passos"]',
    somenteAdmin: true
  },
  {
    titulo: 'Histórico: o que já entrou, e com quais avisos',
    texto:
      'Cada linha é uma importação, com o arquivo, quem importou, quantos registros entraram e ' +
      'todas as ocorrências daquela carga. É aqui que se lê o relatório de uma importação ' +
      'antiga e, se for preciso, se exclui uma aplicação importada por engano.',
    caminho: '/admin/historico',
    alvo: '[data-tour="historico-tabela"]'
  },
  {
    titulo: 'Cursos e réguas',
    texto:
      'O curso guarda a quantidade de questões, os períodos avaliados, os componentes, a ' +
      'conversão de acertos em nota e as áreas de conhecimento. Mudar a régua aqui recalcula ' +
      'todos os painéis na hora, porque nenhuma nota fica gravada pronta.',
    experimente: 'É também aqui que os temas da planilha são agrupados nas áreas que a tela de áreas mostra.',
    caminho: '/admin/cursos',
    alvo: '[data-tour="cursos-tabela"]',
    somenteAdmin: true
  },
  {
    titulo: 'Usuários do painel',
    texto:
      'Cada pessoa cadastrada recebe uma senha inicial, exibida uma única vez, e é obrigada a ' +
      'trocá-la no primeiro acesso. Nesta lista também se troca o perfil, se desativa o acesso ' +
      'de quem saiu e se atendem os pedidos de redefinição de senha.',
    caminho: '/admin/usuarios',
    alvo: '[data-tour="usuarios-tabela"]',
    somenteAdmin: true
  },
  {
    titulo: 'Diagnóstico, para quando algo não parecer certo',
    texto:
      'Versão do programa e, principalmente, o arquivo em que todos os dados são gravados. É ' +
      'o que informar ao suporte — e é também a pasta a copiar quando se quer uma cópia de ' +
      'segurança do painel.',
    caminho: '/sistema',
    alvo: '[data-tour="diagnostico-dados"]'
  },
  {
    titulo: 'Pronto. O guia continua aqui',
    texto:
      'Você viu o painel inteiro. Nesta tela ficam a lista completa de funcionalidades, o que ' +
      'cada tela responde e as garantias que o programa nunca quebra — e o botão para repetir ' +
      'a jornada quando quiser, quantas vezes quiser.',
    caminho: '/guia'
  }
]

/** O roteiro reduzido ao que se aplica a esta pessoa e a esta instalação. */
export function passosAplicaveis(contexto: ContextoJornada): PassoJornada[] {
  return ROTEIRO_JORNADA.filter(
    (passo) =>
      (!passo.somenteAdmin || contexto.ehAdmin) &&
      (!passo.exigeAplicacao || contexto.possuiAplicacoes)
  )
}
