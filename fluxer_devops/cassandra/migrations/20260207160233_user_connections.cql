CREATE TABLE IF NOT EXISTS fluxer.user_connections (
    user_id bigint,
    connection_type text,
    connection_id text,
    identifier text,
    name text,
    verified boolean,
    visibility_flags int,
    sort_order int,
    verification_token text,
    verified_at timestamp,
    last_verified_at timestamp,
    created_at timestamp,
    version int,
    PRIMARY KEY ((user_id), connection_type, connection_id)
) WITH CLUSTERING ORDER BY (connection_type ASC, connection_id DESC);
