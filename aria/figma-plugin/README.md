# Aria Carousel — Plugin Figma

Gera frames de carrossel 1080×1080px no Figma a partir do JSON do Maverick.

## Instalação (1 min)

1. Abra o Figma Desktop
2. Menu → **Plugins** → **Development** → **Import plugin from manifest...**
3. Selecione o arquivo `manifest.json` desta pasta
4. Pronto — o plugin aparece em **Plugins > Development > Aria Carousel**

## Como usar

1. Na Aria web app, gere um carrossel no Maverick
2. Clique em **"JSON Figma"** para copiar o JSON
3. Abra o plugin no Figma (**Plugins > Development > Aria Carousel**)
4. Cole o JSON no campo de texto
5. Escolha o tema (Dark ou Light)
6. Clique em **Gerar no Figma →**

O plugin cria uma nova página com todos os slides lado a lado, prontos para editar.

## Imagens via Unsplash (opcional)

1. Crie uma conta em [unsplash.com/developers](https://unsplash.com/developers)
2. Crie um app e copie o **Access Key**
3. No plugin, ative o toggle **"Adicionar imagens"** e cole a chave
4. As imagens são buscadas automaticamente pelo `visual_hint` de cada slide

## Estrutura

```
figma-plugin/
├── manifest.json   — configuração do plugin
├── ui.html         — interface do usuário
└── code.js         — lógica de criação dos frames
```
