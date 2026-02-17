CREATE TABLE IF NOT EXISTS fluxer.guild_discovery (
    guild_id bigint,
    status text,
    category_type int,
    description text,
    applied_at timestamp,
    reviewed_at timestamp,
    reviewed_by bigint,
    review_reason text,
    removed_at timestamp,
    removed_by bigint,
    removal_reason text,
    PRIMARY KEY ((guild_id))
);

CREATE TABLE IF NOT EXISTS fluxer.guild_discovery_by_status (
    status text,
    applied_at timestamp,
    guild_id bigint,
    PRIMARY KEY ((status), applied_at, guild_id)
) WITH CLUSTERING ORDER BY (applied_at DESC, guild_id DESC);
