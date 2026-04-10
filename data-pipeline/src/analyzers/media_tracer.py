import structlog
import json
from .llm_client import generate_analysis

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You compare think tank policy positions to media coverage by amplifiers (columnists, streamers).
Determine if the media amplifier is echoing the policy paper's framing, talking points, or exact recommendations.
Return a finding with a "strength" score (0.0 to 1.0, where 1.0 is extensive, clear echoing) and "evidence" string detailing the overlap.

Return exactly a JSON object: {"strength": float, "evidence": string}"""

async def detect_media_echo(policy_paper: dict, media_item: dict) -> dict:
    """Detect think tank -> media echo patterns"""
    logger.info("detecting_media_echo", policy_id=policy_paper.get("id"), media_id=media_item.get("id"))
    
    prompt = f"Policy Paper:\nTitle: {policy_paper.get('title')}\nSummary: {policy_paper.get('summary')}\nTags: {policy_paper.get('topic_tags')}\n\n"
    prompt += f"Media Coverage:\nHeadline: {media_item.get('headline')}\nSummary: {media_item.get('summary')}\nSentiment: {media_item.get('sentiment')}"
    
    response_text = await generate_analysis(prompt, system_prompt=SYSTEM_PROMPT)
    
    try:
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON object found in response.")
        json_str = response_text[start:end]
        result = json.loads(json_str)
        return {
            "strength": float(result.get("strength", 0.0)),
            "evidence": str(result.get("evidence", "No evidence analyzed."))
        }
    except Exception as e:
        logger.error("failed_to_parse_media_tracer", error=str(e))
        return {
            "strength": 0.0,
            "evidence": "Analysis failed due to response format error."
        }
