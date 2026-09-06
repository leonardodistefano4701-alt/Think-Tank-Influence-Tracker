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
        # Do NOT fall back to a canned response. The previous mock returned
        # confidence 0.85, which cleared the > 0.75 gate in policy_alignment.py,
        # so a misconfigured run silently wrote fabricated "Likely Aligned"
        # verdicts and influence edges into the evidence database for every
        # think-tank/bill pair, with nothing marking them synthetic.
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Refusing to run analysis without a "
            "model - a stubbed verdict would be indistinguishable from a real one."
        )

    
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
