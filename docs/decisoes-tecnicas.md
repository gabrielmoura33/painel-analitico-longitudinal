# Decisões técnicas

Registro das decisões de projeto e dos desvios em relação ao que estava
previsto, com a justificativa de cada um.

## 1. Electron no lugar de React/web

**Decisão do grupo.** O documento executivo (seção 8.1) previa uma aplicação
web em React. A entrega passou a ser uma aplicação desktop em Electron.

Consequência favorável: elimina hospedagem, que estava como "a definir" no
documento e não tinha orçamento previsto. A aplicação roda offline, na máquina
da docente, sem custo recorrente.

## 2. Persistência: driver local como padrão, MongoDB como alternativa

O documento executivo especifica MongoDB como Data Warehouse/Data Mart. Exigir
um MongoDB instalado e em execução contraria a diretriz, do mesmo documento, de
"manutenção sem dependência de equipe técnica".

**Resolução:** a interface `Repositorio` (`src/main/db/repositorio.ts`) é única;
os drivers são intercambiáveis e a escolha vive em uma variável de ambiente.

- `local` — padrão. Banco de documentos embarcado, arquivo único, escrita
  atômica (gravação em arquivo temporário seguida de `rename`), transações por
  snapshot em memória.
- `mongo` — implementado (seção 14). É ele que atende ao desenho combinado
  com o departamento: interface em cada máquina, base única compartilhada.

Os dados são modelados em documentos, no formato que o MongoDB consumiria, para
que a troca de driver seja real e não apenas teórica.

### Por que não lowdb

O prompt sugeria `lowdb` ou equivalente leve. A versão atual do lowdb é
exclusivamente ESM, o que obrigaria o processo principal e o preload a adotarem
ESM — e o preload em ESM exige desligar o `sandbox` do Electron, enfraquecendo o
isolamento sem ganho correspondente.

Optou-se por um armazenamento próprio de ~110 linhas
(`src/main/db/armazenamento-json.ts`), que mantém o `sandbox` ligado, não
acrescenta dependência e dá controle direto sobre a transação de que a
importação de planilha vai depender. Coberto por testes.

## 3. Segurança da janela

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. O renderer
não enxerga `require`, `ipcRenderer` nem nada do Node: recebe apenas a função
`invocar`, exposta por `contextBridge`, e só consegue chamar canais que existam
no contrato tipado (`src/shared/types/ipc.ts`). Navegação para fora da aplicação
é bloqueada e links externos abrem no navegador do sistema.

## 4. TypeScript 7

A versão atual do TypeScript removeu `moduleResolution: node10` e `baseUrl`. A
configuração usa `module: preserve` com `moduleResolution: bundler` — adequado
porque quem emite o código final é o electron-vite, não o `tsc`, que roda apenas
como verificador de tipos.

## 5. Acesso e identidade (Fase 2)

### Sem credencial padrão de fábrica

A alternativa usual — nascer com `admin`/`admin` e pedir a troca depois — deixa
uma credencial conhecida valendo em toda instalação, e na prática ela quase
nunca é trocada. A instalação nova, em vez disso, abre na tela
**Primeiro acesso à instalação**, que cria o administrador com senha própria.
Enquanto não houver nenhum usuário, nenhuma outra tela é acessível.

### Recuperação de senha sem e-mail

O formulário de cadastro aprovado pelas parceiras não coleta e-mail, o que
torna impossível o fluxo clássico de link de redefinição. O pedido feito na
tela de login vira pendência na lista de usuários, e o administrador gera uma
nova senha inicial. A resposta ao usuário é sempre a mesma, exista o login ou
não, para não revelar quais logins estão cadastrados.

A alternativa seria acrescentar e-mail institucional ao cadastro — o que exige
alterar uma tela já validada. Fica registrado como decisão a rever com as
parceiras.

### Senhas e sessão

- Hash com bcrypt, custo 10. O hash nunca trafega para a interface: a listagem
  de usuários devolve um resumo sem hash e sem CPF.
- Senha inicial de 10 caracteres, sem caracteres ambíguos (`O`/`0`, `l`/`1`),
  porque costuma ser ditada ou copiada à mão. Exibida uma única vez.
