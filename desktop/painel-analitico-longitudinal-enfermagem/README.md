# Painel Analítico Longitudinal

Aplicação desktop que transforma as planilhas do Teste de Progresso em painéis de
acompanhamento do desempenho acadêmico — individual, por turma, por área de
conhecimento e por questão.

Projeto de extensão da unidade curricular *Projeto: Aplicações para
Sustentabilidade* — Bacharelado em Sistemas de Informação EAD, PUC Minas.
Parceria com o curso de Enfermagem (Patrícia Sarsur e Renata Lacerda).

## Situação atual: Fase 6 concluída

Todas as telas analíticas previstas estão no ar. Falta a Fase 7: exportações,
menu nativo completo e empacotamento dos instaladores. A ordem das fases está
em [`PROMPT-CLAUDE-CODE.md`](PROMPT-CLAUDE-CODE.md).

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Fundação: Electron, build, IPC tipado, repositório, navegação | **Concluída** |
| 2 | Acesso: login, primeiro acesso, usuários | **Concluída** |
| 3 | Configuração: cursos, régua de notas, mapeamento de colunas | **Concluída** |
| 4 | Importação: ETL completo e assistente de 4 passos | **Concluída** |
| 5 | Visão geral e visão de turma | **Concluída** |
| 6 | Discente, áreas, questões, docentes | **Concluída** |
| 7 | Exportações, menu nativo e empacotamento | pendente |

Além das fases, os ajustes pedidos na reunião com as docentes de Enfermagem
estão aplicados: rótulos de acerto no lugar de nota, importação da planilha de
áreas, código de matrícula, departamento/campus e três perfis de acesso, driver
MongoDB e criptografia dos campos sensíveis. A seção 14 de
[`docs/decisoes-tecnicas.md`](docs/decisoes-tecnicas.md) registra cada um.

## Primeira execução

Não existe usuário nem senha padrão de fábrica. Na primeira vez que o
aplicativo abre, ele pede a criação do administrador que vai gerenciar o
painel: nome, CPF, data de nascimento, login e senha.

A partir daí, o administrador cadastra os demais usuários. Cada usuário novo
recebe uma **senha inicial gerada pelo sistema**, exibida uma única vez na tela
para entrega pelo canal institucional; no primeiro acesso, essa pessoa é
obrigada a trocar a senha e aceitar o termo de tratamento de dados.

### Esqueci a senha

O cadastro não coleta e-mail, então não há envio de link. O usuário pede a
redefinição pela tela de login; o pedido aparece como aviso na lista de
usuários, e o administrador gera uma nova senha inicial pela ação
**Redefinir senha**.

## Como executar

```bash
npm install     # na primeira vez
npm run dev     # abre a aplicação em modo de desenvolvimento
```

Outros comandos:

```bash
npm run build       # verificação de tipos + empacotamento dos três processos
npm test            # testes automatizados
npm run start       # executa a versão já construída
npm run empacotar:mac   # gera o instalador .dmg
npm run empacotar:win   # gera o instalador .exe
```

## Onde ficam os dados

Há dois modos. Por padrão a aplicação grava tudo em um arquivo único na pasta
de dados do usuário — sem servidor, sem banco instalado e sem conexão com a
internet. No modo compartilhado, os dados vão para uma base MongoDB comum a
todas as instalações. O modo em uso aparece na tela **Diagnóstico do sistema**,
dentro do aplicativo.

Em qualquer um dos dois, os campos sensíveis — nome, CPF e data de nascimento
do usuário, nome e matrícula do discente — são **cifrados pela aplicação antes
de chegar ao banco**.

