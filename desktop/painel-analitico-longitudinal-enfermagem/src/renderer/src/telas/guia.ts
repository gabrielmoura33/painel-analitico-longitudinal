import type { Curso } from '@compartilhado/types/dominio'
import type { EstadoInicial } from '@compartilhado/types/ipc'

import { navegarPara } from '../rotas'

import { iniciarJornada, passosDaJornada } from './jornada'

/**
 * Guia de uso.
 *
 * Quem opera o painel é a docente, não a equipe que o construiu: o guia é a
 * única tela que explica o programa em vez de mostrar dados. Ele abre sozinho
 * no primeiro acesso de cada pessoa e continua no menu, porque ninguém decora
 * um roteiro visto uma vez só.
 */

interface Passo {
  titulo: string
  texto: string
  caminho: string
  rotuloAcao: string
  concluido: boolean
}

interface TelaExplicada {
  titulo: string
  caminho: string
  pergunta: string
  comoLer: string
  somenteAdmin?: boolean
}

const TELAS: TelaExplicada[] = [
  {
    titulo: 'Visão geral',
    caminho: '/visao-geral',
    pergunta: 'Como foi o curso nesta aplicação?',
    comoLer:
      'Os números do topo valem para a aplicação escolhida na barra superior. A série ' +
      'ao lado compara com as aplicações anteriores, e a variação sempre se refere à ' +
      'aplicação imediatamente anterior.'
  },
  {
    titulo: 'Turma',
    caminho: '/analises/turma',
    pergunta: 'Como foi cada período, e quanto as pessoas se espalham dentro dele?',
    comoLer:
      'A caixa de dispersão mostra onde está a maioria da turma: quanto mais larga, ' +
      'mais desigual o desempenho. As pessoas aparecem por pseudônimo, nunca por nome.'
  },
  {
    titulo: 'Discente',
    caminho: '/analises/discente',
    pergunta: 'Como foi uma pessoa específica, questão a questão?',
    comoLer:
      'É a única tela com o nome real, e cada abertura fica registrada. Busque pelo ' +
      'nome e acompanhe a evolução dela entre as aplicações já importadas.'
  },
  {
    titulo: 'Áreas de conhecimento',
    caminho: '/analises/areas',
    pergunta: 'Em que conteúdos a turma vai bem, e em quais não vai?',
    comoLer:
      'Enquanto as áreas não forem cadastradas no curso, cada linha é uma questão — ' +
      'a planilha traz um tema por questão, não faixas amplas de conteúdo.'
  },
  {
    titulo: 'Questões',
    caminho: '/analises/questoes',
    pergunta: 'Quais questões foram mais difíceis, e para quais períodos?',
    comoLer:
      'A escala de cor vai de 0% a 100%, e não do menor ao maior valor da prova: ' +
      'cores parecidas significam desempenhos realmente parecidos.'
  },
  {
    titulo: 'Docentes responsáveis',
    caminho: '/analises/docentes',
    pergunta: 'Como foram as questões de cada docente?',
    comoLer:
      'Se a mesma pessoa aparecer duas vezes com grafias diferentes, é porque a ' +
      'unificação não foi confirmada na importação. Dá para corrigir reimportando.'
  },
  {
    titulo: 'Importar planilha',
    caminho: '/importacoes',
    pergunta: 'Como colocar uma aplicação nova no painel?',
    somenteAdmin: true,
    comoLer:
      'Arraste o arquivo, confira o que o programa entendeu de cada aba, decida as ' +
      'unificações de grafia e leia o relatório. Nada é gravado antes do último passo.'
  },
  {
    titulo: 'Histórico de importações',
    caminho: '/admin/historico',
    pergunta: 'O que já entrou no painel, e com quais avisos?',
    comoLer:
      'Cada linha guarda o arquivo, quem importou e todas as ocorrências daquela ' +
      'carga. É por aqui que se desfaz uma importação equivocada.'
  },
  {
    titulo: 'Cursos e réguas',
    caminho: '/admin/cursos',
    pergunta: 'Como o curso converte acertos em nota, e quais são suas áreas?',
    somenteAdmin: true,
    comoLer:
      'Mudar a régua aqui muda todos os painéis na hora, sem reimportar planilha. ' +
      'É também onde cada tema importado é atribuído a uma área de conhecimento.'
  },
  {
    titulo: 'Usuários',
    caminho: '/admin/usuarios',
    pergunta: 'Quem mais pode entrar no painel?',
    somenteAdmin: true,
    comoLer:
      'Cada pessoa cadastrada recebe uma senha inicial, mostrada uma única vez. ' +
      'Pedidos de redefinição aparecem nesta mesma lista.'
  }
]

