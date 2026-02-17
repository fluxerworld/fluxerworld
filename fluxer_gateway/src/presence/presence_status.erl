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

-module(presence_status).

-export([
    get_current_status/1,
    get_flattened_mobile/1,
    get_flattened_afk/1,
    collect_sessions_for_replace/1
]).

-type session_id() :: binary().
-type status() :: online | offline | idle | dnd | invisible.
-type session_entry() :: #{status := status(), afk := boolean(), mobile := boolean(), _ => _}.
-type sessions() :: #{session_id() => session_entry()}.

-spec get_current_status(sessions()) -> status().
get_current_status(Sessions) ->
    AllStatuses = [maps:get(status, S) || S <- maps:values(Sessions)],
    case lists:member(invisible, AllStatuses) of
        true ->
            invisible;
        false ->
            StatusPrecedence = [online, dnd, idle],
            lists:foldl(
                fun(Status, Acc) ->
                    case Acc of
                        offline ->
                            case lists:member(Status, AllStatuses) of
                                true -> Status;
                                false -> Acc
                            end;
                        _ ->
                            Acc
                    end
                end,
                offline,
                StatusPrecedence
            )
    end.

-spec get_flattened_mobile(sessions()) -> boolean().
get_flattened_mobile(Sessions) ->
    lists:any(
        fun(Session) ->
            maps:get(mobile, Session, false)
        end,
        maps:values(Sessions)
    ).

-spec get_flattened_afk(sessions()) -> boolean().
get_flattened_afk(Sessions) ->
    HasMobile = lists:any(
        fun(Session) ->
            maps:get(mobile, Session, false)
        end,
        maps:values(Sessions)
    ),
    case HasMobile of
        true ->
            false;
        false ->
            case maps:size(Sessions) of
                0 ->
                    false;
                _ ->
                    lists:all(
                        fun(Session) ->
                            maps:get(afk, Session, false)
                        end,
                        maps:values(Sessions)
                    )
            end
    end.

-spec collect_sessions_for_replace(sessions()) -> [map()].
collect_sessions_for_replace(Sessions) ->
    Status = get_current_status(Sessions),
    Mobile = get_flattened_mobile(Sessions),
    Afk = get_flattened_afk(Sessions),
    BaseSessions = [
        #{
            <<"session_id">> => <<"all">>,
            <<"status">> => constants:status_type_atom(Status),
            <<"mobile">> => Mobile,
            <<"afk">> => Afk
        }
    ],
    SessionEntries = lists:map(
        fun({SessionId, Session}) ->
            #{
                <<"session_id">> => SessionId,
                <<"status">> => constants:status_type_atom(maps:get(status, Session)),
                <<"afk">> => maps:get(afk, Session, false),
                <<"mobile">> => maps:get(mobile, Session, false)
            }
        end,
        maps:to_list(Sessions)
    ),
    BaseSessions ++ SessionEntries.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

get_current_status_empty_test() ->
    ?assertEqual(offline, get_current_status(#{})).

get_current_status_online_test() ->
    Sessions = #{<<"s1">> => #{status => online, afk => false, mobile => false}},
    ?assertEqual(online, get_current_status(Sessions)).

get_current_status_precedence_test() ->
    Sessions = #{
        <<"s1">> => #{status => idle, afk => false, mobile => false},
        <<"s2">> => #{status => online, afk => false, mobile => false}
    },
    ?assertEqual(online, get_current_status(Sessions)).

get_current_status_dnd_over_idle_test() ->
    Sessions = #{
        <<"s1">> => #{status => idle, afk => false, mobile => false},
        <<"s2">> => #{status => dnd, afk => false, mobile => false}
    },
    ?assertEqual(dnd, get_current_status(Sessions)).

get_current_status_invisible_test() ->
    Sessions = #{
        <<"s1">> => #{status => invisible, afk => false, mobile => false},
        <<"s2">> => #{status => online, afk => false, mobile => false}
    },
    ?assertEqual(invisible, get_current_status(Sessions)).

get_flattened_mobile_true_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => false, mobile => true},
        <<"s2">> => #{status => online, afk => false, mobile => false}
    },
    ?assertEqual(true, get_flattened_mobile(Sessions)).

get_flattened_mobile_false_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => false, mobile => false}
    },
    ?assertEqual(false, get_flattened_mobile(Sessions)).

get_flattened_mobile_empty_test() ->
    ?assertEqual(false, get_flattened_mobile(#{})).

get_flattened_afk_all_afk_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => true, mobile => false},
        <<"s2">> => #{status => online, afk => true, mobile => false}
    },
    ?assertEqual(true, get_flattened_afk(Sessions)).

get_flattened_afk_some_not_afk_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => true, mobile => false},
        <<"s2">> => #{status => online, afk => false, mobile => false}
    },
    ?assertEqual(false, get_flattened_afk(Sessions)).

get_flattened_afk_mobile_overrides_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => true, mobile => true}
    },
    ?assertEqual(false, get_flattened_afk(Sessions)).

get_flattened_afk_empty_test() ->
    ?assertEqual(false, get_flattened_afk(#{})).

collect_sessions_for_replace_test() ->
    Sessions = #{
        <<"s1">> => #{status => online, afk => false, mobile => false}
    },
    Result = collect_sessions_for_replace(Sessions),
    ?assertEqual(2, length(Result)),
    [AllSession | Rest] = Result,
    ?assertEqual(<<"all">>, maps:get(<<"session_id">>, AllSession)),
    ?assertEqual(1, length(Rest)).
-endif.
