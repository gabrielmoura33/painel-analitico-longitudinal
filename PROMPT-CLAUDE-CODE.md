# Prompt — Painel Analítico Longitudinal (aplicação Electron)

> **Como usar:** abra o Claude Code na pasta do projeto e cole este documento inteiro como primeira mensagem.
> Os arquivos de referência citados já estão na pasta.

---

## 1. Contexto

Você vai construir o **Painel Analítico Longitudinal**, uma aplicação desktop que transforma planilhas de Teste de Progresso em painéis de acompanhamento acadêmico.

**Quem usa:** duas docentes da PUC Minas (Patrícia Sarsur e Renata Lacerda, curso de Enfermagem). Não são pessoas técnicas. Elas operam o sistema sozinhas depois que o projeto acabar — não haverá equipe de TI para manter nada.

**O problema:** o corpo docente aplica uma avaliação diagnóstica com o mesmo gabarito a cinco períodos simultaneamente (6º ao 10º). O resultado sai numa planilha `.xlsx` que ninguém consegue ler analiticamente. Não dá para saber quais temas travam a turma, qual aluno regrediu, nem qual questão está mal calibrada.

**O que o sistema entrega:** importação da planilha, acúmulo das aplicações ao longo dos semestres e painéis que respondem quatro perguntas — como cada discente evolui, como cada área de conhecimento se comporta, como cada questão se comporta, e como áreas e períodos se cruzam.

**Arquivos de referência na pasta:**
- `PUC COMPLETA Percentuais de acertos do TP - 2025 2 COREU (1) (1) (1).xlsx` — amostra real completa, use como fixture de desenvolvimento e teste
- `PUC Percentuais de acertos do TP - 2026 I COREU (1) (2).xlsx` — segunda aplicação, use para testar o acúmulo longitudinal
- `PUC TESTE DE PROGRESSÃO CRITÉRIOS DE DISTRIBUIÇÃO DOS PONTOS.pdf` — a régua de notas oficial
- `Login.pdf`, `Admin – Cadastro de usuários 2.pdf`, `Dashboard geral – Notas 5 anos.pdf` — mockups aprovados pelas parceiras
- `Painel Analítico Longitudinal(1).docx` — documento executivo do projeto
- `Consolidado TI.docx` — os quatro requisitos analíticos, ditados pelas parceiras

---

## 2. Decisões de arquitetura — já tomadas, não reabra

1. **Electron**, aplicação desktop. O documento executivo dizia React/web; a decisão foi trocada por Electron. Não proponha voltar para web.
2. **Sem framework de UI no renderer.** HTML + TypeScript + CSS puro. Nada de React, Vue, Svelte ou Angular.
3. **A planilha é a fonte única e permanente.** Não existe sistema acadêmico para integrar, não existe API, e isso não vai mudar. Importar `.xlsx` é o requisito central, não um acessório.
4. **Independência de curso.** Adicionar um novo curso deve ser cadastro e configuração, nunca alteração de código ou de esquema. Nada específico de Enfermagem pode estar hardcoded — nem temas, nem número de questões, nem faixas de nota.
5. **Custo zero.** Toda dependência precisa ser gratuita e de licença permissiva.
6. **Funciona offline.** Sem servidor, sem nuvem, sem conta.

### Persistência — leia com atenção

O documento executivo especifica **MongoDB** como Data Warehouse/Data Mart. Numa aplicação desktop operada por não-técnicos, exigir um MongoDB instalado quebra a diretriz de "manutenção sem dependência de equipe técnica".

**Resolva assim:** implemente uma camada de repositório com interface única e **dois drivers**:

- `local` (**padrão**, usado pelo app): banco de documentos embarcado, arquivo único no `app.getPath('userData')`. Use `lowdb` ou equivalente leve. Sem instalação, sem serviço.
- `mongo`: driver oficial MongoDB, selecionável por configuração, para honrar o documento executivo e permitir uso multiusuário futuro.

A escolha vive em configuração, nunca espalhada pelo código. Todo o resto do sistema conhece apenas a interface do repositório. Modele os dados em **documentos**, no formato que o MongoDB consumiria, para que a troca de driver seja real e não teórica.

---

## 3. Stack

