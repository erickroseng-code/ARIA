# Task: Prepare Download Package

## Context
Executada pelo **Maverick Designer**. Organiza e prepara o pacote final de entrega para o cliente, reunindo todos os roteiros e visuais em um único diretório acessível.

## Input
- `deliverables_path`: Caminho para o diretório de entregáveis em `./data/deliverables/`.
- `generated_assets`: Lista de arquivos gerados (PNGs, PDFs, MDs).

## Steps
1. **Coleta:** Reúna todos os arquivos criados (Roteiros do Copywriter e Imagens do Designer).
2. **Organização:** Crie pastas para cada post (ex: "Post_01_Neuromarketing").
3. **Renomeação:** Nomeie os arquivos de forma clara e profissional.
4. **Resumo da Entrega:** Gere um arquivo `READ_ME_FIRST.md` explicando o que cada arquivo contém e onde publicá-lo.
5. **Geração de Link:** Se o ambiente permitir, gere um link de download ou apenas confirme o caminho local.

## Output
- `package_status`: Confirmação de que o pacote está pronto.
- `local_delivery_path`: Caminho final do diretório organizado.

## Validation
- Todos os roteiros estão presentes?
- As imagens estão com os nomes corretos correspondentes aos roteiros?
- O arquivo de instruções é claro o suficiente para o cliente?
