CREATE TABLE IF NOT EXISTS fluxer.donors (
    email text,
    stripe_customer_id text,

    business_name text,
    tax_id text,
    tax_id_type text,

    stripe_subscription_id text,
    subscription_amount_cents int,
    subscription_currency text,
    subscription_interval text,
    subscription_current_period_end timestamp,
    subscription_cancel_at timestamp,

    created_at timestamp,
    updated_at timestamp,
    version int,
    PRIMARY KEY ((email))
);

CREATE TABLE IF NOT EXISTS fluxer.donors_by_stripe_customer_id (
    stripe_customer_id text,
    email text,
    PRIMARY KEY ((stripe_customer_id), email)
);

CREATE TABLE IF NOT EXISTS fluxer.donors_by_stripe_subscription_id (
    stripe_subscription_id text,
    email text,
    PRIMARY KEY ((stripe_subscription_id), email)
);

CREATE TABLE IF NOT EXISTS fluxer.donor_magic_link_tokens (
    token_ text,
    donor_email text,
    expires_at timestamp,
    used_at timestamp,
    PRIMARY KEY ((token_))
) WITH default_time_to_live = 900;

CREATE TABLE IF NOT EXISTS fluxer.donor_magic_link_tokens_by_email (
    donor_email text,
    token_ text,
    PRIMARY KEY ((donor_email), token_)
) WITH default_time_to_live = 900;
