import datetime
import math
import os
import logging
import re
from typing import Any, Dict, List

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
        # Configure OpenAI client for OpenRouter.
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            logger.warning("OPENROUTER_API_KEY nao configurada. Integracao com IA pode falhar.")

        self.ai = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self.model = "anthropic/claude-3.5-sonnet"

    def stage1_extraction_and_score(
        self,
        trends: List[Dict[str, Any]],
        focus_keywords: list[str] | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Contextual score = 60% Niche Fit + 40% Momentum.
        - Momentum: per-source normalized engagement + recency + source weight.
        - Niche Fit: lexical coverage of focus keywords over title/content.
        """
        logger.info("Executando Stage 1: Extracao e Score")
        if focus_keywords:
            logger.info(f"Foco tematico aplicado: {focus_keywords}")

        now = datetime.datetime.utcnow()
        scored_trends: List[Dict[str, Any]] = []

        by_source_logs: Dict[str, List[float]] = {}
        for trend in trends:
            source = trend.get("source", "unknown")
            engagement = max(float(trend.get("engagement", 0.0) or 0.0), 0.0)
            by_source_logs.setdefault(source, []).append(math.log1p(engagement))

        source_quantiles: Dict[str, tuple[float, float, float]] = {}
        for source, values in by_source_logs.items():
            values_sorted = sorted(values)
            p10 = _quantile(values_sorted, 0.10)
            p50 = _quantile(values_sorted, 0.50)
            p90 = _quantile(values_sorted, 0.90)
            source_quantiles[source] = (p10, p50, p90)

        for trend in trends:
            source = trend.get("source", "unknown")
            weight = SOURCE_WEIGHTS.get(source, 1.0)

            published_at = trend.get("published_at", now)
            if isinstance(published_at, str):
                try:
                    published_at = datetime.datetime.fromisoformat(
                        published_at.replace("Z", "+00:00")
                    ).replace(tzinfo=None)
                except Exception:
                    published_at = now

            hours_elapsed = (now - published_at).total_seconds() / 3600.0
            if hours_elapsed < 0:
                hours_elapsed = 0

            engagement = max(float(trend.get("engagement", 0.0) or 0.0), 0.0)
            log_engagement = math.log1p(engagement)

            p10, _p50, p90 = source_quantiles.get(source, (0.0, 0.0, 1.0))
            spread = max(p90 - p10, 1e-6)
            normalized_engagement = max(0.0, min(1.0, (log_engagement - p10) / spread))

            # Half-life style recency around 24h.
            recency_score = 1.0 / (1.0 + (hours_elapsed / 24.0))

            base_momentum = (normalized_engagement * 0.75 + recency_score * 0.25) * 100.0
            momentum_score = max(0.0, min(100.0, base_momentum * weight))

            text = f"{trend.get('title', '')} {trend.get('content', '')}".lower()
            niche_fit_score, matched_keywords = _compute_niche_fit(text, focus_keywords)
            contextual_score = niche_fit_score * 0.60 + momentum_score * 0.40

            # Keep `viral_score` as canonical field consumed by UI/API, now contextual.
            trend["viral_score"] = contextual_score
            trend["momentum_score"] = momentum_score
            trend["niche_fit_score"] = niche_fit_score
            trend["score_components"] = {
                "normalized_engagement": round(normalized_engagement, 4),
                "recency_score": round(recency_score, 4),
                "source_weight": weight,
                "momentum_score": round(momentum_score, 2),
                "niche_fit_score": round(niche_fit_score, 2),
                "contextual_score": round(contextual_score, 2),
                "score_formula": "0.60*niche_fit + 0.40*momentum",
                "matched_keywords": matched_keywords,
            }
            scored_trends.append(trend)

        scored_trends.sort(key=lambda x: x["viral_score"], reverse=True)
        return scored_trends

    async def stage2_angle_analysis(self, top_news: Dict[str, Any], top_trend: Dict[str, Any]) -> str:
        """
        Cruza uma noticia (ex: G1) com uma trend (ex: TikTok) criando um Mashup.
        """
        logger.info(f"Executando Stage 2: Mashup entre {top_news.get('source')} e {top_trend.get('source')}")

        prompt = f"""
        Voce e um estrategista de conteudo genial.
        Crie um "Angulo" (Mashup criativo) cruzando a seguinte noticia recente com a tendencia viral atual.

        Noticia (Origem: {top_news.get('source')}):
        Titulo: {top_news.get('title')}
        Conteudo/Resumo: {top_news.get('content')}

        Tendencia Viral (Origem: {top_trend.get('source')}):
        Titulo/Descricao: {top_trend.get('title')}
        Contexto: {top_trend.get('content')}

        Sua tarefa: Forneca apenas UM paragrafo descrevendo um angulo inusitado e de altissimo engajamento que conecte esses dois assuntos de forma que o publico ache irresistivel.
        """

        try:
            response = await self.ai.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Erro ao gerar Mashup via IA: {e}")
            return "Falha ao gerar analise de angulo."

    async def stage3_copywriting_pro(self, angle: str) -> str:
        """
        Gera o roteiro estruturado para um carrossel de 7 slides baseado no angulo.
        """
        logger.info("Executando Stage 3: Copywriting Pro")

        prompt = f"""
        Baseado no seguinte "Angulo" genial:
        "{angle}"

        Crie um roteiro de carrossel para Instagram/LinkedIn de exatamente 7 slides:
        - Slide 1 (Hook): Gancho de altissima retencao. NENHUMA PERGUNTA GENERICA permitida. Use curiosidade, afirmacao polemica ou dados chocantes.
        - Slides 2: Lead (Introducao rapida do tema).
        - Slide 3-4: Conflito (A complicacao narrativa).
        - Slide 5-6: Solucao (Conhecimento pratico ou resolucao).
        - Slide 7 (CTA): Chamada para acao clara, focada EXCLUSIVAMENTE em SALVAR e COMPARTILHAR (nao peca para comentar).

        Formate como:
        [SLIDE 1]
        Texto...

        ...e assim por diante. Mantenha os textos curtos e focados para leitura visual.
        """

        try:
            response = await self.ai.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "Voce e um Copywriter de elite focado em viralidade social."},
                    {"role": "user", "content": prompt},
                ],
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"Erro ao gerar Roteiro via IA: {e}")
            return "Falha ao gerar roteiro."


def _quantile(sorted_values: List[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = (len(sorted_values) - 1) * q
    base = int(pos)
    frac = pos - base
    upper = sorted_values[min(base + 1, len(sorted_values) - 1)]
    return sorted_values[base] + frac * (upper - sorted_values[base])


def _compute_niche_fit(text: str, focus_keywords: list[str] | None) -> tuple[float, list[str]]:
    """
    Returns (niche_fit_score_0_to_100, matched_keywords).
    If no focus keywords are provided, returns neutral 50.
    """
    if not focus_keywords:
        return 50.0, []

    cleaned_keywords = [kw.strip().lower() for kw in focus_keywords if kw and kw.strip()]
    if not cleaned_keywords:
        return 50.0, []

    tokenized_text = set(re.findall(r"[a-z0-9_]+", text.lower()))
    matched: list[str] = []
    keyword_scores: list[float] = []

    for kw in cleaned_keywords:
        kw_tokens = [t for t in re.findall(r"[a-z0-9_]+", kw) if len(t) >= 2]
        if not kw_tokens:
            keyword_scores.append(0.0)
            continue

        phrase_match = kw in text
        covered = sum(1 for tok in kw_tokens if tok in tokenized_text)
        token_ratio = covered / len(kw_tokens)
        kw_score = max(1.0 if phrase_match else 0.0, token_ratio)
        keyword_scores.append(kw_score)
        if kw_score >= 0.6:
            matched.append(kw)

    if not keyword_scores:
        return 50.0, []

    coverage_score = (sum(keyword_scores) / len(keyword_scores)) * 100.0
    exact_ratio = sum(1 for score in keyword_scores if score >= 0.999) / len(keyword_scores)
    exact_bonus = exact_ratio * 10.0

    final = max(0.0, min(100.0, coverage_score + exact_bonus))
    return final, matched