- Mensagem de erro idêntica para login inexistente e senha errada.
- Bloqueio de 60 segundos após cinco tentativas falhas, por login.
- "Manter conectado" guarda uma sessão de 30 dias no banco local. Redefinir a
  senha ou desativar o usuário derruba essa sessão na hora.

### Controle de perfil

A verificação acontece no processo principal, em `registrarProtegido`, antes de
o handler rodar. O renderer esconde os menus de administração de quem é
professor, mas isso é apenas cortesia visual: um canal administrativo chamado
por um professor é recusado no main. Há teste automatizado e verificação de
ponta a ponta para isso.

Duas proteções impedem que a instalação fique sem quem a administre: ninguém
desativa nem rebaixa o próprio usuário, e o último administrador ativo não pode
ser desativado nem rebaixado.

### Correção encontrada pela verificação ponta a ponta

O bloqueio de navegação criado na Fase 1 impedia qualquer `will-navigate`,
inclusive `location.reload()` — o que quebrava o item "Recarregar" do menu
nativo no aplicativo empacotado. A regra passou a comparar protocolo, host e
caminho: recarregar a própria interface é permitido, qualquer outro destino
continua bloqueado.

## 6. Régua de notas e leitura de planilha (Fase 3)

### O piso da nota: o que a planilha mostrou

A implementação inicial seguia o PDF de critérios ao pé da letra e atribuía
**0** a quem ficasse abaixo do percentual mínimo. O teste que confere a fórmula
contra a aba "Nota TP à partir dos %" reprovou essa leitura.

A aba usa **células mescladas**: em cada coluna de período, uma única célula
cobre toda a faixa de acertos que recebe aquela nota. A primeira faixa do 6º
período, por exemplo, vai de 1 a 17 acertos e vale 5. Ou seja, na planilha que
as docentes usam de fato, **ninguém que fez a prova recebe zero**: a nota base
é o piso.

O PDF é mais restritivo ("5 pontos … e obtiverem pelo menos 50%"). A plataforma
reproduz a planilha, porque é o artefato operante, e a divergência fica
registrada aqui para confirmação com as parceiras.

Com o piso corrigido, a fórmula reproduz as **175 comparações** da aba — 35
linhas de acertos nos cinco períodos — sem exceção.

### A dedução da régua é ambígua, e isso é dito

"Importar régua da planilha" não adivinha. Se os pares (percentual, nota) lidos
não incluírem nenhum valor abaixo do mínimo, deslocar nota base e percentual
mínimo juntos produz exatamente as mesmas notas: várias configurações explicam
os mesmos dados. A função devolve todos os candidatos marcados como ambíguos, a
tela mostra isso, e nada é aplicado sem confirmação. Na planilha real a
ambiguidade não aparece, porque as células mescladas registram a nota base
desde o primeiro acerto.

O percentual mínimo é procurado só em múltiplos de dez, que é como a régua do
instrumento é escrita.

### Colunas de resumo não são discentes

A verificação ponta a ponta mostrou 40 discentes no 6º período, onde há 38. As
duas sobras eram as colunas "TOTAL DE ACERTOS" e "% DE ACERTOS", que vêm logo
depois da última pessoa e estavam sendo lidas como nomes — o que inflaria a
contagem de registros de desempenho em 70 por período. A leitura agora para na
primeira coluna cujo cabeçalho é de resumo e avisa que parou ali.

### Pré-visualização não importa nada

A aba de mapeamento abre um arquivo real e mostra o que seria lido — questões,
gabaritos, temas, docentes, discentes e o total de registros que seriam
gerados. Nenhuma escrita acontece. É a forma de a docente conferir o perfil
antes de a importação existir.

## 7. Importação de planilhas (Fase 4)

### Análise e carga são passos separados

`analisar` lê, reconhece e valida sem escrever nada; `importar` só age sobre
decisões que a docente confirmou na tela. A carga roda inteira dentro de uma
transação do repositório: uma falha no meio não deixa meia turma gravada.

### O que é automático e o que exige confirmação

