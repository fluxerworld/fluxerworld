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

-module(gateway_rpc_call).

-export([execute_method/2]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-define(CALL_LOOKUP_TIMEOUT, 2000).
-define(CALL_CREATE_TIMEOUT, 10000).

-spec execute_method(binary(), map()) -> term().
execute_method(<<"call.get">>, #{<<"channel_id">> := ChannelIdBin}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    case lookup_call(ChannelId) of
        {ok, Pid} ->
            case gen_server:call(Pid, {get_state}, ?CALL_LOOKUP_TIMEOUT) of
                {ok, CallData} -> CallData;
                _ -> throw({error, <<"call_state_error">>})
            end;
        not_found ->
            null
    end;
execute_method(<<"call.get_pending_joins">>, #{<<"channel_id">> := ChannelIdBin}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    case lookup_call(ChannelId) of
        {ok, Pid} ->
            case gen_server:call(Pid, {get_pending_connections}, ?CALL_LOOKUP_TIMEOUT) of
                #{pending_joins := PendingJoins} ->
                    #{<<"pending_joins">> => PendingJoins};
                _ ->
                    throw({error, <<"call_pending_joins_error">>})
            end;
        not_found ->
            #{<<"pending_joins">> => []}
    end;
execute_method(<<"call.create">>, Params) ->
    #{
        <<"channel_id">> := ChannelIdBin,
        <<"message_id">> := MessageIdBin,
        <<"region">> := Region,
        <<"ringing">> := RingingBins,
        <<"recipients">> := RecipientsBins
    } = Params,
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    MessageId = validation:snowflake_or_throw(<<"message_id">>, MessageIdBin),
    Ringing = validation:snowflake_list_or_throw(<<"ringing">>, RingingBins),
    Recipients = validation:snowflake_list_or_throw(<<"recipients">>, RecipientsBins),
    CallData = #{
        channel_id => ChannelId,
        message_id => MessageId,
        region => Region,
        ringing => Ringing,
        recipients => Recipients
    },
    case gen_server:call(call_manager, {create, ChannelId, CallData}, ?CALL_CREATE_TIMEOUT) of
        {ok, Pid} ->
            case gen_server:call(Pid, {get_state}, ?CALL_LOOKUP_TIMEOUT) of
                {ok, CallState} -> CallState;
                _ -> throw({error, <<"call_state_error">>})
            end;
        {error, already_exists} ->
            throw({error, <<"call_already_exists">>});
        {error, Reason} ->
            throw({error, iolist_to_binary(io_lib:format("create_call_error: ~p", [Reason]))})
    end;
execute_method(<<"call.update_region">>, #{<<"channel_id">> := ChannelIdBin, <<"region">> := Region}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    with_call(ChannelId, fun(Pid) ->
        case gen_server:call(Pid, {update_region, Region}, ?CALL_LOOKUP_TIMEOUT) of
            ok -> true;
            _ -> throw({error, <<"update_region_error">>})
        end
    end);
execute_method(<<"call.ring">>, #{
    <<"channel_id">> := ChannelIdBin, <<"recipients">> := RecipientsBin
}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    Recipients = validation:snowflake_list_or_throw(<<"recipients">>, RecipientsBin),
    with_call(ChannelId, fun(Pid) ->
        case gen_server:call(Pid, {ring_recipients, Recipients}, ?CALL_LOOKUP_TIMEOUT) of
            ok -> true;
            _ -> throw({error, <<"ring_recipients_error">>})
        end
    end);
execute_method(<<"call.stop_ringing">>, #{
    <<"channel_id">> := ChannelIdBin, <<"recipients">> := RecipientsBin
}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    Recipients = validation:snowflake_list_or_throw(<<"recipients">>, RecipientsBin),
    with_call(ChannelId, fun(Pid) ->
        case gen_server:call(Pid, {stop_ringing, Recipients}, ?CALL_LOOKUP_TIMEOUT) of
            ok -> true;
            _ -> throw({error, <<"stop_ringing_error">>})
        end
    end);
execute_method(<<"call.join">>, #{
    <<"channel_id">> := ChannelIdBin,
    <<"user_id">> := UserIdBin,
    <<"session_id">> := SessionIdBin,
    <<"voice_state">> := VoiceState
}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    SessionId = SessionIdBin,
    case session_manager:lookup(SessionId) of
        {ok, SessionPid} ->
            with_call(ChannelId, fun(CallPid) ->
                gen_server:cast(CallPid, {join_async, UserId, VoiceState, SessionId, SessionPid}),
                true
            end);
        {error, not_found} ->
            throw({error, <<"session_not_found">>})
    end;
execute_method(<<"call.leave">>, #{<<"channel_id">> := ChannelIdBin, <<"session_id">> := SessionId}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    with_call(ChannelId, fun(Pid) ->
        case gen_server:call(Pid, {leave, SessionId}, ?CALL_LOOKUP_TIMEOUT) of
            ok -> true;
            _ -> throw({error, <<"leave_call_error">>})
        end
    end);
execute_method(<<"call.delete">>, #{<<"channel_id">> := ChannelIdBin}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    case gen_server:call(call_manager, {terminate_call, ChannelId}, ?CALL_LOOKUP_TIMEOUT) of
        ok -> true;
        {error, not_found} -> throw({error, <<"call_not_found">>});
        _ -> throw({error, <<"delete_call_error">>})
    end;
execute_method(<<"call.confirm_connection">>, #{
    <<"channel_id">> := ChannelIdBin, <<"connection_id">> := ConnectionId
}) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    case lookup_call(ChannelId) of
        {ok, Pid} ->
            gen_server:call(Pid, {confirm_connection, ConnectionId}, ?CALL_LOOKUP_TIMEOUT);
        not_found ->
            #{success => true, call_not_found => true}
    end;
execute_method(
    <<"call.disconnect_user_if_in_channel">>,
    #{<<"channel_id">> := ChannelIdBin, <<"user_id">> := UserIdBin} = Params
) ->
    ChannelId = validation:snowflake_or_throw(<<"channel_id">>, ChannelIdBin),
    UserId = validation:snowflake_or_throw(<<"user_id">>, UserIdBin),
    ConnectionId = maps:get(<<"connection_id">>, Params, undefined),
    case lookup_call(ChannelId) of
        {ok, Pid} ->
            gen_server:call(
                Pid,
                {disconnect_user_if_in_channel, UserId, ChannelId, ConnectionId},
                ?CALL_LOOKUP_TIMEOUT
            );
        not_found ->
            #{success => true, call_not_found => true}
    end.

-spec lookup_call(integer()) -> {ok, pid()} | not_found.
lookup_call(ChannelId) ->
    case gen_server:call(call_manager, {lookup, ChannelId}, ?CALL_LOOKUP_TIMEOUT) of
        {ok, Pid} -> {ok, Pid};
        {error, not_found} -> not_found;
        not_found -> not_found
    end.

-spec with_call(integer(), fun((pid()) -> T)) -> T when T :: term().
with_call(ChannelId, Fun) ->
    case lookup_call(ChannelId) of
        {ok, Pid} -> Fun(Pid);
        not_found -> throw({error, <<"call_not_found">>})
    end.

-ifdef(TEST).

-endif.
