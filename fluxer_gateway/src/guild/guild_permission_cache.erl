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

-module(guild_permission_cache).

-export([
    put_state/1,
    put_data/2,
    delete/1,
    get_permissions/3,
    get_snapshot/1
]).

-type guild_id() :: integer().
-type user_id() :: integer().
-type channel_id() :: integer().
-type guild_state() :: map().
-type guild_data() :: map().

-define(TABLE, guild_permission_cache).

-spec put_state(guild_state()) -> ok.
put_state(State) when is_map(State) ->
    GuildId = maps:get(id, State, undefined),
    Data = maps:get(data, State, #{}),
    case is_integer(GuildId) of
        true ->
            put_data(GuildId, Data);
        false ->
            ok
    end;
put_state(_) ->
    ok.

-spec put_data(guild_id(), guild_data()) -> ok.
put_data(GuildId, Data) when is_integer(GuildId), is_map(Data) ->
    ensure_table(),
    NormalizedData = guild_data_index:normalize_data(Data),
    Snapshot = #{id => GuildId, data => NormalizedData},
    true = ets:insert(?TABLE, {GuildId, Snapshot}),
    ok;
put_data(_, _) ->
    ok.

-spec delete(guild_id()) -> ok.
delete(GuildId) when is_integer(GuildId) ->
    ensure_table(),
    _ = ets:delete(?TABLE, GuildId),
    ok;
delete(_) ->
    ok.

-spec get_permissions(guild_id(), user_id(), channel_id() | undefined) ->
    {ok, integer()} | {error, not_found}.
get_permissions(GuildId, UserId, ChannelId) when is_integer(GuildId), is_integer(UserId) ->
    case get_snapshot(GuildId) of
        {ok, Snapshot} ->
            Permissions = guild_permissions:get_member_permissions(UserId, ChannelId, Snapshot),
            {ok, Permissions};
        {error, not_found} ->
            {error, not_found}
    end;
get_permissions(_, _, _) ->
    {error, not_found}.

-spec get_snapshot(guild_id()) -> {ok, guild_state()} | {error, not_found}.
get_snapshot(GuildId) when is_integer(GuildId) ->
    ensure_table(),
    case ets:lookup(?TABLE, GuildId) of
        [{GuildId, Snapshot}] ->
            {ok, Snapshot};
        [] ->
            {error, not_found}
    end;
get_snapshot(_) ->
    {error, not_found}.

-spec ensure_table() -> ok.
ensure_table() ->
    case ets:whereis(?TABLE) of
        undefined ->
            try ets:new(?TABLE, [named_table, public, set, {read_concurrency, true}]) of
                _ -> ok
            catch
                error:badarg -> ok
            end;
        _ ->
            ok
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

put_and_get_permissions_test() ->
    GuildId = 101,
    UserId = 44,
    ViewPermission = constants:view_channel_permission(),
    Data = #{
        <<"guild">> => #{<<"owner_id">> => <<"999">>},
        <<"roles">> => [
            #{<<"id">> => integer_to_binary(GuildId), <<"permissions">> => integer_to_binary(ViewPermission)}
        ],
        <<"members">> => #{
            UserId => #{<<"user">> => #{<<"id">> => integer_to_binary(UserId)}, <<"roles">> => []}
        },
        <<"channels">> => [
            #{<<"id">> => <<"500">>, <<"permission_overwrites">> => []}
        ]
    },
    ok = put_data(GuildId, Data),
    {ok, Permissions} = get_permissions(GuildId, UserId, 500),
    ?assert((Permissions band ViewPermission) =/= 0),
    ok = delete(GuildId).

missing_guild_returns_not_found_test() ->
    ?assertEqual({error, not_found}, get_permissions(999999, 1, undefined)).

-endif.