Aparar espaço sobrando é automático, porque não muda o que está escrito.
Unificar grafias diferentes — `NInon`/`Ninon`, `Ângela`/`Angela` — exige
confirmação, porque é decisão sobre significado. Por isso a amostra produz
apenas **duas** propostas de unificação, e não quatro: `Mônica `/`Mônica` e
` 8 Juliana`/`8 Juliana` diferem só em espaço e são resolvidas sozinhas.

O agrupamento compara ignorando caixa, acento e espaço. `Diagósticos` e
`Diagnósticos` continuam separados: unir os dois é decisão de quem conhece o
instrumento, não do programa.

### Reimportação

O arquivo é identificado pelo hash SHA-256 do conteúdo, e a aplicação também
pelo par curso + rótulo. Enviar a mesma planilha de novo é bloqueado; a saída
é marcar "substituir a importação anterior", que apaga a anterior e grava a
nova na mesma transação.

### Discente em mais de um período

A amostra de 2025/2 tem 181 linhas de discente somadas as cinco abas, mas 178
pessoas distintas: três aparecem em dois períodos da mesma aplicação. Isso
pode ser homônimo ou repetição, e o programa não tem como saber. Os dois
resultados são importados e o caso vira ocorrência de atenção, com os nomes
das abas envolvidas.

Para a média do resumo, cada par discente + período conta como um resultado —
do contrário, o segundo período apagaria o primeiro.

### Percentual e nota não são gravados

A coleção de fatos guarda só `acerto`. Percentual, nota e qualquer indicador
são derivados na consulta, como o documento executivo prevê ao falar em
indicadores calculados por agregação. Eles aparecem no relatório da importação
porque a docente precisa conferir o resultado na hora.

### Arrastar o arquivo, e por que isso importou

A dropzone aceita arrastar a planilha ou escolher por um campo de arquivo. O
caminho real vem de `webUtils.getPathForFile`, exposto pelo preload —
`File.path` não existe mais no Electron.

A verificação ponta a ponta ajudou a chegar aqui: o roteiro tentava substituir
`window.painel` para simular a escolha do arquivo e falhava com
`Cannot redefine property: painel`. O `contextBridge` define a ponte como não
configurável, de propósito. Em vez de burlar a proteção, o teste passou a usar
o mesmo caminho de uma pessoa — o campo de arquivo da dropzone —, o que exigiu
implementar o arrastar-e-soltar que o escopo já pedia e eu não tinha feito.

## 8. Indicadores (Fase 5)

### Nada é gravado pronto

A coleção de fatos guarda apenas `acerto`. Percentual, nota, médias, quartis e
variações são calculados na consulta, a partir do modelo canônico e da régua
cadastrada no curso — como o documento executivo prevê ao falar em indicadores
derivados por agregação. Trocar a régua de um curso muda os painéis na hora,
sem reimportar nada.

### Conferência contra o diagnóstico do próprio grupo

O documento executivo apurou, na amostra de 2026/1: acerto médio de 63%, e
81,8% no Componente Geral contra 58,3% no Específico. A plataforma, importando
a mesma planilha e calculando do zero, chega a **63,6%** e **81,9% × 58,2%**.
A diferença é de arredondamento. É a validação mais forte que o pipeline tem.

### A granularidade de "área de conhecimento"

A coluna *Tema* da planilha é **por questão**: as 35 questões têm 35 temas
distintos. Agrupar por tema, portanto, produz 35 "áreas" de uma questão cada —
não as faixas amplas que o `Consolidado TI.docx` pede ("Saúde do adulto",
"Urgência", "Gestão", "Saúde Coletiva").

Consequências imediatas: a tabela de áreas da visão geral é, na prática, uma
tabela de questões; e a dispersão por área fica binária, porque com uma questão
só cada discente acerta tudo ou nada.

O agrupamento que as parceiras descrevem **não existe na fonte**. Para
atendê-lo é preciso um mapeamento tema → área, que só elas podem fornecer. A
proposta é tratá-lo como configuração do curso, na mesma tela de Cursos e
réguas, mantendo a plataforma independente de curso. Fica registrado como
pendência antes da Fase 6, que depende desse agrupamento.

### Quem zerou a prova