| Camada | Escolha |
|---|---|
| Shell | Electron (versão LTS estável), `contextIsolation: true`, `nodeIntegration: false` |
| Linguagem | TypeScript em modo `strict`, nos três processos |
| Build | electron-vite |
| Renderer | HTML + TS + CSS puro, roteamento por hash interno |
| IPC | `contextBridge` no preload, canais tipados, validação de entrada no main |
| Leitura de planilha | `exceljs` |
| Gráficos | `chart.js` v4 para linha e barras. Heatmap, barras horizontais de distribuição e boxplot em HTML/CSS puro — não adicione biblioteca para isso |
| Senhas | `bcryptjs` (JS puro, evita compilação nativa) |
| Persistência | `lowdb` (driver `local`) + `mongodb` (driver `mongo`) |
| Testes | `vitest` |
| Empacotamento | `electron-builder` — alvos Windows (NSIS) e macOS (dmg) |

Regra: o ETL e os cálculos rodam **no processo main**, nunca no renderer. O renderer só pede dados e desenha.

---

## 4. Estrutura de pastas

```
src/
  main/
    index.ts                 bootstrap, janela, menu nativo
    ipc/                     handlers por domínio
    db/
      repository.ts          interface única
      drivers/local.ts
      drivers/mongo.ts
      migrations/
    etl/
      reader.ts              lê o .xlsx cru
      recognizer.ts          identifica abas, períodos, estrutura
      validator.ts           produz o relatório de ocorrências
      normalizer.ts          grafias, espaços, duplicatas
      loader.ts              grava no modelo canônico
      grading.ts             conversão % -> nota
    services/                indicadores e agregações
  preload/
    index.ts                 contextBridge tipado
  renderer/
    index.html
    router.ts
    views/                   uma pasta por tela
    components/              topbar, tabela, kpi-card, chart, heatmap, modal, toast
    styles/
      tokens.css             design tokens
      base.css
  shared/
    types/                   tipos compartilhados entre processos
    constants.ts
tests/
  fixtures/                  cópias das planilhas de amostra
```

---

## 5. Modelo canônico de dados

Independente de curso. O curso é atributo obrigatório em todo registro de desempenho.

**`cursos`**
```
_id, nome, sigla, instituicao, nomeInstrumento,
estrutura: {
  totalQuestoes: number,
  periodos: string[],                       // ["6º","7º","8º","9º","10º"]
  componentes: [{ nome, questaoInicial, questaoFinal }]
},
regua: [{ periodo, notaBase, percentualMinimo }],
perfilImportacao: {
  linhaCabecalho, colunaQuestao, colunaGabarito, colunaTema,
  colunaDocente, primeiraColunaAluno, marcadorAcerto, linhaTotal
},
criadoEm, atualizadoEm
```

**`aplicacoes`** — uma importação bem-sucedida
```
_id, cursoId, rotulo,                       // "2025/1"
semestre, ano, dataImportacao, importadoPor,
arquivoOriginal, hashArquivo,               // detecção de reimportação
periodos: string[], totalDiscentes, totalRegistros,
status                                      // concluida | concluida_com_avisos | revertida
```

**`discentes`**
```
_id, cursoId, nomeCompleto, pseudonimo,     // "ENF-001", estável entre aplicações
ativo, criadoEm
```
O pseudônimo é atribuído na primeira aparição e **nunca muda** — é ele que torna a série longitudinal possível sem expor nomes nas visões coletivas. A reconciliação entre aplicações é por nome normalizado (minúsculas, sem acentos, espaços colapsados); quando houver ambiguidade, registre como ocorrência de importação e peça decisão ao usuário, nunca adivinhe.

**`questoes`**
```
_id, cursoId, aplicacaoId, numero, gabarito,
tema, docenteResponsavel, componente
```

**`desempenho`** — a coleção de fatos
```
_id, cursoId, aplicacaoId, discenteId, periodo,
questaoId, numeroQuestao, tema, componente, acerto: boolean
```
Volume esperado: 35 questões × 144 discentes = 5.040 documentos por aplicação. Indexe por `(cursoId, aplicacaoId, periodo)` e por `(cursoId, discenteId)`.

**`usuarios`**
```
_id, nomeCompleto, cpf, dataNascimento, login, senhaHash,
perfil,                                     // professor | administrador
ativo, primeiroAcesso: boolean, ultimoAcesso,
termoAceitoEm
```

**`solicitacoesSenha`**, **`logImportacoes`** — complementares.

---

## 6. Estrutura real da planilha