const REGRAS: Array<[string, string]> = [
  [
    'Nada é gravado antes da sua confirmação',
    'A importação mostra o que entendeu e só escreve depois que você manda importar. ' +
      'Se algo der errado no meio, o banco volta exatamente ao que era.'
  ],
  [
    'Nome parecido nunca é unificado sozinho',
    'Espaço sobrando o programa apara sem perguntar, porque não muda o que está escrito. ' +
      'Já juntar "Angea" e "Angela" é decisão sua, feita na tela de importação.'
  ],
  [
    'A mesma planilha não entra duas vezes',
    'O arquivo é reconhecido pelo conteúdo. Para corrigir uma carga, marque ' +
      '"substituir a importação anterior" em vez de importar de novo.'
  ],
  [
    'Percentual e nota são calculados na hora',
    'Nenhum indicador fica gravado pronto. Por isso alterar a régua do curso ' +
      'atualiza as telas imediatamente.'
  ],
  [
    'O nome real aparece em uma tela só',
    'Nas visões de turma e de área as pessoas são identificadas por pseudônimo. ' +
      'A ficha individual mostra o nome e registra cada abertura.'
  ]
]

function cabecalho(): HTMLElement {
  const bloco = document.createElement('div')
  bloco.className = 'cabecalho-pagina'
  bloco.innerHTML = `
    <h1>Guia do painel</h1>
    <p>Por onde começar, o que cada tela responde e o que o programa nunca decide sozinho.</p>`
  return bloco
}

function montarPasso(passo: Passo, numero: number): HTMLElement {
  const item = document.createElement('li')
  item.className = 'guia-passo'
  item.dataset.estado = passo.concluido ? 'concluido' : 'pendente'

  const marca = document.createElement('span')
  marca.className = 'guia-passo__marca'
  marca.textContent = passo.concluido ? '✓' : String(numero)
  marca.setAttribute('aria-hidden', 'true')

  const corpo = document.createElement('div')
  corpo.className = 'guia-passo__corpo'

  const titulo = document.createElement('h3')
  titulo.textContent = passo.titulo

  const texto = document.createElement('p')
  texto.textContent = passo.texto

  corpo.append(titulo, texto)

  const acao = document.createElement('button')
  acao.type = 'button'
  acao.className = passo.concluido ? 'botao botao--secundario' : 'botao'
  acao.textContent = passo.concluido ? 'Revisar' : passo.rotuloAcao
  acao.addEventListener('click', () => navegarPara(passo.caminho))

  const situacao = document.createElement('span')
  situacao.className = passo.concluido ? 'etiqueta etiqueta--positiva' : 'etiqueta etiqueta--neutra'
  situacao.textContent = passo.concluido ? 'feito' : 'pendente'

  item.append(marca, corpo, situacao, acao)
  return item
}

function secaoPrimeirosPassos(passos: Passo[]): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const titulo = document.createElement('h2')
  titulo.className = 'secao__titulo'
  titulo.textContent = 'Por onde começar'

  const descricao = document.createElement('p')
  descricao.className = 'secao__descricao'
  descricao.textContent =
    'O painel só tem o que mostrar depois que um curso existe e uma planilha entra. ' +
    'Esta lista acompanha o que já foi feito nesta instalação.'

  const lista = document.createElement('ol')
  lista.className = 'guia-passos'
  passos.forEach((passo, indice) => lista.append(montarPasso(passo, indice + 1)))

  secao.append(titulo, descricao, lista)
  return secao
}

