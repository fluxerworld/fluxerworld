CREATE TABLE IF NOT EXISTS fluxer.csam_evidence_packages (
    report_id bigint PRIMARY KEY,
    resource_type text,
    bucket text,
    key text,
    cdn_url text,
    filename text,
    content_type text,
    channel_id bigint,
    message_id bigint,
    guild_id bigint,
    user_id bigint,
    match_tracking_id text,
    match_details text,
    frames text,
    hashes text,
    context_snapshot text,
    created_at timestamp,
    expires_at timestamp,
    integrity_sha256 text,
    evidence_zip_key text
);

CREATE TABLE IF NOT EXISTS fluxer.csam_evidence_legal_holds (
    report_id bigint PRIMARY KEY,
    held_until timestamp,
    created_at timestamp
);