Verificada na amostra. O leitor precisa tolerar tudo que está descrito aqui.

**Abas presentes:** `MODELO `, `Nota TP à partir dos % `, `Final 6º P`, `Final 7º P`, `Final 8º P`, `Final 9º P`, `Final 10º P`, `Questões abaixo 50%`.

**Abas `Final Nº P` — são a fonte de verdade:**
- Linha 1: título livre, ex. `Percentual de acerto por aluno e questão - 6º período - 1º semestre de 2025`
- Linha 2: rótulos `Questão | | Tema | Professor(a) | Alunos`
- Linha 3: coluna B = `GABARITO`; a partir da coluna E, **um nome de discente por coluna**
- Linhas 4 a 38: as 35 questões — A = número, B = gabarito, C = tema, D = docente, E em diante = `1` quando acertou e **célula vazia quando errou**
- Última coluna à direita: marca de componente — `Componente Geral` na questão 1, `Componente Específico` na questão 9
- Linha 39: `TOTAL` por discente

**`MODELO `:** gabarito de referência sem respostas. Ignore na importação.

**`Nota TP à partir dos % `:** a régua, com colunas `Acertos | % | 6º P | 7º P | 8º P | 9º P | 10º P`. Use para conferir a régua configurada.

**`Questões abaixo 50%`:** derivada, e **com dados sujos** — contém percentuais de 125%, 190%, 195%, porque somam em vez de calcular média. **Ignore a aba e recalcule tudo.** Não importe nenhum valor dela.

### Sujeiras que o ETL precisa engolir sem reclamar

Todas observadas na amostra real:
- Espaços à direita em nomes de docente e tema: `"Meire "`, `"Mônica "`, `"Diagósticos de Enfermagem "`
- Caixa inconsistente: `"NInon"`
- Erro de digitação preservado na origem: `"Diagósticos"` sem o "n"
- Títulos de aba que não correspondem ao conteúdo
- Células isoladas fora da matriz, com valores avulsos
- Colunas de discente vazias no meio do intervalo

O documento executivo é explícito: **o ETL reporta o que não conseguiu resolver, em vez de recusar o arquivo.** Recusar só o que é estruturalmente impossível de interpretar.

---

## 7. ETL — pipeline obrigatório

1. **Leitura** — abre o arquivo, lista as abas, não interpreta nada ainda.
2. **Reconhecimento** — identifica o tipo de cada aba e deduz o período do título ou do nome. É sugestão: o usuário pode corrigir cada uma na interface.
3. **Validação estrutural** — confere contra o perfil de importação do curso. Produz um relatório em três severidades:
   - **Bloqueante**: aba sem gabarito; estrutura incompatível; aplicação já importada (`hashArquivo` + curso + rótulo já existentes)
   - **Atenção**: grafias divergentes agrupadas em clusters para o usuário unificar; percentuais impossíveis; discentes ambíguos
   - **Informativa**: células vazias lidas como erro; discentes com zero acertos; questões sem tema ou sem docente
4. **Normalização** — `trim`, colapso de espaços internos, unificação das grafias que o usuário confirmou. **Nunca normalize silenciosamente o que muda significado** — unificar `"NInon"` com `"Ninon"` exige confirmação humana na tela.
5. **Pseudonimização** — atribui ou recupera o pseudônimo de cada discente.
6. **Conversão de nota** — aplica a régua do curso por período.
7. **Carga** — grava `aplicacao`, `questoes`, `discentes` novos e os documentos de `desempenho`, de forma transacional: ou entra tudo, ou nada.
8. **Relatório** — persiste em `logImportacoes` e oferece exportação.

**Reimportação:** o mesmo arquivo enviado duas vezes nunca pode duplicar registros. Detecte por hash e ofereça apenas "substituir a importação anterior" ou "cancelar".

---

## 8. Régua de conversão % → nota

Regra oficial do PDF de critérios. Cada período tem uma **nota base** e um **percentual mínimo**:

| Período | Nota base | % mínimo |
|---|---|---|
| 6º | 5 | 50% |
| 7º | 4 | 40% |
| 8º | 3 | 30% |
| 9º | 2 | 20% |
| 10º | 1 | 10% |

A partir do mínimo, cada faixa de 10 pontos percentuais vale +1 na nota, até 10.

