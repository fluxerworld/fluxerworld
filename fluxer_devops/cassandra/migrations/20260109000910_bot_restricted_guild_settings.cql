ALTER TABLE fluxer.user_settings ADD bot_default_guilds_restricted boolean;
ALTER TABLE fluxer.user_settings ADD bot_restricted_guilds set<bigint>;