A amostra tem discentes com zero acertos. Pela régua, eles recebem a nota base
do período — ENF-011 tirou 5 com 0/35. Pode ser ausência registrada como coluna
vazia, e não desempenho nulo. A importação agora sinaliza esses casos como
ocorrência de atenção, com os nomes, para a docente decidir antes de importar.
A plataforma não presume ausência: a coluna existe, então o registro existe.

### Pseudonimização nas visões coletivas

A visão de turma devolve apenas pseudônimos: o nome real não aparece em nenhum
campo do que o processo principal envia à interface. Há teste automatizado que
procura nomes da amostra no JSON inteiro da visão e exige que não existam.

## 9. Áreas de conhecimento e telas longitudinais (Fase 6)

### O agrupamento virou cadastro

A Fase 5 mostrou que a coluna *Tema* da planilha é por questão: 35 questões,
35 temas. As faixas amplas que o `Consolidado TI.docx` pede — Urgência, Saúde
Coletiva, Gestão — não existem na fonte; são conhecimento das docentes sobre o
instrumento.

A saída foi tratá-las como configuração do curso, em `Curso.areas`, com uma
aba própria no editor. A docente cria as áreas e atribui cada tema importado a
uma delas; os temas que sobram aparecem reunidos como "Sem área definida".
Enquanto nada for cadastrado, as telas avisam que cada linha é uma questão, e
não uma faixa de conteúdo — em vez de deixar a palavra "área" enganar quem lê.

A plataforma continua independente de curso: outro curso cadastra as próprias
áreas, e nada disso está no código.

### Mais dois erros de digitação na origem

A verificação dos docentes acusou 70 questões onde há 35. Duas causas, ambas
na planilha:

1. Em algumas abas o docente vem com o número da questão colado no nome —
   `"1 NInon"` no lugar de `"NInon"`. O agrupamento passou a ignorar um número
   no início do texto.
2. A questão 12 tem o docente escrito **"Angea"** em três abas e "Angela" nas
   outras duas. Falta um "l". O agrupamento passou a propor também junções de
   textos que diferem por uma única edição, com tamanho mínimo de cinco
   caracteres para não aproximar nomes curtos por acaso.

As duas continuam sendo **propostas**: nada é unificado sem confirmação. O que
mudou é que agora elas aparecem para a docente decidir, em vez de passarem
despercebidas e inflarem a lista de docentes. Como o número de propostas
cresceu, o assistente ganhou um "marcar todas".

### Acesso à ficha individual

A ficha do discente é a única tela com nome real. Cada abertura é registrada
no log da aplicação, com o identificador de quem abriu e o horário.

### A escala de cor da matriz é absoluta

O heatmap vai de 0% a 100%, não do menor ao maior valor observado. Com os
dados da amostra, em que tudo fica entre 56% e 74%, as células saem parecidas.
É proposital: uma escala relativa faria diferenças de dois pontos parecerem
enormes.

## 10. Pendências de regra de negócio

1. **Divergência entre o PDF e a planilha.** O PDF concede a nota base só a
   quem atinge o percentual mínimo; a planilha concede a todos que fizeram a
   prova. A plataforma segue a planilha. A confirmar com as parceiras.
2. **Quem não fez a prova.** Ausência de registro, não nota zero. Nenhum caso
   assim aparece na amostra.
3. **Agrupamento de temas em áreas de conhecimento.** Resolvido. É
   configuração do curso (seção 9) e passou a ser importável da planilha que a
   professora Meire mantém (seção 14).
4. **Discente com zero acertos.** Ausência na prova ou desempenho nulo? Muda a
   nota e as médias.
5. **Critério das duas horas de dedicação.** O PDF condiciona a pontuação a um
   mínimo de duas horas de elaboração. Esse dado não existe na planilha e,
   portanto, não entra no cálculo.

## 11. Limitação da fonte de dados

A planilha registra apenas se o discente acertou a questão — nunca a alternativa
que ele marcou. O requisito "distribuição das alternativas escolhidas", do
`Consolidado TI.docx`, **não é calculável** com a fonte atual. A tela de questões
deve exibir a indisponibilidade de forma explícita, em vez de omiti-la.

## 12. Guia de uso (primeiro acesso)