```ts
function calcularNota(percentual: number, notaBase: number, percentualMinimo: number): number {
  if (percentual < percentualMinimo) return 0;
  const nota = notaBase + Math.ceil((percentual - percentualMinimo) / 10);
  return Math.min(nota, 10);
}
```

Esta fórmula foi **conferida contra todos os pontos de quebra** da aba `Nota TP à partir dos % ` da planilha real, nos cinco períodos. Escreva testes unitários que repitam essa conferência.

Dois pontos a tratar explicitamente:
- O PDF não define o que acontece **abaixo do percentual mínimo**. Implemente como `0` e deixe um `TODO` visível no código e uma nota na tela de configuração: *"regra a confirmar com as docentes parceiras"*. Não esconda a decisão.
- O PDF exige "mínimo de 2 horas de dedicação" para pontuar. **Esse dado não existe na planilha.** Ignore o critério no cálculo e registre a limitação no README. Não invente um campo para ele.

A régua inteira é configurável por curso e por período (tela T4). Nada dela pode estar hardcoded.

---

## 9. LGPD

A amostra identifica discentes por nome completo — dado pessoal nos termos do art. 5º, I, da Lei 13.709/2018. Decisão de projeto já tomada:

- **Visões coletivas** (turma, áreas, questões, docentes, visão geral) mostram **sempre** o pseudônimo. Sem exceção, sem toggle.
- **Visão individual do discente** mostra o nome real, acessível apenas a usuário autenticado, e cada abertura é registrada em log de acesso.
- O nome real nunca sai em exportação de visão coletiva.
- Não há tela que liste nome real e desempenho lado a lado em lote.

---

## 10. Design system

Extraído dos mockups aprovados. Respeite com precisão — as parceiras já validaram este visual.

```css
:root {
  --cor-primaria:      #285961;
  --cor-primaria-esc:  #1D3E44;
  --cor-apoio:         #8BB2B6;
  --cor-apoio-clara:   #AFC8CB;
  --cor-alerta:        #B04C24;
  --cor-fundo:         #F4F6F5;
  --cor-superficie:    #FFFFFF;
  --cor-texto:         #1A1A1A;
  --cor-texto-suave:   #6B7280;
  --cor-borda:         #E5E7EB;
  --raio:              10px;
  --sombra-card:       0 1px 3px rgba(0,0,0,.06);
}
```

- Tipografia sem serifa geométrica. Rótulos pequenos em `--cor-texto-suave` sobre números grandes em peso bold.
- Cards brancos, raio 10px, sombra sutil, respiro generoso.
- Topbar escura `--cor-primaria` com o logo "Painel Analítico / ENFERMAGEM" à esquerda, navegação ao centro, nome do usuário e "Sair" à direita.
- Badges de situação em pílula: verde para bom, laranja `--cor-alerta` para atenção.
- Login em split-screen: coluna esquerda `--cor-primaria` com logo e brasão, coluna direita `--cor-fundo` com o formulário.
- Janela mínima 1280×800. O layout não precisa ser responsivo para celular, mas deve se comportar bem entre 1280 e 1920.

Reproduza as três telas dos PDFs **fielmente**. Abra os PDFs antes de codificar.

---

## 11. Telas

Topbar: `Visão geral · Análises ▾ · Importações · Administração ▾`
Submenu Análises: Discente · Turma · Áreas · Questões · Docentes
Submenu Administração (só admin): Usuários · Cursos e réguas · Histórico de importações

A topbar carrega um **filtro global persistente** de Curso + Aplicação. Toda tela analítica é relativa a ele.

**Estado vazio global:** enquanto nenhuma planilha tiver sido importada, toda tela analítica mostra "Nenhuma aplicação importada" com botão que leva à importação. É a primeira coisa que o usuário vê numa instalação nova.

---

### T0 — Login *(mockup pronto: `Login.pdf`)*
Split-screen. Campos Usuário e Senha com toggle de visibilidade, link "Esqueci a senha", checkbox "Manter conectado", botão "Entrar", rodapé "Problemas de acesso? Contate o suporte de TI." Autenticação por login institucional, não por e-mail.

### T1 — Primeiro acesso / definir senha
Obrigatória no primeiro login, sem permitir navegar para outro lugar. Senha atual, nova senha, confirmação, checklist de força em tempo real, checkbox de aceite do termo de tratamento de dados com o texto em modal. Grava `termoAceitoEm` e zera `primeiroAcesso`.

