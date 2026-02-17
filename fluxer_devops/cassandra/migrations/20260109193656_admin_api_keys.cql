CREATE TABLE IF NOT EXISTS fluxer.admin_api_keys (
    key_id bigint,
    key_hash text,
    name text,
    created_by_user_id bigint,
    created_at timestamp,
    last_used_at timestamp,
    expires_at timestamp,
    version int,
    PRIMARY KEY (key_id)
);

CREATE TABLE IF NOT EXISTS fluxer.admin_api_keys_by_creator (
    created_by_user_id bigint,
    key_id bigint,
    created_at timestamp,
    name text,
    expires_at timestamp,
    last_used_at timestamp,
    version int,
    PRIMARY KEY (created_by_user_id, key_id)
) WITH CLUSTERING ORDER BY (key_id DESC);