| Sistema | Pasta |
|---|---|
| macOS | `~/Library/Application Support/painel-analitico-longitudinal/` |
| Windows | `%APPDATA%\painel-analitico-longitudinal\` |

Para fazer cópia de segurança, basta copiar o arquivo `painel-analitico.json`.

### Base compartilhada (MongoDB)

É o modo do departamento: a interface roda em cada máquina e os dados ficam
numa base só, de modo que um acesso liberado vale em qualquer estação. A
interface de persistência é a mesma para os dois drivers; a escolha é feita por
variável de ambiente:

```bash
PAINEL_DRIVER=mongo PAINEL_MONGO_URL="mongodb://usuario:senha@servidor:27017" PAINEL_CHAVE_DADOS="<chave>" npm run dev
```

`PAINEL_CHAVE_DADOS` é a chave de 32 bytes que cifra os campos sensíveis, e
precisa ser **a mesma em todas as instalações** — sem ela, cada máquina gera a
própria e não lê o que a outra gravou. Gere com `openssl rand -base64 32`.

Os requisitos de servidor, as variáveis e o que cabe à infraestrutura estão em
[`docs/implantacao.md`](docs/implantacao.md).

## Estrutura do código

```
src/
  main/        processo principal: janela, menu, IPC, persistência, ETL (futuro)
  preload/     ponte segura entre interface e processo principal
  renderer/    interface: telas, componentes e estilos
  shared/      tipos e constantes usados pelos dois lados
