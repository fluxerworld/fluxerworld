FROM erlang:28-slim AS build

ARG LOGGER_LEVEL=info

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	git \
	curl \
	make \
	gcc \
	g++ \
	libc6-dev \
	gettext-base \
	ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://github.com/erlang/rebar3/releases/download/3.24.0/rebar3 -o /usr/local/bin/rebar3 && \
	chmod +x /usr/local/bin/rebar3

COPY rebar.config rebar.lock* ./
RUN rebar3 compile --deps_only

COPY . .
RUN LOGGER_LEVEL=${LOGGER_LEVEL} envsubst < config/sys.config.template > config/sys.config && \
	rebar3 as prod release

FROM erlang:28-slim

WORKDIR /opt/fluxer_gateway

RUN apt-get update && apt-get install -y --no-install-recommends \
	ca-certificates \
	curl \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/src/app/_build/prod/rel/fluxer_gateway .
COPY scripts/docker_entrypoint.sh /opt/fluxer_gateway/bin/docker_entrypoint.sh

RUN chmod +x /opt/fluxer_gateway/bin/docker_entrypoint.sh && \
	useradd -r -s /sbin/nologin -d /opt/fluxer_gateway fluxer && \
	chown -R fluxer:fluxer /opt/fluxer_gateway

USER fluxer

EXPOSE 8080 8081

ENTRYPOINT ["/opt/fluxer_gateway/bin/docker_entrypoint.sh"]
