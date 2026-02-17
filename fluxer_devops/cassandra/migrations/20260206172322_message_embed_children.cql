CREATE TYPE IF NOT EXISTS fluxer.message_embed_child (
	type text,
	title text,
	description text,
	url text,
	timestamp timestamp,
	color int,
	author frozen<message_embed_author>,
	provider frozen<message_embed_provider>,
	thumbnail frozen<message_embed_media>,
	image frozen<message_embed_media>,
	video frozen<message_embed_media>,
	footer frozen<message_embed_footer>,
	fields frozen<list<message_embed_field>>,
	nsfw boolean
);
ALTER TYPE fluxer.message_embed ADD children frozen<list<message_embed_child>>;
