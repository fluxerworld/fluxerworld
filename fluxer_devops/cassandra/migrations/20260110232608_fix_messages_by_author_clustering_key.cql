CREATE TABLE IF NOT EXISTS fluxer.messages_by_author_id_v2 (
    author_id bigint,
    message_id bigint,
    channel_id bigint,
    PRIMARY KEY ((author_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
