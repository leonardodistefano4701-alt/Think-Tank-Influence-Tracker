import httpx
import structlog
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from config import OPENROUTER_API_KEY
from utils import RateLimiter, with_retry

logger = structlog.get_logger()
limiter = RateLimiter(calls=5, period=1.0) 

@with_retry(retries=3, backoffs=(2, 4, 8))
async def query_llm(system_prompt: str, user_prompt: str, model="minimax/highspeed") -> str:
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set. Falling back to mocked LLM reasoning.")
        return '{"verdict": "Likely Aligned", "confidence": 0.85, "reasoning": "Mocked reasoning due to missing API key.", "evidence_summary": "Extracted semantic matches."}'
        
    await limiter.wait()
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/leodistefano/ttit", 
        "X-Title": "TTIT Analysis Node"
    }
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data['choices'][0]['message']['content']
