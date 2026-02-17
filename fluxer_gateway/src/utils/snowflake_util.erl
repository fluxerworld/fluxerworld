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

-module(snowflake_util).

-export([extract_timestamp/1]).

-define(FLUXER_EPOCH, 1420070400000).
-define(TIMESTAMP_SHIFT, 22).

-spec extract_timestamp(binary() | integer()) -> integer().
extract_timestamp(SnowflakeBin) when is_binary(SnowflakeBin) ->
    Snowflake = binary_to_integer(SnowflakeBin),
    extract_timestamp(Snowflake);
extract_timestamp(Snowflake) when is_integer(Snowflake) ->
    (Snowflake bsr ?TIMESTAMP_SHIFT) + ?FLUXER_EPOCH.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

extract_timestamp_from_integer_test() ->
    Timestamp = 1704067200000,
    RelativeTs = Timestamp - ?FLUXER_EPOCH,
    Snowflake = RelativeTs bsl ?TIMESTAMP_SHIFT,
    ?assertEqual(Timestamp, extract_timestamp(Snowflake)).

extract_timestamp_from_binary_test() ->
    Timestamp = 1704067200000,
    RelativeTs = Timestamp - ?FLUXER_EPOCH,
    Snowflake = RelativeTs bsl ?TIMESTAMP_SHIFT,
    SnowflakeBin = integer_to_binary(Snowflake),
    ?assertEqual(Timestamp, extract_timestamp(SnowflakeBin)).

extract_timestamp_with_worker_and_sequence_test() ->
    Timestamp = 1704067200000,
    RelativeTs = Timestamp - ?FLUXER_EPOCH,
    WorkerId = 5,
    Sequence = 100,
    Snowflake = (RelativeTs bsl ?TIMESTAMP_SHIFT) bor (WorkerId bsl 12) bor Sequence,
    ?assertEqual(Timestamp, extract_timestamp(Snowflake)).

-endif.
