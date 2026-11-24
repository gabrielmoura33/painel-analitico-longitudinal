import { BrowserWindow, app } from 'electron'

import { NOME_APLICACAO } from '@compartilhado/constants'

/**
 * Tempo mínimo em tela, para a splash não piscar em máquinas rápidas.
 *
 * PAINEL_SPLASH_MS permite segurá-la por mais tempo em apresentações e na
 * verificação automatizada.
 */
const DURACAO_MINIMA_MS = Number(process.env.PAINEL_SPLASH_MS ?? 900)

/**
 * Marca estendida, igual a assets/marca-completa.svg.
 *
 * Fica embutida aqui porque a splash abre antes de qualquer carregamento de
 * arquivo: ela precisa ser a primeira coisa a aparecer, sem depender de disco.
 */
const MARCA = `
<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
  <defs>
    <linearGradient id="fundoMarca" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2F666E" />
      <stop offset="1" stop-color="#1D3E44" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#fundoMarca)" />
  <g fill="#FFFFFF">
    <rect x="27.5" y="8" width="9" height="26" rx="3" />
    <rect x="18" y="16.5" width="28" height="9" rx="3" />
  </g>
  <g fill="#8BB2B6">
    <rect x="12" y="48" width="6" height="7" rx="2" opacity="0.45" />
    <rect x="21" y="45" width="6" height="10" rx="2" opacity="0.6" />
    <rect x="30" y="42" width="6" height="13" rx="2" opacity="0.75" />
    <rect x="39" y="39" width="6" height="16" rx="2" opacity="0.88" />
    <rect x="48" y="36" width="6" height="19" rx="2" />
  </g>
</svg>`

function documento(versao: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
  <style>
    :root {
      --petroleo: #285961;
      --petroleo-escuro: #1D3E44;
      --apoio: #8BB2B6;
    }
    html, body { margin: 0; height: 100%; background: transparent; }
    body {
      display: grid;
      place-items: center;
      font-family: "Segoe UI", "Helvetica Neue", -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      user-select: none;
      cursor: default;
    }
    .cartao {
      width: 420px;
      height: 260px;
      border-radius: 16px;
      background: linear-gradient(160deg, var(--petroleo) 0%, var(--petroleo-escuro) 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    }
    .marca { display: block; filter: drop-shadow(0 6px 14px rgba(0,0,0,.25)); }
    .nome { text-align: center; }
    .titulo { font-size: 21px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
    .subtitulo {
      font-size: 10px;
      letter-spacing: 0.22em;
      opacity: 0.8;
      margin-top: 4px;
    }
    .trilho {
      width: 180px;
      height: 3px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.18);
      overflow: hidden;
    }
    /* Progresso indeterminado: o carregamento não tem etapas mensuráveis. */
    .trilho::after {
      content: "";
      display: block;
      width: 40%;
      height: 100%;
      border-radius: 999px;
      background: var(--apoio);
      animation: desliza 1.1s ease-in-out infinite;
    }
    @keyframes desliza {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(250%); }
    }
    .rodape {
      position: absolute;
      bottom: 14px;
      font-size: 10.5px;
      opacity: 0.6;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="cartao">
    <span class="marca">${MARCA}</span>
    <div class="nome">
      <div class="titulo">Painel Analítico</div>
      <div class="subtitulo">ENFERMAGEM</div>
    </div>
    <div class="trilho"></div>
    <div class="rodape">PUC Minas · Departamento de Enfermagem<br />versão ${versao}</div>
  </div>
</body>
</html>`
}

export interface Splash {
  janela: BrowserWindow
  /** Fecha a splash, respeitando o tempo mínimo em tela. */
  encerrar: () => void
}

export function abrirSplash(): Splash {
  const janela = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    title: NOME_APLICACAO,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  })

  const abertaEm = Date.now()

  janela.once('ready-to-show', () => {
    if (!janela.isDestroyed()) janela.show()
  })

  void janela.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(documento(app.getVersion()))
  )

  return {
    janela,
    encerrar: () => {
      const restante = Math.max(0, DURACAO_MINIMA_MS - (Date.now() - abertaEm))
      setTimeout(() => {
        if (!janela.isDestroyed()) janela.destroy()
      }, restante)
    }
  }
}
