CREATE TABLE IF NOT EXISTS fluxer.password_change_tickets (
    ticket text PRIMARY KEY,
    user_id bigint,
    code text,
    code_sent_at timestamp,
    code_expires_at timestamp,
    verified boolean,
    verification_proof text,
    status text,
    created_at timestamp,
    updated_at timestamp
);
