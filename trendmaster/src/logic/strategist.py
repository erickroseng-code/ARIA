import datetime
import os
import logging
from typing import List, Dict, Any, Tuple
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Weight mapping by source to balance different engagement scales
SOURCE_WEIGHTS = {
    "g1": 1.5,
    "google_trends": 2.0,
    "instagram": 0.5,
    "tiktok": 0.3,
    "x_twitter": 0.8,
}
# Defaults for subreddits
for sub in ["brasil", "investimentos", "marketing"]:
    SOURCE_WEIGHTS[f"reddit_r_{sub}"] = 1.2

class ContentStrategist:
    def __init__(self):
        # Configurar cliente OpenAI para usar o OpenRouter
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logger.warning("OPENROUTER_API_KEY não configurada. Integração com IA falhará.")
            
        self.ai = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        # Model identifier for OpenRouter
        self.model = "anthropic/claude-3.5-sonnet"

    def stage1_extraction_and_score(self, trends: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Calcula o ViralScore e limpa os dados brutos.
        ViralScore = (Engajamento / Horas Decorridas) * Peso da Fonte
        """
        logger.info("Executando Stage 1: Extração e Score")
        now = datetime.datetime.utcnow()
        scored_trends = []
        
        for trend in trends:
            source = trend.get("source", "unknown")
            weight = SOURCE_WEIGHTS.get(source, 1.0)
            
            published_at = trend.get("published_at", now)
            hours_elapsed = (now - published_at).total_seconds() / 3600.0
            
            # Evita divisão por zero para itens recém publicados
            if hours_elapsed < 0.5:
                hours_elapsed = 0.5
                
            engagement = trend.get("engagement", 1.0)
            
            viral_score = (engagement / hours_elapsed) * weight
            trend["viral_score"] = viral_score
            scored_trends.append(trend)
            
        # Ordena do maior pro menor ViralScore
        scored_trends.sort(key=lambda x: x["viral_score"], reverse=True)
        return scored_trends

    async def stage2_angle_analysis(self, top_news: Dict[str, Any], top_trend: Dict[str, Any]) -> str:
        """
        Cruza uma notícia (ex: G1) com uma trend (ex: TikTok) criando um "Mashup".
        """
        logger.info(f"Executando Stage 2: Mashup entre {top_news.get('source')} e {top_trend.get('source')}")
        
        prompt = f"""
        Você é um estrategista de conteúdo genial.
        Crie um "Ângulo" (Mashup criativo) cruzando a seguinte notícia recente com a tendência viral atual.
        
        Notícia (Origem: {top_news.get('source')}):
        Título: {top_news.get('title')}
        Conteúdo/Resumo: {top_news.get('content')}
        
        Tendência Viral (Origem: {top_trend.get('source')}):
        Título/Descrição: {top_trend.get('title')}
        Contexto: {top_trend.get('content')}
        
        Sua tarefa: Forneça apenas UM parágrafo descrevendo um ângulo inusitado e de altíssimo engajamento que conecte esses dois assuntos de forma que o público ache irresistível.
        """
        
        try:
            response = await self.ai.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Erro ao gerar Mashup via IA: {e}")
            return "Falha ao gerar análise de ângulo."

    async def stage3_copywriting_pro(self, angle: str) -> str:
        """
        Gera o roteiro estruturado para um carrossel de 7 slides baseado no ângulo.
        """
        logger.info("Executando Stage 3: Copywriting Pro")
        
        prompt = f"""
        Baseado no seguinte "Ângulo" genial:
        "{angle}"
        
        Crie um roteiro de carrossel para Instagram/LinkedIn de exatamente 7 slides:
        - Slide 1 (Hook): Gancho de altíssima retenção. NENHUMA PERGUNTA GENÉRICA permitida. Use curiosidade, afirmação polêmica ou dados chocantes.
        - Slides 2: Lead (Introdução rápida do tema).
        - Slide 3-4: Conflito (A complicação narrativa).
        - Slide 5-6: Solução (Conhecimento prático ou resolução).
        - Slide 7 (CTA): Chamada para ação clara, focada EXCLUSIVAMENTE em SALVAR e COMPARTILHAR (não peça para comentar).
        
        Formate como:
        [SLIDE 1]
        Texto...
        
        ...e assim por diante. Mantenha os textos curtos e focados para leitura visual.
        """
        
        try:
            response = await self.ai.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Você é um Copywriter de elite focado em viralidade social."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Erro ao gerar Roteiro via IA: {e}")
            return "Falha ao gerar roteiro."
