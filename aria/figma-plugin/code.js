// ── Aria Carousel Plugin (Edit-in-Place) ─────────────────────────────────────
// Edita os frames do modelo já existente no Figma com o conteúdo do Maverick.
// Só cria novos frames se o carrossel tiver mais slides do que o modelo.

figma.showUI(__html__, { width: 380, height: 620 });

// ── Orchestrator ─────────────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'generate') {
    var carousel = msg.carousel;
    var images = msg.images;
    var _queueId = msg._queueId;

    try {
      // 1. Coletar todos os frames da seleção (inclui dentro de section/group)
      var selection = figma.currentPage.selection;
      if (selection.length === 0) {
        throw new Error('Selecione os frames do seu modelo antes de gerar.');
      }

      var allFrames = [];

      var collectFrames = function(nodes) {
        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          if (node.type === 'FRAME' || node.type === 'COMPONENT') {
            allFrames.push(node);
          } else if (node.type === 'SECTION' || node.type === 'GROUP') {
            if (node.children) collectFrames(node.children);
          }
        }
      };

      collectFrames(selection);

      // Se selecionou apenas 1 item que é section/group, busca filhos
      if (allFrames.length === 0 && selection.length === 1 && selection[0].children) {
        collectFrames(selection[0].children);
      }

      if (allFrames.length === 0) {
        throw new Error('Nenhum frame encontrado na seleção. Selecione os frames do seu carrossel modelo.');
      }

      // Ordenar frames da esquerda para direita (ordem visual)
      allFrames.sort(function(a, b) { return a.x - b.x; });

      figma.ui.postMessage({ type: 'progress', message: 'Atualizando frames existentes...' });

      var processedFrames = [];
      var spacing = 40;

      // 2. Para cada slide: editar frame existente ou clonar se faltar
      for (var i = 0; i < carousel.slides.length; i++) {
        var slide = carousel.slides[i];

        figma.ui.postMessage({
          type: 'progress',
          message: 'Processando slide ' + (i + 1) + '/' + carousel.slides.length + '...'
        });

        if (i < allFrames.length) {
          // ── Editar frame existente in-place ──
          var frame = allFrames[i];
          await injectDataIntoNode(frame, slide, carousel, images);
          processedFrames.push(frame);
        } else {
          // ── Mais slides do que frames: clonar frame do mesmo tipo ou o último ──
          var templateFrame = findFrameForType(allFrames, slide.type) || allFrames[allFrames.length - 1];
          var clone = templateFrame.clone();
          clone.name = (i + 1) + '. ' + (slide.title || 'Slide');

          // Posicionar logo após o último frame processado
          var lastFrame = processedFrames[processedFrames.length - 1];
          clone.x = lastFrame.x + lastFrame.width + spacing;
          clone.y = lastFrame.y;

          await injectDataIntoNode(clone, slide, carousel, images);
          figma.currentPage.appendChild(clone);
          processedFrames.push(clone);
        }
      }

      // Focar nos frames processados
      figma.viewport.scrollAndZoomIntoView(processedFrames);
      figma.currentPage.selection = processedFrames;

      figma.ui.postMessage({
        type: 'done',
        count: processedFrames.length,
        _queueId: _queueId
      });

    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: err.message });
    }
  }
};

// Encontra o frame que melhor corresponde ao tipo de slide (para fallback de clonagem)
function findFrameForType(frames, type) {
  for (var i = 0; i < frames.length; i++) {
    var name = frames[i].name.toLowerCase();
    if (type === 'cover' && (name.includes('cover') || name.includes('capa'))) return frames[i];
    if (type === 'cta' && name.includes('cta')) return frames[i];
    if (type === 'content' && (name.includes('content') || name.includes('corpo') || name.includes('post'))) return frames[i];
  }
  return null;
}

// ── Data Injection Logic ─────────────────────────────────────────────────────