### T2 — Recuperação de senha
**O cadastro não coleta e-mail**, então não existe canal para link de redefinição. Implemente como solicitação: campo Usuário, botão "Solicitar redefinição", resposta sempre neutra ("Se o usuário existir, o administrador será notificado") para não revelar quais logins existem. A solicitação entra como pendência na lista de usuários, e o admin redefine gerando nova senha inicial.

### T3 — Cadastro de usuário *(mockup pronto: `Admin – Cadastro de usuários 2.pdf`)*
Breadcrumb `Administração › Usuários`. Nome completo, CPF e Data de nascimento lado a lado, Login com o hint "A senha inicial será enviada ao usuário no primeiro acesso", e Perfil em dois radio-cards: **Professor** ("Acessa e analisa os indicadores do painel") e **Administrador** ("Gerencia usuários e configurações do sistema"). Botões "Limpar" e "Cadastrar usuário". Valide CPF de verdade.

### T4 — Lista de usuários
Busca por nome ou login, filtros por perfil e status, botão "Novo usuário". Tabela: Nome, Login, Perfil, Status, Último acesso, ações (Editar, Redefinir senha, Desativar). Banner no topo quando houver solicitações de redefinição pendentes. O admin não pode desativar a si mesmo nem rebaixar o próprio perfil.

### T5 — Cursos e perfis de importação
É o mecanismo de generalização ganhando interface. Sem esta tela, aderir à plataforma vira alteração de código.

Lista de cursos; detalhe em quatro abas:
- **Identificação** — nome, sigla, instituição, nome do instrumento
- **Estrutura** — total de questões, períodos em chips editáveis, componentes com faixas de questões (`Geral: 1–8`, `Específico: 9–35`)
- **Régua de notas** — grid editável período × faixa, pré-carregada com a tabela da seção 8, botão "Importar régua da planilha" e campo "Testar": digita um percentual e mostra a nota resultante em cada período
- **Mapeamento de colunas** — todos os campos de `perfilImportacao`, com pré-visualização que roda contra um arquivo real **sem importar nada**

### T6 — Importação de planilha — wizard de 4 passos
A tela mais importante do sistema.

**Passo 1 — Arquivo.** Dropzone grande, ou seleção por `dialog.showOpenDialog` filtrando `.xlsx`. Select de Curso, campo Aplicação (`2025/1`), instrumento preenchido pelo perfil. Botão "Analisar arquivo" — não grava nada.

**Passo 2 — Reconhecimento.** Tabela das abas detectadas: nome da aba, interpretação, questões, discentes, ação. Cada linha com select de período **editável**. Abas `MODELO` e `Questões abaixo 50%` marcadas como ignoradas com o motivo visível.

**Passo 3 — Validação.** Ocorrências agrupadas pelas três severidades da seção 7, cada grupo com contador e "ver detalhes" abrindo painel lateral com as linhas e colunas afetadas. Clusters de grafia divergente com checkbox e campo "unificar em". Bloqueantes impedem o avanço e explicam o porquê em português claro.

**Passo 4 — Confirmação.** Resumo ("5 períodos · 144 discentes · 35 questões · 5.040 registros"), prévia da régua, checkbox "Pseudonimizar discentes nas visões coletivas" **marcado e desabilitado**, botão "Importar". Barra de progresso com log. Ao final: sucesso com link para a visão geral da aplicação e botão para baixar o relatório.

Trate: arquivo corrompido, planilha protegida por senha, nenhuma aba reconhecível, arquivo que não é `.xlsx`.

### T7 — Histórico de importações
Tabela: Curso, Aplicação, Arquivo, Data/hora, Usuário, Períodos, Discentes, Registros, Status. Ações: ver relatório, reprocessar com o perfil atualizado, excluir com confirmação dupla avisando que a aplicação some dos painéis.

### T8 — Visão geral *(mockup `Dashboard geral – Notas 5 anos.pdf` — o layout se mantém, os indicadores mudam)*

**Atenção:** o mockup usa dados fictícios e indicadores que **não existem na fonte**. O próprio rodapé dele admite. Mantenha o layout, a hierarquia e os componentes; troque o conteúdo.

| Remover (não existe na planilha) | Colocar no lugar |
|---|---|
| Taxa de evasão | Nota média pela régua |
| Taxa de aprovação | Percentual médio de acerto |
| Médias por disciplina | Percentual por área de conhecimento |
| Filtro por ano 2022–2026 | Filtro por aplicação importada |