Quem opera o painel depois do fim da disciplina são as docentes, e o quarto
objetivo específico do projeto prevê capacitá-las. Uma oficina de encerramento
não se repete para quem entrar depois, então o roteiro precisa morar dentro do
programa.

A tela `/guia` reúne três coisas que estavam espalhadas: a ordem de
configuração de uma instalação nova, o que cada tela responde e como lê-la, e
as garantias que explicam a maior parte das dúvidas de uso — nada é gravado
antes da confirmação, grafia parecida nunca é unificada sozinha, a mesma
planilha não entra duas vezes, nenhum indicador fica gravado pronto, e o nome
real aparece em uma tela só.

### Os passos mostram o estado real da instalação

"Cadastre o curso" e "importe a primeira planilha" aparecem marcados como
feitos a partir de `sistema:estado-inicial`; "agrupe os temas em áreas" é
conferido em `curso:listar`. A lista só existe para o administrador, porque é
quem pode executar cada passo.

### Onde fica a marca de "já vi"

É preferência de interface, não dado do painel: vai para o `localStorage` do
renderer, por usuário, e não para o banco. Isso evita um campo novo em
`Usuario`, uma migração e um canal de IPC para algo que, no pior caso, faz o
guia abrir uma vez a mais. Se o armazenamento estiver indisponível, o guia
deixa de abrir sozinho — insistir a cada execução seria pior do que não abrir.

## 13. Jornada guiada (onboarding)

O guia escrito diz o que existe; ele não mostra onde está. Para quem abre o
painel pela primeira vez, as duas coisas são necessárias — e a segunda é a que
não se resolve com texto. A jornada guiada percorre as telas reais, uma a uma,
acendendo o elemento de que fala.

### Sobre as telas reais, com os dados reais

Nenhum passo usa dado de exemplo: a jornada navega para a rota, espera a tela
se preencher e destaca o elemento. Isso evita o problema clássico do tutorial
com captura de tela, que envelhece junto com a interface, e tem um efeito
colateral útil — quem termina a jornada já viu o próprio painel.

A camada (`componentes/tour.ts`) vive em `document.body`, não dentro de
`#raiz`, porque cada passo troca a rota e o roteador redesenha a raiz inteira.
Ela bloqueia cliques enquanto está no ar: a jornada explica a tela, não opera
por ela.

### Por que o roteiro mora em `shared`

`shared/jornada.ts` guarda o roteiro como dado puro, sem nada de interface.
Cada passo aponta para um elemento por `data-tour`, e um atributo renomeado não
quebraria compilação nem teste de tela — deixaria o passo silenciosamente sem
destaque. Com o roteiro em `shared`, `tests/jornada.test.ts` confere, fora da
interface, que todo `data-tour` citado é realmente marcado no arquivo da tela
daquela rota.

### O roteiro encurta conforme quem olha

Passos de importação, cursos e usuários só existem para administrador; passos
das telas analíticas só existem se já houver aplicação importada. O filtro roda
antes de numerar, para que "passo 7 de 21" seja verdade para aquela pessoa.

### Quando ela abre

No primeiro acesso de cada pessoa, logo depois do guia, uma vez. A marca é uma
chave própria no `localStorage` (`painel:jornada-vista:`), separada da marca do
guia da seção 12, para que quem já tinha visto o guia escrito antes de a jornada
existir receba a jornada uma vez — em vez de nunca. Depois disso, pelo botão
"Começar a jornada", no alto do guia. Sair é com Esc, e as setas do teclado
avançam e voltam.

### Catálogo de funcionalidades

O guia ganhou também a lista completa do que o painel faz, por capacidade e não
por tela, agrupada em acompanhamento, entrada de dados, administração e
privacidade. Ela responde a pergunta que a jornada não responde depois de
terminada: "o programa dá conta disso?".

## 14. Ajustes pedidos na reunião com as docentes (novembro de 2026)

A reunião com as professoras do curso de Enfermagem trouxe cinco mudanças de
produto e cobrou duas coisas que o painel afirmava fazer e não fazia. Esta
seção registra as sete.

### "Nota" era promessa que a planilha não sustenta

