import structlog

logger = structlog.get_logger(__name__)

async def write_verdict_to_db(pool, entity_id: str, verdict_data: dict):
    """
    Task 4.5: Write verdicts to analysis_verdicts table.
    pool: an asyncpg pool or similar async DB connection.
    """
    logger.info("writing_verdict_to_db", entity_id=entity_id)
    query = """
    INSERT INTO analysis_verdicts(entity_id, verdict, confidence, reasoning, evidence_summary)
    VALUES($1, $2, $3, $4, $5)
    RETURNING id;
    """
    try:
        await pool.execute(
            query,
            entity_id,
            verdict_data["verdict"],
            verdict_data["confidence"],
            verdict_data["reasoning"],
            verdict_data["evidence_summary"]
        )
    except Exception as e:
        logger.error("failed_to_write_verdict", error=str(e), entity_id=entity_id)

async def build_semantic_influence_links(pool):
    """
    Task 4.6: Build influence_links between policy papers and legislation.
    Uses pgvector if embeddings exist, else keyword matching.
    pool: an asyncpg pool or similar async DB connection.
    """
    logger.info("building_semantic_influence_links")
    
    # 1. Semantic similarity link generation using pgvector
    vector_query = """
    INSERT INTO influence_links (source_type, source_id, target_type, target_id, link_type, strength, evidence)
    SELECT
        'policy_paper' as source_type,
        p.id as source_id,
        'legislation' as target_type,
        l.id as target_id,
        'aligns_with' as link_type,
        1 - (p.embedding <=> l.embedding) as strength,
        'Semantic similarity using pgvector embeddings.' as evidence
    FROM policy_papers p
    CROSS JOIN legislation l
    WHERE p.embedding IS NOT NULL AND l.embedding IS NOT NULL
      AND (1 - (p.embedding <=> l.embedding)) > 0.75
    """
    
    # 2. Key/Tag fallback for items missing vectors
    keyword_query = """
    INSERT INTO influence_links (source_type, source_id, target_type, target_id, link_type, strength, evidence)
    SELECT
        'policy_paper' as source_type,
        p.id as source_id,
        'legislation' as target_type,
        l.id as target_id,
        'aligns_with' as link_type,
        0.5 as strength,
        'Keyword or topic overlap.' as evidence
    FROM policy_papers p
    CROSS JOIN legislation l
    WHERE (p.embedding IS NULL OR l.embedding IS NULL)
      AND (
        p.summary ILIKE '%' || l.title || '%' OR 
        l.summary ILIKE '%' || p.title || '%' OR
        -- Check if arrays overlap
        p.topic_tags && l.topic_tags
      )
    """
    
    try:
        await pool.execute(vector_query)
        await pool.execute(keyword_query)
    except Exception as e:
        logger.error("failed_to_build_semantic_links", error=str(e))
