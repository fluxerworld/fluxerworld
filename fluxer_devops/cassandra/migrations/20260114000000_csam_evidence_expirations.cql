CREATE TABLE IF NOT EXISTS fluxer.csam_evidence_expirations (
    bucket text,
    expires_at timestamp,
    report_id bigint,
    PRIMARY KEY ((bucket), expires_at, report_id)
) WITH CLUSTERING ORDER BY (expires_at ASC);
