# Implantação no ambiente da PUC Minas

Documento para a equipe de infraestrutura. Descreve o que o Painel Analítico
Longitudinal precisa para rodar no ambiente da universidade, o que ele grava e
onde, e o que a aplicação faz — e não faz — pela proteção dos dados.

## O que é

Aplicação **desktop** (Electron) instalada na máquina de cada pessoa
autorizada. A interface roda local; os dados ficam numa base **MongoDB** única,
compartilhada por todas as instalações. Não há servidor de aplicação, não há
porta HTTP publicada e não há rota exposta na internet.

Instaladores: `.dmg` (macOS) e `.exe` (NSIS, Windows), gerados por
`npm run empacotar:mac` e `npm run empacotar:win`.

## O que precisa existir no ambiente

| Item | Requisito |
|---|---|
| Base de dados | MongoDB 6 ou superior |
| Transações | Conjunto de réplicas (ver observação abaixo) |
| Rede | Alcance das estações autorizadas ao servidor, pela rede interna |
| Volume | Da ordem de alguns milhares de documentos por aplicação do Teste de Progresso |
| Estação | Windows 10+ ou macOS 12+, sem requisito especial de hardware |

**Sobre transações.** A importação de planilha roda como uma transação: ou a
aplicação entra inteira, ou o banco fica como estava. Transação em MongoDB
exige conjunto de réplicas; num `mongod` avulso ela não existe. Nesse caso a
aplicação **executa a importação assim mesmo** e registra o aviso no log —
recusar seria pior —, mas uma falha no meio pode deixar carga parcial, que se
corrige reimportando a mesma planilha. Um conjunto de réplicas de um nó só já
resolve.

## Configuração

Tudo por variável de ambiente, definida na estação:

| Variável | Para que serve |
|---|---|
| `PAINEL_DRIVER` | `mongo` para a base compartilhada; ausente ou `local` usa o arquivo embarcado |
| `PAINEL_MONGO_URL` | String de conexão, incluindo credenciais |
| `PAINEL_MONGO_BANCO` | Nome do banco. Omitido, usa `painel-analitico` |
| `PAINEL_CHAVE_DADOS` | Chave de 32 bytes (hexadecimal ou base64) que cifra os campos sensíveis |

### A chave é obrigatória na instalação compartilhada

Os campos sensíveis são cifrados pela aplicação antes de chegar ao banco.
**Todas as instalações precisam da mesma `PAINEL_CHAVE_DADOS`**, ou uma não lê
o que a outra gravou.

Sem a variável, cada instalação gera a própria chave e a guarda ao lado do
banco local — o que serve a uma instalação de máquina única e **não** a uma
base compartilhada. A tela *Diagnóstico do sistema* mostra qual dos dois casos
está em vigor.

Gerar uma chave:

```bash
openssl rand -base64 32
```

Ela deve ser tratada como segredo de produção: quem tem a chave e acesso ao
banco lê os dados pessoais. Convém guardá-la no cofre de segredos da
instituição e entregá-la às estações pelo mesmo mecanismo usado para outras
variáveis de ambiente.

## O que é gravado, e como

Cifrado com AES-256-GCM pela aplicação, antes de sair da estação:

- Usuários: nome completo, CPF, data de nascimento
- Discentes: nome completo, código de matrícula

Em claro, por serem necessários às consultas e não identificarem ninguém
sozinhos: login de acesso, pseudônimo do discente (`ENF-001`), período,
número da questão, tema, componente e o acerto propriamente dito.

Senhas nunca são gravadas: apenas o hash bcrypt, custo 10.

## O que a aplicação faz pela segurança

- Cifra os campos acima **em repouso**, nos dois drivers.
- Autentica toda chamada no processo principal, antes de qualquer handler.
- Recorta por escopo: um usuário só recebe dados dos cursos que lhe foram
  atribuídos, e a verificação é no processo principal, não na interface.
- Registra no log cada abertura de ficha individual, com quem abriu e quando.
- Mantém o `sandbox` do Electron ligado e bloqueia navegação para fora da
  própria interface.
- Não envia dado nenhum para fora: não há telemetria, não há serviço externo.

## O que fica a cargo da infraestrutura

- Controle de acesso de rede ao servidor MongoDB e autenticação do banco.
- Backup e retenção da base.
- Disponibilidade: a aplicação depende do servidor estar no ar.
- Criptografia em trânsito (TLS na string de conexão) e em disco, se a política
  da instituição exigir.
- Distribuição e atualização dos instaladores nas estações.

## Verificação antes de liberar

O código-fonte é entregue completo e pode ser compilado e auditado pela equipe:

```bash
npm install
npm run typecheck
npm test
npm run build
```

### Teste de conexão com o servidor

Antes de instalar o aplicativo em qualquer estação, vale confirmar que o
servidor responde, autentica e aceita escrita. O teste roda fora do Electron,
direto pelo Node:

```bash
PAINEL_MONGO_URL='mongodb://usuario:senha@host:porta/?authSource=admin' \
  node scripts/testar-mongo.mjs
```

Ele verifica conexão, autenticação, versão do servidor, escrita e leitura de um
documento descartável, e se há replica set. A URL não é impressa de volta: o
relatório mostra apenas host, porta e banco, para que o comando possa ser
executado e o resultado compartilhado sem expor a senha.

## Ambiente de testes do projeto

Durante o desenvolvimento, a equipe manteve um MongoDB próprio para exercitar o
driver compartilhado. **Não é ambiente de produção e não deve receber dados
reais de discentes**: fica em servidor da equipe, com a porta alcançável pela
internet e protegida apenas por senha.

| Item | Valor |
| --- | --- |
| Servidor | `82.112.245.54`, porta `48017` |
| Usuário | `user` |
| Banco | `painel-analitico` |
| Topologia | nó único, sem replica set |

Como é nó único, a importação roda sem transação: uma planilha interrompida no
meio deixa dados parciais, e o aviso correspondente aparece no log. A base
definitiva deve ficar na infraestrutura da PUC Minas, dentro da rede da
instituição, com replica set e backup — o que este documento descreve nas
seções anteriores.

## Migração do arquivo local para o MongoDB

O driver local grava um JSON único por coleção, no mesmo formato de documento
que o MongoDB consome — a troca foi desenhada para ser possível. A carga
inicial, quando houver dados a aproveitar, é feita coleção a coleção a partir
desse arquivo, com a mesma chave de criptografia configurada em
`PAINEL_CHAVE_DADOS`.