function cartaoTela(tela: TelaExplicada): HTMLElement {
  const cartao = document.createElement('article')
  cartao.className = 'cartao guia-tela'

  const titulo = document.createElement('h3')
  titulo.className = 'guia-tela__titulo'
  titulo.textContent = tela.titulo

  const pergunta = document.createElement('p')
  pergunta.className = 'guia-tela__pergunta'
  pergunta.textContent = tela.pergunta

  const comoLer = document.createElement('p')
  comoLer.className = 'guia-tela__texto'
  comoLer.textContent = tela.comoLer

  const abrir = document.createElement('button')
  abrir.type = 'button'
  abrir.className = 'botao botao--texto'
  abrir.textContent = 'Abrir esta tela'
  abrir.addEventListener('click', () => navegarPara(tela.caminho))

  cartao.append(titulo, pergunta, comoLer, abrir)
  return cartao
}

function secaoTelas(ehAdmin: boolean): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const titulo = document.createElement('h2')
  titulo.className = 'secao__titulo'
  titulo.textContent = 'O que cada tela responde'

  const descricao = document.createElement('p')
  descricao.className = 'secao__descricao'
  descricao.textContent =
    'Toda tela analítica é relativa ao curso e à aplicação escolhidos na barra do topo. ' +
    'Trocar a aplicação lá em cima muda o que todas elas mostram.'

  const grade = document.createElement('div')
  grade.className = 'grade-2'
  for (const tela of TELAS) {
    if (tela.somenteAdmin && !ehAdmin) continue
    grade.append(cartaoTela(tela))
  }

  secao.append(titulo, descricao, grade)
  return secao
}

function secaoRegras(): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const titulo = document.createElement('h2')
  titulo.className = 'secao__titulo'
  titulo.textContent = 'O que o programa nunca faz sozinho'

  const descricao = document.createElement('p')
  descricao.className = 'secao__descricao'
  descricao.textContent =
    'Cinco garantias que valem em qualquer tela. Elas explicam a maior parte das ' +
    'perguntas que aparecem no uso do dia a dia.'

  const lista = document.createElement('ul')
  lista.className = 'guia-regras'
  for (const [regra, explicacao] of REGRAS) {
    const item = document.createElement('li')
    item.className = 'guia-regra'

    const nome = document.createElement('h3')
    nome.className = 'guia-regra__titulo'
    nome.textContent = regra

    const texto = document.createElement('p')
    texto.className = 'guia-regra__texto'
    texto.textContent = explicacao

    item.append(nome, texto)
    lista.append(item)
  }

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.append(lista)

  secao.append(titulo, descricao, cartao)
  return secao
}

function secaoSuporte(): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const titulo = document.createElement('h2')
  titulo.className = 'secao__titulo'
  titulo.textContent = 'Se algo não parecer certo'

  const lista = document.createElement('ul')
  lista.className = 'alerta-lista'

  const itens: Array<[string, string]> = [
    [
      'Um número parece errado',
      'Abra o Histórico de importações e leia as ocorrências daquela carga: grafias não ' +
        'unificadas e pessoas sem nenhum acerto costumam explicar a diferença.'
    ],
    [
      'Esqueci minha senha',
      'Peça a redefinição na tela de entrada. O pedido aparece para a administradora, ' +
        'que gera uma nova senha inicial.'
    ],
    [
      'Preciso dizer ao suporte onde os dados estão',
      'A tela de diagnóstico mostra a versão da aplicação e o arquivo em que tudo é gravado.'
    ]
  ]

  for (const [problema, saida] of itens) {
    const item = document.createElement('li')
    const forte = document.createElement('strong')
    forte.textContent = `${problema}. `
    item.append(forte, document.createTextNode(saida))
    lista.append(item)
  }

  const diagnostico = document.createElement('button')
  diagnostico.type = 'button'
  diagnostico.className = 'botao botao--secundario'
  diagnostico.textContent = 'Abrir o diagnóstico do sistema'
  diagnostico.addEventListener('click', () => navegarPara('/sistema'))

  const cartao = document.createElement('div')
  cartao.className = 'cartao'
  cartao.append(lista, diagnostico)

  secao.append(titulo, cartao)
  return secao
}

