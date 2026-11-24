import 'server-only'

import type { Cofre } from '@/dominio/portas/cofre'
import type { HashDeSenha } from '@/dominio/portas/hash-de-senha'
import type { Relogio } from '@/dominio/portas/relogio'
import type { Repositorio } from '@/dominio/portas/repositorio'
import { CasoDeUsoAutenticacao, ControleDeTentativas } from '@/aplicacao/casos/autenticacao'
import { CasoDeUsoCursos } from '@/aplicacao/casos/cursos'
import { CasoDeUsoImportacao } from '@/aplicacao/casos/importacao'
import { CasoDeUsoIndicadores } from '@/aplicacao/casos/indicadores'
import { CasoDeUsoUsuarios } from '@/aplicacao/casos/usuarios'
import type { ArmazemDeUpload } from '@/dominio/portas/armazem-de-upload'
import { ArmazemMongo } from '@/infraestrutura/mongo/armazem-mongo'
import { GeradorDeSenhaInicial } from '@/infraestrutura/seguranca/hash-bcrypt'
import { Configuracao } from '@/infraestrutura/configuracao'
import { CofreAes } from '@/infraestrutura/cripto/cofre-aes'
import { RepositorioCifrado } from '@/infraestrutura/cripto/repositorio-cifrado'
import { obterConexaoMongo, type ConexaoMongo } from '@/infraestrutura/mongo/conexao'
import { RepositorioMongo } from '@/infraestrutura/mongo/repositorio-mongo'
import { RelogioDoSistema } from '@/infraestrutura/relogio-do-sistema'
import { HashBcrypt } from '@/infraestrutura/seguranca/hash-bcrypt'

/**
 * O que vive enquanto o processo viver.
 *
 * A divisão entre isto e o `Container` é a diferença entre caro e barato. O
 * pool de conexões, a chave derivada do cofre e o contador de tentativas de
 * senha precisam ser únicos: recriá-los por requisição significaria,
 * respectivamente, esgotar o banco, gastar scrypt à toa e zerar o freio de
 * força bruta a cada tentativa.
 */
class RecursosDoProcesso {
  public readonly configuracao: Configuracao
  public readonly conexao: ConexaoMongo
  public readonly cofre: Cofre
  public readonly hash: HashDeSenha
  public readonly relogio: Relogio
  public readonly tentativas: ControleDeTentativas

  public constructor() {
    this.configuracao = Configuracao.apartirDoAmbiente()
    this.conexao = obterConexaoMongo(
      this.configuracao.urlMongo,
      this.configuracao.bancoMongo
    )
    this.cofre = CofreAes.apartirDoAmbiente(this.configuracao.chaveDeDados)
    this.hash = new HashBcrypt()
    this.relogio = new RelogioDoSistema()
    this.tentativas = new ControleDeTentativas()
  }
}

interface CacheGlobal {
  recursosDoPainel?: RecursosDoProcesso
}

const cache = globalThis as unknown as CacheGlobal

function recursos(): RecursosDoProcesso {
  cache.recursosDoPainel ??= new RecursosDoProcesso()
  return cache.recursosDoPainel
}

/**
 * Raiz de composição: o único lugar que sabe quais implementações concretas
 * atendem às portas do domínio.
 *
 * Nenhum caso de uso usa `new` para obter uma dependência — todos as recebem
 * pelo construtor, e é aqui que elas são escolhidas. Trocar MongoDB por outro
 * banco, ou bcrypt por outro algoritmo, é alterar este arquivo e mais nada.
 *
 * Uma instância por requisição: ela carrega o repositório, que carrega a
 * sessão de transação em curso.
 */
export class Container {
  private readonly repositorioInterno: Repositorio

  private constructor(private readonly processo: RecursosDoProcesso) {
    this.repositorioInterno = new RepositorioCifrado(
      new RepositorioMongo(processo.conexao),
      processo.cofre
    )
  }

  public static paraRequisicao(): Container {
    return new Container(recursos())
  }

  public get repositorio(): Repositorio {
    return this.repositorioInterno
  }

  public get configuracao(): Configuracao {
    return this.processo.configuracao
  }

  public get relogio(): Relogio {
    return this.processo.relogio
  }

  public get cofre(): Cofre {
    return this.processo.cofre
  }

  public get armazemDeUpload(): ArmazemDeUpload {
    return new ArmazemMongo(this.processo.conexao)
  }

  public cursos(): CasoDeUsoCursos {
    return new CasoDeUsoCursos(this.repositorioInterno, this.processo.relogio)
  }

  public indicadores(): CasoDeUsoIndicadores {
    return new CasoDeUsoIndicadores(this.repositorioInterno)
  }

  public usuarios(): CasoDeUsoUsuarios {
    return new CasoDeUsoUsuarios(
      this.repositorioInterno,
      this.processo.hash,
      new GeradorDeSenhaInicial(),
      this.processo.relogio
    )
  }

  public importacao(): CasoDeUsoImportacao {
    return new CasoDeUsoImportacao(
      this.repositorioInterno,
      this.armazemDeUpload,
      this.processo.relogio
    )
  }

  public autenticacao(): CasoDeUsoAutenticacao {
    return new CasoDeUsoAutenticacao(
      this.repositorioInterno,
      this.processo.hash,
      this.processo.relogio,
      this.processo.tentativas,
      this.processo.configuracao.diasDeSessao
    )
  }
}
