CREATE TABLE IF NOT EXISTS fluxer.relationships_by_target (
    target_user_id bigint,
    source_user_id bigint,
    type int,
    nickname text,
    since timestamp,
    version int,
    PRIMARY KEY (target_user_id, source_user_id, type)
) WITH CLUSTERING ORDER BY (source_user_id ASC, type ASC);