/**
 * Passos de configuração, na ordem em que um painel novo precisa deles.
 *
 * Só o administrador cadastra curso, planilha e pessoas; para o professor a
 * lista não existe, porque não haveria nada que ele pudesse fazer nela.
 */
async function primeirosPassos(estado: EstadoInicial): Promise<Passo[]> {
  let cursos: Curso[] = []
  try {
    cursos = await window.painel.invocar('curso:listar', undefined)
  } catch {
    // Sem a lista, os passos aparecem como pendentes — é o pior caso aceitável.
  }

  const temAreas = cursos.some((curso) => curso.areas.length > 0)

  return [
    {
      titulo: 'Cadastre o curso e a régua de notas',
      texto:
        'O curso guarda a quantidade de questões, os períodos, os componentes e a ' +
        'conversão de acertos em nota. É o que permite ler qualquer planilha.',
      caminho: '/admin/cursos',
      rotuloAcao: 'Cadastrar curso',
      concluido: estado.totalCursos > 0
    },
    {
      titulo: 'Importe a primeira planilha',
      texto:
        'Arraste o arquivo do Teste de Progresso e siga os quatro passos do assistente. ' +
        'As telas de acompanhamento passam a existir ao fim dele.',
      caminho: '/importacoes',
      rotuloAcao: 'Importar planilha',
      concluido: estado.possuiAplicacoes
    },
    {
      titulo: 'Agrupe os temas em áreas de conhecimento',
      texto:
        'A planilha traz um tema por questão. Reunir esses temas em áreas — Urgência, ' +
        'Gestão, Saúde Coletiva — é o que torna a tela de áreas legível.',
      caminho: '/admin/cursos',
      rotuloAcao: 'Definir áreas',
      concluido: temAreas
    },
    {
      titulo: 'Cadastre quem mais vai usar o painel',
      texto:
        'Cada pessoa recebe uma senha inicial, exibida uma única vez, e é obrigada a ' +
        'trocá-la no primeiro acesso.',
      caminho: '/admin/usuarios',
      rotuloAcao: 'Cadastrar usuários',
      concluido: false
    }
  ]
}

interface Funcionalidade {
  nome: string
  oQueFaz: string
  somenteAdmin?: boolean
}

interface GrupoFuncionalidades {
  titulo: string
  resumo: string
  itens: Funcionalidade[]
}

/**
 * Catálogo do que o painel faz.
 *
 * A jornada guiada mostra onde cada coisa está; esta lista existe para
 * consulta depois, quando a pergunta é "o programa faz tal coisa?". Por isso
 * descreve capacidade por capacidade, e não tela por tela.
 */
