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

-module(process_memory_stats).

-export([get_guild_memory_stats/1]).

-type guild_stats() :: #{
    guild_id := binary() | null,
    guild_name := binary(),
    guild_icon := binary() | null,
    memory := non_neg_integer(),
    member_count := non_neg_integer(),
    session_count := non_neg_integer(),
    presence_count := non_neg_integer()
}.

-spec get_guild_memory_stats(pos_integer()) -> [guild_stats()].
get_guild_memory_stats(Limit) ->
    AllProcesses = erlang:processes(),
    GuildProcessInfos = lists:filtermap(
        fun(Pid) ->
            case get_guild_process_info(Pid) of
                undefined -> false;
                Info -> {true, Info}
            end
        end,
        AllProcesses
    ),
    Sorted = lists:sort(
        fun(#{memory := M1}, #{memory := M2}) -> M1 >= M2 end,
        GuildProcessInfos
    ),
    lists:sublist(Sorted, Limit).

-spec get_guild_process_info(pid()) -> guild_stats() | undefined.
get_guild_process_info(Pid) ->
    case erlang:process_info(Pid, [registered_name, memory, initial_call, dictionary]) of
        undefined ->
            undefined;
        InfoList ->
            Memory = proplists:get_value(memory, InfoList, 0),
            InitialCall = proplists:get_value(initial_call, InfoList),
            Dictionary = proplists:get_value(dictionary, InfoList, []),
            Module = extract_module(InitialCall, Dictionary),
            case Module of
                guild -> extract_guild_stats(Pid, Memory);
                _ -> undefined
            end
    end.

-spec extract_module(tuple() | undefined, list()) -> atom() | undefined.
extract_module(InitialCall, Dictionary) ->
    case lists:keyfind('$initial_call', 1, Dictionary) of
        {'$initial_call', {M, _, _}} ->
            M;
        _ ->
            case InitialCall of
                {M, _, _} -> M;
                _ -> undefined
            end
    end.

-spec extract_guild_stats(pid(), non_neg_integer()) -> guild_stats() | undefined.
extract_guild_stats(Pid, Memory) ->
    case catch sys:get_state(Pid, 100) of
        State when is_map(State) ->
            GuildId = maps:get(id, State, undefined),
            Data = maps:get(data, State, #{}),
            Guild = maps:get(<<"guild">>, Data, #{}),
            GuildName = maps:get(<<"name">>, Guild, <<"Unknown">>),
            GuildIcon = maps:get(<<"icon">>, Guild, null),
            MemberCount = guild_data_index:member_count(Data),
            SessionCount = map_size(maps:get(sessions, State, #{})),
            PresenceCount = map_size(maps:get(presences, State, #{})),
            #{
                guild_id =>
                    case GuildId of
                        undefined -> null;
                        Id -> integer_to_binary(Id)
                    end,
                guild_name => GuildName,
                guild_icon => GuildIcon,
                memory => Memory,
                member_count => MemberCount,
                session_count => SessionCount,
                presence_count => PresenceCount
            };
        _ ->
            undefined
    end.
