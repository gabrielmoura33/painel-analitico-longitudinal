/**
 * Guarda temporária do arquivo enviado.
 *
 * A importação tem duas fases: a pessoa envia a planilha, confere o que o
 * sistema entendeu e só então confirma. No desktop a segunda fase relia o
 * arquivo do disco pelo caminho. Na web não há caminho — há um envio, que
 * precisa sobreviver entre as duas requisições.
 *
 * Guardar em memória seria perder o arquivo a cada reinício e não funcionar
 * com mais de uma instância do servidor. Por isso é uma porta: a
 * implementação põe os bytes onde o servidor inteiro enxerga.
 */
export interface ArmazemDeUpload {
  guardar(conteudo: Uint8Array, nomeArquivo: string): Promise<string>
  obter(id: string): Promise<{ conteudo: Uint8Array; nomeArquivo: string } | null>
  descartar(id: string): Promise<void>
}
