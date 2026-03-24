FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    apify-client \
    sqlmodel \
    anthropic \
    openai \
    python-dotenv \
    pytrends \
    beautifulsoup4 \
    lxml \
    httpx

COPY src/ ./src/

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