const FUNCIONALIDADES: GrupoFuncionalidades[] = [
  {
    titulo: 'Acompanhamento do desempenho',
    resumo:
      'Tudo aqui se refere ao curso e à aplicação escolhidos na barra superior, e é calculado ' +
      'na hora a partir dos acertos importados.',
    itens: [
      {
        nome: 'Indicadores da aplicação',
        oQueFaz:
          'Acerto médio, acertos em questões, nota pela régua do curso, discentes avaliados e ' +
          'quantidade de áreas abaixo de 50%, com a variação em relação à aplicação anterior.'
      },
      {
        nome: 'Série longitudinal por aplicação',
        oQueFaz:
          'Um ponto por aplicação importada, na ordem em que foram aplicadas. É o acompanhamento ' +
          'ao longo do curso que o projeto se propôs a construir.'
      },
      {
        nome: 'Comparação entre componentes',
        oQueFaz:
          'Separa conhecimento geral de conhecimento específico da Enfermagem, porque as duas ' +
          'partes da prova cobram coisas diferentes.'
      },
      {
        nome: 'Distribuição das notas',
        oQueFaz:
          'Quantos resultados caíram em cada nota da régua do curso — o que a média sozinha esconde.'
      },
      {
        nome: 'Destaques da aplicação',
        oQueFaz:
          'Áreas que se saíram acima do esperado e áreas que pedem atenção, apontadas a partir ' +
          'dos próprios dados importados.'
      },
      {
        nome: 'Comparação entre períodos',
        oQueFaz:
          'Como cada período se saiu na mesma prova e no mesmo dia, o que é o que torna a ' +
          'comparação entre eles legítima.'
      },
      {
        nome: 'Dispersão da turma por área',
        oQueFaz:
          'Do menor ao maior acerto individual, com a metade central da turma e a mediana ' +
          'marcadas. Mostra se a média representa a turma ou esconde desigualdade.'
      },
      {
        nome: 'Distribuição dos acertos na turma',
        oQueFaz: 'Quantos discentes do período caíram em cada faixa de acerto.'
      },
      {
        nome: 'Proporção acima do mínimo do período',
        oQueFaz:
          'Quantos discentes alcançaram o mínimo esperado para aquele período, conforme a régua ' +
          'cadastrada no curso.'
      },
      {
        nome: 'Ranking de áreas de conhecimento',
        oQueFaz:
          'Áreas ordenadas da pior para a melhor, com acerto atual, histórico, variação e situação.'
      },
      {
        nome: 'Matriz período × área',
        oQueFaz:
          'Cruza área e período numa mesma aplicação, com escala de cor fixa de 0% a 100% — ' +
          'cores parecidas significam desempenhos realmente parecidos.'
      },
      {
        nome: 'Evolução das áreas entre aplicações',
        oQueFaz: 'Acompanha cada área de conhecimento ao longo das aplicações já importadas.'
      },
      {
        nome: 'Comportamento de cada questão',
        oQueFaz:
          'Tema, gabarito, docente, componente, acerto geral e uma série com o acerto em cada ' +
          'período, destacando as questões que foram mal em todos eles.'
      },
      {
        nome: 'Filtros de questões',
        oQueFaz:
          'Reduz a lista por componente, por docente responsável e às questões abaixo de 50% em ' +
          'todos os períodos. Os três filtros se somam.'
      },
      {
        nome: 'Desempenho por docente responsável',
        oQueFaz:
          'Quantas questões cada docente assina, o acerto médio delas e as questões de melhor e ' +
          'pior desempenho.'
      },
      {
        nome: 'Ficha individual do discente',
        oQueFaz:
          'Trajetória da pessoa entre as aplicações, desempenho por área e comparação com a ' +
          'turma. É a única tela com nome real, e cada abertura fica registrada.'
      },
      {
        nome: 'Busca de discente',
        oQueFaz: 'Localiza a pessoa pelo nome completo ou pelo pseudônimo, como ENF-012.'
      }
    ]
  },
  {
    titulo: 'Entrada de dados',
    resumo:
      'Cada aplicação entra como um arquivo, e o histórico se forma pelo acúmulo das ' +
      'importações. Nada é gravado antes da confirmação.',
    itens: [
      {
        nome: 'Leitura da planilha do Teste de Progresso',
        oQueFaz:
          'Aceita o arquivo .xlsx exportado pelo curso, com uma aba por período, no formato em ' +
          'que ele já é produzido hoje.',
        somenteAdmin: true
      },
      {
        nome: 'Reconhecimento automático do conteúdo',
        oQueFaz:
          'Identifica as abas de desempenho, o período de cada uma, as questões, o gabarito, o ' +
          'tema e o docente responsável, e sugere tudo isso para sua conferência.',
        somenteAdmin: true
      },
      {
        nome: 'Conferência antes de gravar',
        oQueFaz:
          'A análise mostra o que o programa entendeu sem escrever nada no banco. Você confirma ' +
          'ou corrige antes de qualquer gravação.',
        somenteAdmin: true
      },
      {
        nome: 'Unificação de grafias de docente',
        oQueFaz:
          'Propõe juntar nomes que diferem por um caractere ou por acentuação, e espera sua ' +
          'decisão. Espaço sobrando é aparado sozinho; nome parecido, nunca.',
        somenteAdmin: true
      },
      {
        nome: 'Relatório de ocorrências',
        oQueFaz:
          'Lista o que precisa de atenção, separando o que impede a importação do que é apenas ' +
          'aviso ou informação.',
        somenteAdmin: true
      },
      {
        nome: 'Proteção contra importação repetida',
        oQueFaz:
          'A planilha é reconhecida pelo conteúdo, não pelo nome do arquivo. Para corrigir uma ' +
          'carga, marque a substituição da importação anterior.',
        somenteAdmin: true
      },
      {
        nome: 'Histórico de importações',
        oQueFaz:
          'Guarda cada carga com arquivo, responsável, quantidade de registros e todas as ' +
          'ocorrências — e permite excluir uma aplicação importada por engano.'
      }
    ]
  },
  {
    titulo: 'Administração',
    resumo: 'O que define como o painel lê a planilha e quem pode usá-lo.',
    itens: [
      {
        nome: 'Cadastro de curso',
        oQueFaz:
          'Nome, sigla, quantidade de questões, períodos avaliados e componentes da prova. É o ' +
          'que permite ler qualquer planilha do curso.',
        somenteAdmin: true
      },
      {
        nome: 'Régua de notas',
        oQueFaz:
          'Converte acertos em nota e define o mínimo esperado de cada período. Alterar a régua ' +
          'recalcula todos os painéis na hora, sem reimportar planilha.',
        somenteAdmin: true
      },
      {
        nome: 'Áreas de conhecimento',
        oQueFaz:
          'Agrupa os temas que vêm na planilha em áreas amplas, como Urgência ou Saúde ' +
          'Coletiva. É o que torna a tela de áreas legível.',
        somenteAdmin: true
      },
      {
        nome: 'Perfil de importação do curso',
        oQueFaz:
          'Guarda em que linha começa o cabeçalho e em que colunas estão questão, gabarito, ' +
          'tema, docente e respostas — para que a planilha não precise ser rearrumada à mão.',
        somenteAdmin: true
      },
      {
        nome: 'Cadastro de usuários',
        oQueFaz:
          'Cria o acesso com uma senha inicial exibida uma única vez, define o perfil e permite ' +
          'desativar quem saiu do projeto sem apagar o histórico.',
        somenteAdmin: true
      },
      {
        nome: 'Pedidos de redefinição de senha',
        oQueFaz:
          'Quem esqueceu a senha pede pela tela de entrada; o pedido aparece na lista de ' +
          'usuários para a administração gerar uma nova senha inicial.',
        somenteAdmin: true
      },
      {
        nome: 'Diagnóstico do sistema',
        oQueFaz:
          'Mostra a versão do programa e o arquivo onde os dados são gravados — o que informar ' +
          'ao suporte e o que copiar para fazer backup.'
      }
    ]
  },
  {
    titulo: 'Privacidade e segurança',
    resumo:
      'O painel trata dado pessoal de estudante, e essas regras valem em qualquer tela, para ' +
      'qualquer perfil.',
    itens: [
      {
        nome: 'Pseudônimo nas visões coletivas',
        oQueFaz:
          'Turma, áreas, questões e docentes identificam as pessoas por pseudônimo. O nome real ' +
          'não trafega para essas telas.'
      },
      {
        nome: 'Registro de acesso à ficha individual',
        oQueFaz:
          'Toda abertura de uma ficha com nome real fica registrada, com quem abriu e quando.'
      },
      {
        nome: 'Senha guardada apenas como hash',
        oQueFaz:
          'A senha não é armazenada nem recuperável, só conferida. Quem recebe uma senha inicial ' +
          'é obrigado a trocá-la no primeiro acesso.'
      },
      {
        nome: 'Aceite do termo de uso',
        oQueFaz:
          'O primeiro acesso registra a ciência das responsabilidades no tratamento dos dados ' +
          'dos discentes.'
      },
      {
        nome: 'Dados somente neste computador',
        oQueFaz:
          'Não há servidor nem nuvem: tudo é gravado em um arquivo na pasta de dados deste ' +
          'computador, mostrado na tela de diagnóstico.'
      }
    ]
  }
]