A professora Meire foi direta: a planilha traz **total de acertos**, nunca
nota, porque a nota tem peso diferente por período e é calculada fora dali.
O painel exibia "Nota média" e "Distribuição das notas" como se fossem dado
importado.

A nota continua existindo — ela é útil, e a régua do curso a produz —, mas
passou a aparecer sempre rotulada como cálculo: "Nota média pela régua",
"Nota (régua)", "Distribuição das notas calculadas". O que ocupa o lugar de
indicador primário é o acerto: "Total de acertos", "% de acerto".

Trocar o rótulo custa pouco; deixá-lo como estava custava a confiança de quem
lê o painel sabendo de onde o número veio.

### A planilha de áreas entra de uma vez

A seção 9 resolveu o agrupamento de temas como cadastro do curso. Acontece que
são dezenas de temas por aplicação, repetidos a cada semestre, e a professora
Meire já fez esse mapeamento à mão, numa planilha própria. Digitar o trabalho
dela de novo, tema a tema, não é cadastro: é retrabalho.

`etl/areas.ts` procura em cada aba um par de colunas de tema e de área — aceita
"assunto" e "eixo" como sinônimos — e `shared/areas.ts` funde o resultado com
o que já estava cadastrado. Três regras:

1. **A planilha manda.** Um tema que ela atribui sai de onde estivesse.
2. **O que ela não menciona fica como está.** Importar o mapeamento de uma
   aplicação não desfaz o trabalho feito para as outras.
3. **Prevalece a grafia da importação.** O tema da planilha de áreas casa por
   comparação sem acento e sem caixa, mas o texto exibido é o que veio do Teste
   de Progresso — divergir criaria dois temas onde há um.

A tela relata o que mudou e o que não bateu: áreas criadas, temas movidos,
temas da planilha que nenhuma importação trouxe (quase sempre grafia diferente)
e temas importados que continuaram sem área. Nada é gravado até salvar o curso.

A IA de que se falou na reunião fica **fora** da aplicação: ela ajuda a
preparar a planilha, e o que o painel importa é o resultado conferido por
alguém.

### Matrícula: a única chave que distingue homônimos

O reencontro entre semestres — o que sustenta a série longitudinal inteira —
era feito pelo nome normalizado. Nome não distingue homônimos e muda de grafia;
a coordenação concordou em passar a incluir o código de matrícula na planilha.

Como os discentes são **colunas**, a matrícula não é mais uma coluna: é uma
linha a mais no cabeçalho, uma célula sob o nome de cada pessoa. O perfil de
importação ganhou `linhaMatricula`, opcional.

A ordem de busca passou a ser matrícula, depois nome. E o nome só vale como
reserva quando não há duas matrículas a contradizê-lo: dois homônimos com
matrículas diferentes são duas pessoas. Essa ressalva não estava na primeira
versão, e um teste a encontrou — sem ela, a trajetória de uma se somaria à da
outra.

Quem já estava cadastrado sem matrícula recebe a dela na importação seguinte,
pelo nome. As planilhas antigas continuam entrando sem matrícula nenhuma, e o
resumo da importação diz quantos vieram assim.

### Departamento, campus e três perfis

O desenho que as docentes descreveram tem três níveis: a chefia do
departamento, a coordenação de cada campus (Coração Eucarístico, Betim e, no
futuro, Poços de Caldas) e os professores, que acompanham sem alterar nada.
Havia dois perfis, e todo usuário via todos os cursos.

- `Curso` ganhou `campus` e `departamento`.
- `PerfilUsuario` ganhou `coordenador`, que importa planilha mas não cadastra
  curso nem usuário.
- `Usuario` ganhou `cursosPermitidos`. Lista vazia significa todos — é o estado
  do administrador e o de uma instalação com um curso só.

O recorte é imposto no processo principal, não no menu: `curso:listar` devolve
só o que a pessoa alcança, cada canal de painel recusa um curso fora do escopo,
e `aplicacao:listar`, que era canal aberto, passou a exigir sessão.

As regras moram em `shared/acesso.ts`, inclusive a tabela de perfis por área,
para que o menu do renderer e a autorização do main não possam divergir.