**KPIs:** percentual médio de acerto · acertos médios sobre o total · nota média · discentes avaliados · **Componente Geral vs. Específico** lado a lado — na amostra são 81,8% contra 58,3%, e esse contraste é o achado mais eloquente do diagnóstico.

**Gráfico de linha:** percentual médio por aplicação, a série longitudinal real.
**Gráfico de barras:** percentual médio por período na aplicação selecionada.
**Distribuição:** faixas de nota em barras horizontais, reaproveitando o componente desenhado.
**Destaques:** os badges `ACIMA` / `ATENÇÃO` / `DESTAQUE` do mockup, agora por regra calculada — ex.: "11 questões abaixo de 50%, 9 delas em todos os períodos".
**Tabela:** áreas de conhecimento ordenadas da pior para a melhor.

### T9 — Visão de turma / período
Filtros: aplicação, período, componente.
KPIs do período: avaliados, acertos médios, percentual médio, nota média, percentual acima do mínimo.
Histograma de distribuição de acertos. Dispersão ou boxplot por área, mostrando a heterogeneidade da turma — que é exatamente a dor descrita no diagnóstico do projeto.
Tabela de discentes **pseudonimizados**: percentual, nota, variação vs. aplicação anterior, Geral, Específico. Ordenável, clique abre T10.
Bloco de destaques e comparativo entre os cinco períodos.

### T10 — Visão longitudinal do discente *(requisito 1)*
A razão de ser do projeto: `62% no 6º → 68% no 7º → 74% no 8º → 78% no 9º → 84% no 10º`.

Entrada por busca na topbar ou clique na T9.
Cabeçalho: nome real, curso, período atual, aplicações realizadas, botão "Exportar ficha (PDF)".
KPIs: último percentual, nota na régua, variação, percentil na turma, Geral e Específico.
**Gráfico principal:** linha da trajetória do discente por aplicação, com segunda série pontilhada = média da turma no mesmo período. É o que a docente vai mostrar ao aluno na conversa.
**Gráfico secundário:** barras agrupadas por área, discente vs. média da turma.
**Tabela "Evolução por área":** linhas = áreas, colunas = períodos, células = percentual com seta de variação e realce para queda.
**Dois blocos de leitura pedagógica:** *Pontos de atenção* (áreas abaixo de 50%, áreas em queda por duas aplicações seguidas, questões erradas repetidamente) e *Evolução* (áreas que mais cresceram). São eles que transformam dado em intervenção.

### T11 — Áreas de conhecimento *(requisitos 2 e 4)*
**Aba Ranking:** tabela da menor para a maior taxa de acerto — Área, nº de questões, percentual na aplicação, percentual histórico, variação, situação (Crítico <50% · Atenção 50–69% · Bom ≥70%). Herda o visual da tabela "Médias por disciplina" do mockup.
**Aba Matriz período × área:** heatmap em CSS grid, linhas = áreas, colunas = 6º a 10º, escala do laranja `--cor-alerta` ao petróleo `--cor-primaria`, tooltip com nº de questões e de respondentes, toggle "mostrar variação".
**Aba Evolução:** multi-linha, uma série por área ao longo das aplicações, seletor de séries com as 5 piores por padrão.
Painel lateral ao clicar numa área: questões que a compõem, docente responsável, percentual por período.

### T12 — Questões *(requisito 3)*
Lista: número, tema, gabarito, docente, componente, percentual geral, mini-série dos cinco períodos, dificuldade (Fácil ≥70% · Média 50–69% · Difícil <50%), e flag **"abaixo de 50% em todos os períodos"** — na amostra são 9 questões, o achado mais acionável do diagnóstico.
Filtros por componente, área, docente, dificuldade, e toggle rápido "só abaixo de 50%".
Detalhe: percentual por período em barras, respondentes, comparação com a média do instrumento, lista pseudonimizada de quem errou.

**Limitação a exibir, não a esconder:** o `Consolidado TI.docx` pede "distribuição das alternativas escolhidas", mas **a planilha registra apenas acerto, nunca a letra marcada**. O dado não existe na fonte. Renderize o bloco com o estado explícito *"Indisponível na fonte atual — requer coleta da alternativa marcada"*. Não omita silenciosamente e não invente o número.