/** Chamada da jornada guiada: a primeira coisa que a tela oferece. */
function secaoJornada(estado: EstadoInicial): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const cartao = document.createElement('div')
  cartao.className = 'guia-jornada'

  const corpo = document.createElement('div')

  const titulo = document.createElement('h2')
  titulo.className = 'guia-jornada__titulo'
  titulo.textContent = 'Jornada guiada pelo painel'

  const texto = document.createElement('p')
  texto.className = 'guia-jornada__texto'
  texto.textContent =
    'Um passeio pelas telas reais, com os seus dados: cada passo abre a tela, acende o ' +
    'elemento de que fala e explica o que ele responde. Dá para sair a qualquer momento com ' +
    'Esc e retomar depois.'

  const nota = document.createElement('p')
  nota.className = 'guia-jornada__nota'
  nota.textContent = `${passosDaJornada(estado)} passos · cerca de 6 minutos · nada é alterado no caminho`

  corpo.append(titulo, texto, nota)

  const comecar = document.createElement('button')
  comecar.type = 'button'
  comecar.className = 'botao guia-jornada__botao'
  comecar.textContent = 'Começar a jornada'
  comecar.addEventListener('click', () => iniciarJornada(estado))

  cartao.append(corpo, comecar)
  secao.append(cartao)
  return secao
}

