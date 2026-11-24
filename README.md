# Painel Analítico Longitudinal

Acompanhamento longitudinal de desempenho acadêmico a partir do Teste de
Progresso, desenvolvido com o Departamento de Enfermagem da PUC Minas como
projeto de extensão do curso de Sistemas de Informação (EAD).

O painel transforma as planilhas do Teste de Progresso em séries históricas:
em vez de uma fotografia por semestre, a trajetória de cada discente, de cada
turma e de cada área de conhecimento ao longo do curso.

## Os dois aplicativos

| Pasta | O que é |
| --- | --- |
| [`desktop/painel-analitico-longitudinal-enfermagem`](desktop/painel-analitico-longitudinal-enfermagem) | Aplicativo Electron, instalado na máquina de cada docente. Foi a primeira entrega e segue funcional. |
| [`web/`](web) | Versão web em Next.js, com banco compartilhado. Mesmo domínio, arquitetura refeita em camadas. |

Os dois compartilham as regras do instrumento — a régua que converte acertos
em nota, o agrupamento de temas em áreas, o escopo de acesso por curso — mas
não compartilham código: o desktop é funcional e procedural, e o web foi
escrito em camadas com inversão de dependência. Compartilhar exigiria
congelar o desenho antigo exatamente onde o novo precisava mudar.

## Sobre os dados

**Este repositório não contém dados de discentes.** As planilhas do Teste de
Progresso, a ficha individual e os documentos institucionais ficam fora do
versionamento, e o `.gitignore` os barra. Nome, CPF, data de nascimento e
matrícula são cifrados em AES-256-GCM antes de chegarem ao banco; as telas
coletivas mostram pseudônimos (`ENF-001`), e só a ficha individual exibe o
nome real, com o acesso registrado.

Para rodar qualquer um dos dois é preciso fornecer as próprias planilhas.

## Documentação

- [`docs/decisoes-tecnicas.md`](docs/decisoes-tecnicas.md) — por que cada
  decisão foi tomada, incluindo as divergências entre o que a planilha faz e
  o que o documento de critérios descreve.
- [`docs/implantacao.md`](docs/implantacao.md) — o que a TI precisa saber para
  implantar: requisitos, variáveis de ambiente e o que fica a cargo da
  infraestrutura.
- [`capturas/`](capturas) — telas do aplicativo desktop.

## Licença

Projeto acadêmico, sem licença de uso definida.
