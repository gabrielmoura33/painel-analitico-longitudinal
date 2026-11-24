import { app, BrowserWindow } from 'electron'

import { NOME_APLICACAO } from '@compartilhado/constants'
import { criarRepositorio, driverConfigurado, type Repositorio } from './db'
import { registrarCanaisCursos } from './ipc/cursos'
import { registrarCanaisImportacao } from './ipc/importacao'
import { registrarCanaisPainel } from './ipc/painel'
import { registrarCanaisSessao } from './ipc/sessao'
import { registrarCanaisSistema } from './ipc/sistema'
import { registrarCanaisUsuarios } from './ipc/usuarios'
import { criarJanelaPrincipal } from './janela'
import { instalarMenu } from './menu'
import { abrirSplash } from './splash'
import { ServicoAutenticacao } from './servicos/autenticacao'
import { ServicoCursos } from './servicos/cursos'
import { ServicoImportacao } from './servicos/importacao'
import { ServicoIndicadores } from './servicos/indicadores'
import { ServicoUsuarios } from './servicos/usuarios'

let repositorio: Repositorio | null = null

async function iniciar(): Promise<void> {
  app.setName(NOME_APLICACAO)

  // A splash aparece antes de conectar o banco e registrar os canais, para que
  // a abertura tenha resposta imediata mesmo em máquina lenta.
  const splash = abrirSplash()

  repositorio = criarRepositorio({
    driver: driverConfigurado(),
    pastaDados: app.getPath('userData')
  })
  await repositorio.conectar()

  const autenticacao = new ServicoAutenticacao(repositorio)
  const usuarios = new ServicoUsuarios(repositorio)
  const cursos = new ServicoCursos(repositorio)
  const importacao = new ServicoImportacao(repositorio)
  const indicadores = new ServicoIndicadores(repositorio)

  // Restaura a sessão de quem marcou "Manter conectado" no último acesso.
  await autenticacao.retomarSessaoPersistida()

  registrarCanaisSistema(repositorio, autenticacao)
  registrarCanaisSessao(autenticacao, usuarios)
  registrarCanaisUsuarios(autenticacao, usuarios)
  registrarCanaisCursos(autenticacao, cursos)
  registrarCanaisImportacao(autenticacao, importacao)
  registrarCanaisPainel(autenticacao, indicadores)

  const janela = criarJanelaPrincipal()
  instalarMenu(janela)
  janela.once('ready-to-show', () => splash.encerrar())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const nova = criarJanelaPrincipal()
      instalarMenu(nova)
    }
  })
}

app.whenReady().then(iniciar).catch((erro: unknown) => {
  console.error('Falha ao iniciar a aplicação:', erro)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void repositorio?.desconectar()
})
