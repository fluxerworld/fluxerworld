CREATE TABLE IF NOT EXISTS fluxer.ncmec_submissions (
    report_id bigint PRIMARY KEY,
    status text,
    ncmec_report_id text,
    submitted_at timestamp,
    submitted_by_admin_id bigint,
    failure_reason text,
    created_at timestamp,
    updated_at timestamp
);
