%% Copyright (C) 2026 Fluxer Contributors
%%
%% This file is part of Fluxer.
%%
%% Fluxer is free software: you can redistribute it and/or modify
%% it under the terms of the GNU Affero General Public License as published by
%% the Free Software Foundation, either version 3 of the License, or
%% (at your option) any later version.
%%
%% Fluxer is distributed in the hope that it will be useful,
%% but WITHOUT ANY WARRANTY; without even the implied warranty of
%% MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
%% GNU Affero General Public License for more details.
%%
%% You should have received a copy of the GNU Affero General Public License
%% along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

-module(push_core).

-export([handle_message_create/1]).
-export([sync_user_guild_settings/3]).
-export([sync_user_blocked_ids/2]).

-spec handle_message_create(map()) -> ok.
handle_message_create(Params) ->
    case fluxer_gateway_env:get(push_enabled) of
        true ->
            gen_server:cast(push, {handle_message_create, Params});
        false ->
            ok
    end.

-spec sync_user_guild_settings(integer(), integer(), map()) -> ok.
sync_user_guild_settings(UserId, GuildId, UserGuildSettings) ->
    gen_server:cast(push, {sync_user_guild_settings, UserId, GuildId, UserGuildSettings}).

-spec sync_user_blocked_ids(integer(), [integer()]) -> ok.
sync_user_blocked_ids(UserId, BlockedIds) ->
    gen_server:cast(push, {sync_user_blocked_ids, UserId, BlockedIds}).
