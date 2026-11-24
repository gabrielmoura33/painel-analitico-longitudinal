# Painel Analítico Longitudinal — web

Versão web do painel, em Next.js com TypeScript e MongoDB compartilhado.

## Arquitetura

Quatro camadas, com as dependências sempre apontando para dentro:

```
src/dominio/         modelos, portas (interfaces) e regras — não conhece framework nem banco
src/aplicacao/       casos de uso; recebem tudo por construtor, nunca dão `new` numa dependência
src/infraestrutura/  implementações das portas: MongoDB, cofre AES, leitor de planilha, sessão HTTP
src/app/ src/ui/     Next.js e React
```

`src/infraestrutura/container.ts` é o único arquivo que sabe que o banco é
MongoDB e que o hash é bcrypt. Trocar qualquer um dos dois é escrever outra
implementação da porta e alterar esse arquivo.

## Rodando

```bash
npm install
cp .env.exemplo .env.local   # e preencha
npm run mongo:dev            # MongoDB efêmero em 127.0.0.1:47017
npm run dev
```

Para carregar dados reais a partir da base do aplicativo desktop:

```bash
npm run migrar -- "$HOME/Library/Application Support/painel-analitico-longitudinal/painel-analitico.json"
```

Testes: `npm test`. Eles sobem um MongoDB em memória — não precisam de
servidor nem de credencial. Os que exercitam o ETL procuram as planilhas
reais na árvore do projeto e se autopulam quando não as encontram.

## Variáveis de ambiente

| Variável | Papel |
| --- | --- |
| `PAINEL_MONGO_URL` | String de conexão, com credenciais. |
| `PAINEL_MONGO_BANCO` | Nome do banco. Omitida, usa `painel-analitico`. |
| `PAINEL_CHAVE_DADOS` | **Obrigatória.** Chave de 32 bytes que cifra nome, CPF, data de nascimento e matrícula. |
| `PAINEL_DIAS_SESSAO` | Duração da opção "manter conectado". Padrão 14. |
| `PAINEL_SENHA_SITE` | **Obrigatória em produção.** Senha do porteiro na frente da URL. |
| `PAINEL_USUARIO_SITE` | Usuário do porteiro. Padrão `painel`. |

**A mesma `PAINEL_CHAVE_DADOS` em todas as instâncias.** Com chaves
diferentes, o que uma gravou a outra não lê — e a falha é silenciosa: os
campos cifrados voltam como texto ilegível em vez de dar erro. Gere uma vez
com `openssl rand -base64 32` e guarde.

## O porteiro da URL

`src/middleware.ts` exige HTTP Basic antes de qualquer página carregar. Ele
não substitui o login do painel — vem antes dele. A URL pública não deve nem
revelar que há um painel da PUC ali, e atrás dela há dado de discente.

Em produção, sem `PAINEL_SENHA_SITE` a aplicação responde 503 em vez de
abrir. Variável esquecida não pode ser o mesmo que não haver porta.

## Implantação na Vercel

O repositório é um monorepo: configure **Root Directory como `web`**, ou faça
o deploy de dentro desta pasta.

```bash
vercel login
vercel link
vercel env add PAINEL_MONGO_URL production
vercel env add PAINEL_CHAVE_DADOS production
vercel env add PAINEL_SENHA_SITE production
vercel --prod
```

O MongoDB precisa aceitar conexões da internet, já que as funções da Vercel
não têm IP fixo. Se o seu banco estiver numa rede fechada, a Vercel não é o
destino certo.

Se o plano da conta incluir Deployment Protection, vale ligá-la **também** —
ela barra antes mesmo de a aplicação subir. O porteiro do middleware existe
porque esse recurso é pago e nem toda conta o tem.