tests/         testes automatizados
docs/          documentação técnica do projeto
```

## Como aderir um novo curso

Nenhuma etapa abaixo exige alteração no programa. Tudo é cadastro, em
**Administração › Cursos e réguas › Novo curso**.

1. **Identificação** — nome, sigla, instituição, departamento, campus e como a
   avaliação é chamada no curso (ex.: "Teste de Progresso"). Departamento e
   campus são o que permite o mesmo curso existir no Coração Eucarístico e em
   Betim, cada um com a sua coordenação.
2. **Estrutura** — quantas questões a prova tem, quais períodos respondem à
   mesma prova e quais componentes agrupam as questões (ex.: questões 1 a 8 =
   Componente Geral).
3. **Régua de notas** — a nota base e o percentual mínimo de cada período. O
   botão **Importar régua da planilha** lê a aba de conversão de um arquivo
   existente e mostra o que deduziu antes de aplicar. O campo **Testar um
   percentual** mostra na hora a nota que cada período receberia.
4. **Mapeamento de colunas** — em que linha estão os nomes dos discentes, em
   quais colunas estão questão, gabarito, tema e docente, onde começa a faixa
   de alunos e qual valor marca um acerto. Há também a **linha da matrícula**,
   opcional: como os discentes são colunas, o código de matrícula é uma linha,
   a célula sob o nome de cada pessoa. É ele que distingue homônimos e
   reencontra a mesma pessoa entre semestres; em branco, o reencontro continua
   pelo nome. O botão **Escolher planilha e conferir** abre um arquivo real e
   mostra o que seria lido, **sem importar nada**.
5. **Áreas de conhecimento** — agrupam os temas da planilha em faixas amplas
   (Atenção Primária, Urgência, Saúde Mental). Podem ser digitadas ou
   importadas de uma planilha com as colunas *tema* e *área*, pelo botão
   **Importar planilha de áreas**.

Se a conferência mostrar o número certo de questões e de discentes, o perfil
está correto e o curso pode receber importações.

## Como importar uma planilha

Em **Importações**, o assistente tem quatro passos. Os três primeiros não
gravam nada.

1. **Arquivo** — arraste a planilha para a área indicada ou clique para
   escolher. Informe o curso e a aplicação (ano/semestre, como `2025/2`).
2. **Reconhecimento** — o sistema diz o que entendeu de cada aba e qual
   período deduziu. É sugestão: corrija o período e desmarque o que não deve
   entrar. Abas de gabarito, de régua e abas derivadas ficam de fora
   automaticamente, com o motivo à vista.
3. **Validação** — as ocorrências aparecem em três níveis. As **bloqueantes**
   impedem o avanço e dizem o porquê. As **de atenção** pedem uma decisão sua,
   como unificar grafias diferentes do mesmo docente. As **informativas** só
   registram o que foi feito.
4. **Confirmação** — o resumo do que será gravado, a régua que será aplicada e
   o botão de importar. A partir daqui a escrita acontece dentro de uma
   transação: ou a aplicação entra inteira, ou nada entra.

Ao final, o relatório da importação fica guardado no **Histórico**, com todas
as ocorrências.

### Se a mesma planilha for enviada duas vezes

O sistema reconhece o arquivo pelo conteúdo e bloqueia a repetição. Para
corrigir uma importação, marque **substituir a importação anterior**: a antiga
é apagada e a nova entra no lugar, sem duplicar registros.

### Como a nota é calculada

Quem alcança o percentual mínimo do seu período recebe a nota base; cada faixa
de dez pontos percentuais acima disso vale mais um ponto, até 10. Abaixo do
mínimo, a nota é a própria nota base — é assim que a planilha das docentes
converte hoje. A régua padrão sugerida é a do Teste de Progresso de Enfermagem:

| Período | Nota base | % mínimo |
|---|---|---|
| 6º | 5 | 50% |
| 7º | 4 | 40% |
| 8º | 3 | 30% |
| 9º | 2 | 20% |
| 10º | 1 | 10% |

## O que os painéis mostram

Em **Visão geral**, os indicadores da aplicação escolhida no filtro da barra
superior: acerto médio, acertos médios sobre o total, nota média pela régua do
curso, discentes avaliados e quantas áreas estão abaixo de 50%. Abaixo, o
acerto por componente, a série por aplicação, o acerto por período, a
distribuição das notas, os destaques calculados e a tabela de áreas ordenada da
pior para a melhor.

Em **Análises › Turma**, o retrato de um período: distribuição dos acertos,
comparação com os outros períodos, a dispersão da turma em cada área e a
listagem dos discentes — sempre por pseudônimo.

Em **Análises › Discente**, a trajetória de uma pessoa ao longo das aplicações,
com a média da turma como referência, os pontos de atenção e a evolução por
área. É a única tela que mostra o nome real.

Em **Análises › Áreas**, o ranking das áreas, a matriz período × área e a
evolução das mais críticas. Em **Questões**, o comportamento de cada questão
com o acerto por período e a marcação das que ficaram abaixo de 50% em todos
eles. Em **Docentes**, a calibragem das questões por autoria.

### Agrupar os temas em áreas de conhecimento

A planilha traz **um tema por questão** — 35 questões, 35 temas. As faixas
amplas que organizam o curso (Urgência, Saúde Coletiva, Gestão) são
conhecimento das docentes, não dado da planilha. Por isso o agrupamento é
cadastro, em **Administração › Cursos e réguas › Áreas de conhecimento**:
crie as áreas e atribua cada tema importado a uma delas.

Sem esse cadastro, cada questão aparece como uma "área" e as telas avisam
isso. Os temas que ficarem sem área continuam aparecendo, reunidos como
"Sem área definida".

### O que os painéis não mostram, e por quê

Taxa de evasão, taxa de aprovação e média por disciplina apareciam no protótipo
aprovado, mas **não existem na planilha**. Em vez de estimá-las, a plataforma
simplesmente não as exibe. Quando um indicador não pode ser calculado, a tela
mostra um traço, não um zero: é o caso da variação de quem não tem resultado
anterior.

A **distribuição das alternativas escolhidas**, pedida no levantamento, também
não é calculável: a planilha registra apenas se o discente acertou, nunca a
letra que ele marcou. A tela de Questões diz isso em vez de omitir o bloco.

## Princípios que o código precisa respeitar

1. **Nada específico de Enfermagem no código.** Número de questões, temas,
   componentes e faixas de nota são configuração de curso.
2. **A planilha é a fonte única e permanente.** Não há sistema acadêmico a
   integrar, hoje ou depois.
3. **Pseudonimização nas visões coletivas.** Nome real só na ficha individual,
   conforme a LGPD (Lei 13.709/2018).
4. **Nenhum indicador inventado.** Se a planilha não sustenta um número, a tela
   informa que o dado não existe na fonte.
5. **Operação sem equipe técnica.** As docentes usam o painel sozinhas depois
   que a disciplina terminar.
6. **Controle de acesso no processo principal.** Esconder um item de menu é
   cortesia visual; a restrição por perfil e por escopo de curso é aplicada
   onde o dado vive.
7. **Campo sensível não chega em claro ao banco.** A criptografia fica na
   fronteira do repositório, igual para os dois drivers, e nenhum serviço
   precisa lembrar de aplicá-la.