async function injectDataIntoNode(container, slide, carousel, images) {
  // container é sempre o frame do slide — usado para calcular espaço disponível
  var topFrame = container;

  var findAndReplace = async function(node) {

    // 1. TEXTO
    if (node.type === 'TEXT') {
      var layerName = node.name.toLowerCase();
      var newText = null;

      if (layerName === 'title' || layerName.includes('heading') || layerName === 'headline') {
        newText = slide.title || '';
      } else if (layerName === 'body' || layerName.includes('text') || layerName === 'content') {
        newText = slide.body || '';
      } else if (layerName === 'counter') {
        var pos = slide.position || (carousel.slides.indexOf(slide) + 1);
        newText = pos + '/' + carousel.slides.length;
      } else if (layerName === 'topic') {
        newText = carousel.topic || '';
      }

      if (newText !== null) {
        await injectTextSafe(node, newText, topFrame);
      }
    }

    // 2. IMAGEM
    if (images && images.length > 0) {
      var type = node.type;
      if (type === 'RECTANGLE' || type === 'ELLIPSE' || type === 'POLYGON' || type === 'FRAME') {
        var imgLayerName = node.name.toLowerCase();
        if (imgLayerName.includes('image') || imgLayerName.includes('photo') ||
            imgLayerName.includes('background') || imgLayerName.includes('bg') ||
            imgLayerName.includes('foto') || imgLayerName.includes('imagem')) {
          var imgIndex = Math.min(carousel.slides.indexOf(slide), images.length - 1);
          var imgData = images[imgIndex];
          if (imgData) {
            var image = figma.createImage(imgData);
            node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
          }
        }
      }
    }

    // 3. RECURSÃO
    if ('children' in node) {
      for (var i = 0; i < node.children.length; i++) {
        await findAndReplace(node.children[i]);
      }
    }
  };

  await findAndReplace(container);
}

// ── Smart Text Fitting ────────────────────────────────────────────────────────
// Injeta texto sem deixar truncado: reduz fonte se necessário, usa reticências como
// último recurso.

async function injectTextSafe(node, text, parentFrame) {
  if (!text) {
    node.characters = '';
    return;
  }

  // Carregar fonte
  try {
    var fontToLoad = node.fontName;
    if (fontToLoad === figma.mixed) fontToLoad = node.getRangeFontName(0, 1);
    await figma.loadFontAsync(fontToLoad);
    if (node.fontName === figma.mixed) node.fontName = fontToLoad;
  } catch (e) {
    console.warn('Erro ao carregar fonte:', e);
  }

  // Altura original da caixa de texto (limite do design)
  var originalHeight = node.height;

  // Tamanho de fonte original (pode ser mixed se tiver estilos mistos)
  var originalFontSize = (node.fontSize === figma.mixed)
    ? node.getRangeFontSize(0, 1)
    : node.fontSize;

  // Espaço disponível dentro do frame pai (com 16px de margem inferior)
  var maxHeight = parentFrame
    ? Math.max(originalHeight, parentFrame.height - node.y - 16)
    : originalHeight * 2;

  // ── Passo 1: Definir texto com auto-resize em altura para medir ──
  node.textAutoResize = 'HEIGHT';
  node.characters = text;

  // ── Passo 2: Cabe dentro da altura original? Ótimo, termina aqui ──
  if (node.height <= originalHeight) {
    return;
  }

  // ── Passo 3: Reduzir tamanho de fonte progressivamente ──
  var minFontSize = 10;
  var currentSize = (typeof originalFontSize === 'number') ? Math.floor(originalFontSize) : 14;

  while (node.height > maxHeight && currentSize > minFontSize) {
    currentSize -= 1;
    node.fontSize = currentSize;
  }

  // ── Passo 4: Ainda extrapola? Travar altura e ativar truncamento nativo ──
  if (node.height > maxHeight) {
    node.textAutoResize = 'NONE';
    node.resize(node.width, maxHeight);
    // textTruncation disponível em versões modernas da API do Figma
    if (node.textTruncation !== undefined) {
      node.textTruncation = 'ENDING';
    }
  }
}