> **Pendente de decisão do colegiado.** A professora Patrícia levará à reunião
> se todos os professores veem os dados ou apenas a coordenação e o NDE. A
> estrutura está pronta para as duas respostas: muda o escopo cadastrado, não
> o código.

### Expansão para outros cursos

Fica preparada, não implementada, como as docentes pediram. O painel já era
agnóstico de curso — estrutura, régua, componentes e perfil de importação são
cadastro —, e `campus`/`departamento` completam o que faltava.

Registre-se o que a professora Meire deixou explícito: **não há comparação
entre cursos diferentes**, porque as provas são diferentes. A comparação existe
entre campi que aplicam o mesmo instrumento.

### O MongoDB existia só como assinatura

Esta é a divergência mais séria entre o que foi apresentado na reunião e o que
o código fazia. Disse-se às docentes que os dados ficam numa base MongoDB e que
liberar um acesso o libera para a pessoa em qualquer máquina. O driver
`mongo.ts` lançava `'Driver MongoDB ainda não implementado'` e toda instalação
caía no arquivo local — ou seja, cada máquina tinha a própria base, e um
usuário cadastrado numa não existia na outra.

O driver está implementado. Três decisões:

1. **`_id` continua string nossa**, e não `ObjectId`, para que os dois drivers
   produzam documentos idênticos e uma base gerada no local possa ser carregada
   no Mongo.
2. **A transação é tentada, não presumida.** Ela só existe em conjunto de
   réplicas — o Atlas é um, um `mongod` avulso não. Onde não houver, a operação
   roda assim mesmo e o aviso vai para o log: recusar a importação seria pior
   do que executá-la sem a garantia.
3. **`descricaoLocalDados` nunca devolve a URL inteira**, que carrega usuário e
   senha do banco.

Índices são criados na conexão, sobre os campos que todas as telas consultam.

### A criptografia também não existia

Afirmou-se na reunião que todo dado sensível é cifrado antes de ir para a base.
Havia apenas bcrypt para senha; nome, CPF e data de nascimento iam em claro.

`db/cripto.ts` e `db/criptografado.ts` cifram na fronteira do repositório, com
AES-256-GCM, embrulhando os dois drivers: cifrar campo sensível é regra do
sistema, não de um driver, e nenhum serviço precisa lembrar de fazê-lo.

Cifrados: `usuarios.nomeCompleto`, `cpf`, `dataNascimento` e
`discentes.nomeCompleto`, `matricula`. O desempenho não é cifrado — acerto por
questão, sozinho, não identifica ninguém, e cifrá-lo inviabilizaria as
consultas que sustentam os painéis. O pseudônimo também fica em claro: é ele
que as telas coletivas mostram.

**Dois modos.** `aleatorio` sorteia um IV a cada gravação, de modo que o mesmo
nome gravado duas vezes produz textos diferentes. Mas então não se pode buscar
por igualdade — e o cadastro precisa perguntar "já existe alguém com este
CPF?". Para esse caso existe o `determinista`, cujo IV deriva do próprio valor:
permite a busca ao custo de revelar que dois registros têm o mesmo CPF, que ali
já é o propósito da consulta. Filtrar por um campo de IV aleatório levanta erro,
em vez de devolver lista vazia e esconder o engano.

**A chave.** `PAINEL_CHAVE_DADOS` (32 bytes, hexadecimal ou base64) tem
precedência, e é o caminho obrigatório quando a base é compartilhada: todas as
instalações precisam da mesma chave, ou uma não lê o que a outra gravou. Sem a
variável, a chave é gerada e guardada ao lado do banco local, com permissão
restrita — serve à instalação de máquina única. O diagnóstico do sistema diz
qual dos dois está em uso, para que ninguém suponha o contrário.

**Documento em claro atravessa intacto.** É o que foi gravado antes de o cofre
existir, e continua legível: a criptografia entra sem migração. Chave trocada
não derruba a tela — o campo volta cifrado, o resto do painel continua
utilizável.

Isto protege os dados **em repouso**. Não substitui o controle de acesso nem o
que a infraestrutura da PUC fizer em volta do servidor; é a camada que cabe à
aplicação.
