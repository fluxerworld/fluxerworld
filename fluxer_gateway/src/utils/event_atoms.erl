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

-module(event_atoms).

-export([normalize/1]).

-spec normalize(binary() | atom()) -> atom() | binary().
normalize(Event) when is_atom(Event) ->
    Event;
normalize(EventBinary) when is_binary(EventBinary) ->
    Lowercase = string:lowercase(EventBinary),
    try
        binary_to_existing_atom(Lowercase, utf8)
    catch
        error:badarg ->
            EventBinary
    end.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

normalize_atom_test() ->
    ?assertEqual(test_event, normalize(test_event)),
    ?assertEqual(message_create, normalize(message_create)).

normalize_binary_existing_atom_test() ->
    _ = message_create,
    ?assertEqual(message_create, normalize(<<"MESSAGE_CREATE">>)),
    ?assertEqual(message_create, normalize(<<"message_create">>)).

normalize_binary_unknown_test() ->
    Result = normalize(<<"UNKNOWN_EVENT_XYZ_12345">>),
    ?assertEqual(<<"UNKNOWN_EVENT_XYZ_12345">>, Result).

-endif.