### T13 — Docentes responsáveis
Tabela: Docente, nº de questões de autoria, percentual médio dessas questões, melhor e pior questão, áreas cobertas. Clique abre painel com as questões e o desempenho por período.
**Nota obrigatória no rodapé da tela:** é leitura de calibragem do instrumento e de temas que pedem reforço, **não** avaliação de desempenho docente. Os 15 docentes da amostra são autores das questões, não usuários da plataforma.

---

## 12. Indicadores — o que calcular e o que não inventar

**Calcule a partir do dado real:** percentual de acerto por discente, por questão, por tema, por componente, por período e por aplicação; nota pela régua; variação entre aplicações; percentil na turma; dificuldade da questão; distribuição de notas; médias históricas acumuladas.

**Nunca produza, porque a fonte não suporta:** taxa de evasão · taxa de aprovação · médias por disciplina · distribuição de alternativas marcadas · situação do aluno no curso · tempo de dedicação à prova.

Se um indicador não puder ser calculado, a tela diz isso. Nenhum número inventado, nenhum placeholder que pareça real, nenhum dado fictício fora de teste.

---

## 13. Critérios de aceite

1. Importar `PUC COMPLETA ... 2025 2 COREU.xlsx` do zero produz 5 períodos, 144 discentes, 35 questões e 5.040 registros de desempenho, sem intervenção técnica.
2. Importar o mesmo arquivo de novo é detectado e não duplica nada.
3. Importar a planilha de 2026 I depois acumula a série: a T10 passa a mostrar dois pontos na trajetória de cada discente reincidente.
4. As grafias `"Meire "`, `"Mônica "` e `"NInon"` aparecem como ocorrências de atenção, com proposta de unificação, e o usuário decide.
5. Os percentuais acima de 100% da aba `Questões abaixo 50%` nunca entram no banco.
6. `calcularNota` reproduz todos os pontos de quebra da aba `Nota TP à partir dos % ` nos cinco períodos, verificado por teste automatizado.
7. Nenhuma visão coletiva exibe nome real, em tela ou em exportação.
8. Cadastrar um segundo curso com outro número de questões e outra régua funciona **sem tocar em código**.
9. As telas T0, T3 e T8 são visualmente fiéis aos PDFs aprovados.
10. O app abre, importa e navega **sem conexão de internet** e sem nenhum serviço externo instalado.
11. Admin e Professor enxergam menus diferentes, e a restrição é aplicada **no main**, não apenas escondendo item de menu.

---

## 14. Ordem de implementação

Entregue em fases, cada uma funcionando de ponta a ponta. Pare ao fim de cada fase e me mostre o resultado antes de seguir.

1. **Fundação** — Electron + TS + build + IPC tipado + repositório com driver local + design tokens + topbar e roteamento
2. **Acesso** — T0, T1, T2, T3, T4, seed de admin inicial, perfis aplicados no main
3. **Configuração** — T5 completa, incluindo régua e mapeamento de colunas
4. **Importação** — ETL completo + T6 + T7. *Esta é a entrega que destrava todo o resto.*
5. **Analíticas base** — T8 e T9
6. **Analíticas longitudinais** — T10, T11, T12, T13
7. **Acabamento** — exportações, menu nativo (Arquivo → Importar planilha… / Exportar…), empacotamento Windows e macOS, README de operação escrito para leitor não-técnico

---

## 15. Entregáveis

- Código-fonte organizado conforme a seção 4
- Testes unitários do ETL, da régua e dos cálculos de indicadores, rodando contra as planilhas reais como fixtures
- `README.md` com instalação, uso e o roteiro de **como aderir um novo curso** — escrito para as docentes, não para desenvolvedores
- `docs/modelo-dados.md` com o modelo dimensional e os metadados, para anexar ao documento executivo
- `docs/decisoes-etl.md` registrando cada decisão de integração e transformação, também exigido pelo documento executivo
- Instaladores Windows e macOS

---

## 16. Como trabalhar comigo

- Antes de codificar: abra os três PDFs de mockup e a planilha de amostra. O dado real tem precedência sobre qualquer suposição.
- Quando a fonte não sustentar um requisito, **diga**, implemente o estado de indisponibilidade e siga. Não preencha com dado fictício.
- Pergunte antes de inventar regra de negócio. As que faltam estão marcadas no texto como "a confirmar com as docentes parceiras".
- Toda a interface, mensagens de erro, rótulos e comentários em **português do Brasil**.