function secaoFuncionalidades(ehAdmin: boolean): HTMLElement {
  const secao = document.createElement('section')
  secao.className = 'secao'

  const titulo = document.createElement('h2')
  titulo.className = 'secao__titulo'
  titulo.textContent = 'Tudo que o painel faz'

  const descricao = document.createElement('p')
  descricao.className = 'secao__descricao'
  descricao.textContent =
    'A lista completa, por capacidade. Serve para conferir se o programa responde a uma ' +
    'pergunta antes de procurar a tela certa.'

  secao.append(titulo, descricao)

  for (const grupo of FUNCIONALIDADES) {
    const itens = grupo.itens.filter((item) => !item.somenteAdmin || ehAdmin)
    if (itens.length === 0) continue

    const bloco = document.createElement('div')
    bloco.className = 'cartao guia-grupo'

    const nome = document.createElement('h3')
    nome.className = 'guia-grupo__titulo'
    nome.textContent = grupo.titulo

    const resumo = document.createElement('p')
    resumo.className = 'guia-grupo__resumo'
    resumo.textContent = grupo.resumo

    const lista = document.createElement('ul')
    lista.className = 'guia-funcoes'

    for (const item of itens) {
      const linha = document.createElement('li')
      linha.className = 'guia-funcao'

      const rotulo = document.createElement('h4')
      rotulo.className = 'guia-funcao__nome'
      rotulo.textContent = item.nome

      const explicacao = document.createElement('p')
      explicacao.className = 'guia-funcao__texto'
      explicacao.textContent = item.oQueFaz

      linha.append(rotulo, explicacao)
      lista.append(linha)
    }

    bloco.append(nome, resumo, lista)
    secao.append(bloco)
  }

  return secao
}

export async function montarGuia(
  estado: EstadoInicial,
  aoConcluir: () => void
): Promise<HTMLElement> {
  const container = document.createElement('div')
  const ehAdmin = estado.sessao.perfil === 'administrador'

  container.append(cabecalho(), secaoJornada(estado))

  if (ehAdmin) container.append(secaoPrimeirosPassos(await primeirosPassos(estado)))

  container.append(
    secaoTelas(ehAdmin),
    secaoFuncionalidades(ehAdmin),
    secaoRegras(),
    secaoSuporte()
  )

  const rodape = document.createElement('div')
  rodape.className = 'guia-rodape'

  const nota = document.createElement('p')
  nota.textContent = 'Este guia fica sempre disponível no menu, em "Guia".'

  const repetir = document.createElement('button')
  repetir.type = 'button'
  repetir.className = 'botao botao--secundario'
  repetir.textContent = 'Repetir a jornada'
  repetir.addEventListener('click', () => iniciarJornada(estado))

  const ir = document.createElement('button')
  ir.type = 'button'
  ir.className = 'botao'
  ir.textContent = 'Entendi, ir para o painel'
  ir.addEventListener('click', aoConcluir)

  const botoes = document.createElement('div')
  botoes.className = 'guia-rodape__botoes'
  botoes.append(repetir, ir)

  rodape.append(nota, botoes)
  container.append(rodape)
  return container
}
