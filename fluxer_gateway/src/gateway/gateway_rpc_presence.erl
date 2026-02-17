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

-module(gateway_rpc_presence).

-export([execute_method/2]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-define(PRESENCE_LOOKUP_TIMEOUT, 2000).

-spec execute_method(binary(), map()) -> term().
execute_method(<<"presence.dispatch">>, #{
    <<"user_id">> := UserIdBin, <<"event">> := Event, <<"data">> := Data
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    EventAtom = constants:dispatch_event_atom(Event),
    case presence_manager:dispatch_to_user(UserId, EventAtom, Data) of
        ok ->
            true;
        {error, not_found} ->
            handle_offline_dispatch(EventAtom, UserId, Data)
    end;
execute_method(<<"presence.join_guild">>, #{
    <<"user_id">> := UserIdBin, <<"guild_id">> := GuildIdBin
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    GuildId = validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin),
    presence_manager:lookup_async(UserId, {join_guild, GuildId}),
    true;
execute_method(<<"presence.leave_guild">>, #{
    <<"user_id">> := UserIdBin, <<"guild_id">> := GuildIdBin
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    GuildId = validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin),
    presence_manager:lookup_async(UserId, {leave_guild, GuildId}),
    true;
execute_method(<<"presence.terminate_sessions">>, #{
    <<"user_id">> := UserIdBin, <<"session_id_hashes">> := SessionIdHashes
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    presence_manager:lookup_async(UserId, {terminate_session, SessionIdHashes}),
    true;
execute_method(<<"presence.terminate_all_sessions">>, #{<<"user_id">> := UserIdBin}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    case presence_manager:terminate_all_sessions(UserId) of
        ok -> true;
        _ -> throw({error, <<"terminate_sessions_error">>})
    end;
execute_method(<<"presence.has_active">>, #{<<"user_id">> := UserIdBin}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    case gen_server:call(presence_manager, {lookup, UserId}, ?PRESENCE_LOOKUP_TIMEOUT) of
        {ok, _Pid} -> #{<<"has_active">> => true};
        _ -> #{<<"has_active">> => false}
    end;
execute_method(<<"presence.add_temporary_guild">>, #{
    <<"user_id">> := UserIdBin, <<"guild_id">> := GuildIdBin
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    GuildId = validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin),
    presence_manager:lookup_async(UserId, {add_temporary_guild, GuildId}),
    true;
execute_method(<<"presence.remove_temporary_guild">>, #{
    <<"user_id">> := UserIdBin, <<"guild_id">> := GuildIdBin
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    GuildId = validation:snowflake_or_throw(<<"guild_id">>, GuildIdBin),
    presence_manager:lookup_async(UserId, {remove_temporary_guild, GuildId}),
    true;
execute_method(<<"presence.sync_group_dm_recipients">>, #{
    <<"user_id">> := UserIdBin, <<"recipients_by_channel">> := RecipientsByChannel
}) ->
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    NormalizedRecipients = normalize_recipients(RecipientsByChannel),
    case gen_server:call(presence_manager, {lookup, UserId}, ?PRESENCE_LOOKUP_TIMEOUT) of
        {ok, Pid} ->
            gen_server:cast(Pid, {sync_group_dm_recipients, NormalizedRecipients}),
            true;
        _ ->
            true
    end.

-spec normalize_recipients(map()) -> map().
normalize_recipients(RecipientsByChannel) ->
    maps:from_list([
        {
            validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
            [validation:snowflake_or_throw(<<"recipient_id">>, RBin) || RBin <- Recipients]
        }
     || {ChannelIdBin, Recipients} <- maps:to_list(RecipientsByChannel)
    ]).

-spec handle_offline_dispatch(atom(), integer(), map()) -> true.
handle_offline_dispatch(message_create, UserId, Data) ->
    AuthorIdBin = maps:get(<<"id">>, maps:get(<<"author">>, Data, #{}), undefined),
    AuthorId = validation:snowflake_or_throw(<<"author_id">>, AuthorIdBin),
    push:handle_message_create(#{
        message_data => Data,
        user_ids => [UserId],
        guild_id => 0,
        author_id => AuthorId
    }),
    true;
handle_offline_dispatch(relationship_add, UserId, _Data) ->
    sync_blocked_ids_for_user(UserId),
    true;
handle_offline_dispatch(relationship_remove, UserId, _Data) ->
    sync_blocked_ids_for_user(UserId),
    true;
handle_offline_dispatch(_Event, _UserId, _Data) ->
    true.

-spec sync_blocked_ids_for_user(integer()) -> ok.
sync_blocked_ids_for_user(_UserId) ->
    ok.

-ifdef(TEST).

normalize_recipients_test() ->
    Input = #{<<"123">> => [<<"456">>, <<"789">>]},
    Result = normalize_recipients(Input),
    ?assert(is_map(Result)),
    ?assertEqual(1, maps:size(Result)).

-endif.
