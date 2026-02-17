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

-module(gateway_errors).

-compile({no_auto_import, [error/1]}).

-export([
    error/1,
    error_code/1,
    error_message/1,
    error_category/1,
    is_recoverable/1
]).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").
-endif.

-type error_atom() ::
    voice_connection_not_found
    | voice_channel_not_found
    | voice_channel_not_voice
    | voice_member_not_found
    | voice_user_not_in_voice
    | voice_guild_not_found
    | voice_permission_denied
    | voice_member_timed_out
    | voice_channel_full
    | voice_missing_connection_id
    | voice_invalid_user_id
    | voice_invalid_channel_id
    | voice_invalid_state
    | voice_user_mismatch
    | voice_token_failed
    | voice_guild_id_missing
    | voice_invalid_guild_id
    | voice_moderator_missing_connect
    | voice_unclaimed_account
    | voice_update_rate_limited
    | voice_nonce_mismatch
    | voice_pending_expired
    | voice_camera_user_limit
    | dm_channel_not_found
    | dm_not_recipient
    | dm_invalid_channel_type
    | validation_invalid_snowflake
    | validation_null_snowflake
    | validation_invalid_snowflake_list
    | validation_expected_list
    | validation_expected_map
    | validation_missing_field
    | validation_invalid_params
    | internal_error
    | timeout
    | unknown_error
    | atom().

-type error_category() ::
    not_found
    | validation_error
    | permission_denied
    | voice_error
    | rate_limited
    | timeout
    | unknown
    | auth_failed.

-spec error(error_atom()) -> {error, error_category(), error_atom()}.
error(ErrorAtom) ->
    {error, error_category(ErrorAtom), ErrorAtom}.

-spec error_code(error_atom()) -> binary().
error_code(voice_connection_not_found) -> <<"VOICE_CONNECTION_NOT_FOUND">>;
error_code(voice_channel_not_found) -> <<"VOICE_CHANNEL_NOT_FOUND">>;
error_code(voice_channel_not_voice) -> <<"VOICE_INVALID_CHANNEL_TYPE">>;
error_code(voice_member_not_found) -> <<"VOICE_MEMBER_NOT_FOUND">>;
error_code(voice_user_not_in_voice) -> <<"VOICE_USER_NOT_IN_VOICE">>;
error_code(voice_guild_not_found) -> <<"VOICE_GUILD_NOT_FOUND">>;
error_code(voice_permission_denied) -> <<"VOICE_PERMISSION_DENIED">>;
error_code(voice_member_timed_out) -> <<"VOICE_MEMBER_TIMED_OUT">>;
error_code(voice_channel_full) -> <<"VOICE_CHANNEL_FULL">>;
error_code(voice_missing_connection_id) -> <<"VOICE_MISSING_CONNECTION_ID">>;
error_code(voice_invalid_user_id) -> <<"VOICE_INVALID_USER_ID">>;
error_code(voice_invalid_channel_id) -> <<"VOICE_INVALID_CHANNEL_ID">>;
error_code(voice_invalid_state) -> <<"VOICE_INVALID_STATE">>;
error_code(voice_user_mismatch) -> <<"VOICE_USER_MISMATCH">>;
error_code(voice_token_failed) -> <<"VOICE_TOKEN_FAILED">>;
error_code(voice_guild_id_missing) -> <<"VOICE_GUILD_ID_MISSING">>;
error_code(voice_invalid_guild_id) -> <<"VOICE_INVALID_GUILD_ID">>;
error_code(voice_moderator_missing_connect) -> <<"VOICE_PERMISSION_DENIED">>;
error_code(voice_unclaimed_account) -> <<"VOICE_UNCLAIMED_ACCOUNT">>;
error_code(voice_update_rate_limited) -> <<"VOICE_UPDATE_RATE_LIMITED">>;
error_code(voice_nonce_mismatch) -> <<"VOICE_NONCE_MISMATCH">>;
error_code(voice_pending_expired) -> <<"VOICE_PENDING_EXPIRED">>;
error_code(voice_camera_user_limit) -> <<"VOICE_CAMERA_USER_LIMIT">>;
error_code(dm_channel_not_found) -> <<"DM_CHANNEL_NOT_FOUND">>;
error_code(dm_not_recipient) -> <<"DM_NOT_RECIPIENT">>;
error_code(dm_invalid_channel_type) -> <<"DM_INVALID_CHANNEL_TYPE">>;
error_code(validation_invalid_snowflake) -> <<"VALIDATION_INVALID_SNOWFLAKE">>;
error_code(validation_null_snowflake) -> <<"VALIDATION_NULL_SNOWFLAKE">>;
error_code(validation_invalid_snowflake_list) -> <<"VALIDATION_INVALID_SNOWFLAKE_LIST">>;
error_code(validation_expected_list) -> <<"VALIDATION_EXPECTED_LIST">>;
error_code(validation_expected_map) -> <<"VALIDATION_EXPECTED_MAP">>;
error_code(validation_missing_field) -> <<"VALIDATION_MISSING_FIELD">>;
error_code(validation_invalid_params) -> <<"VALIDATION_INVALID_PARAMS">>;
error_code(internal_error) -> <<"INTERNAL_ERROR">>;
error_code(timeout) -> <<"TIMEOUT">>;
error_code(unknown_error) -> <<"UNKNOWN_ERROR">>;
error_code(_) -> <<"UNKNOWN_ERROR">>.

-spec error_message(error_atom()) -> binary().
error_message(voice_connection_not_found) -> <<"Voice connection not found">>;
error_message(voice_channel_not_found) -> <<"Voice channel not found">>;
error_message(voice_channel_not_voice) -> <<"Channel is not a voice channel">>;
error_message(voice_member_not_found) -> <<"Member not found">>;
error_message(voice_user_not_in_voice) -> <<"User is not in a voice channel">>;
error_message(voice_guild_not_found) -> <<"Guild not found">>;
error_message(voice_permission_denied) -> <<"Missing voice permissions">>;
error_message(voice_member_timed_out) -> <<"Voice member is timed out">>;
error_message(voice_channel_full) -> <<"Voice channel is full">>;
error_message(voice_missing_connection_id) -> <<"Connection ID is required">>;
error_message(voice_invalid_user_id) -> <<"Invalid user ID">>;
error_message(voice_invalid_channel_id) -> <<"Invalid channel ID">>;
error_message(voice_invalid_state) -> <<"Invalid voice state">>;
error_message(voice_user_mismatch) -> <<"User does not match connection">>;
error_message(voice_token_failed) -> <<"Failed to obtain voice token">>;
error_message(voice_guild_id_missing) -> <<"Guild ID is required">>;
error_message(voice_invalid_guild_id) -> <<"Invalid guild ID">>;
error_message(voice_moderator_missing_connect) -> <<"Moderator missing connect permission">>;
error_message(voice_unclaimed_account) -> <<"Claim your account to join voice">>;
error_message(voice_update_rate_limited) -> <<"Voice updates are rate limited">>;
error_message(voice_nonce_mismatch) -> <<"Voice token nonce mismatch">>;
error_message(voice_pending_expired) -> <<"Voice pending connection expired">>;
error_message(voice_camera_user_limit) -> <<"Too many users in channel to enable camera">>;
error_message(dm_channel_not_found) -> <<"DM channel not found">>;
error_message(dm_not_recipient) -> <<"Not a recipient of this channel">>;
error_message(dm_invalid_channel_type) -> <<"Not a DM or Group DM channel">>;
error_message(validation_invalid_snowflake) -> <<"Invalid snowflake ID format">>;
error_message(validation_null_snowflake) -> <<"Snowflake ID cannot be null">>;
error_message(validation_invalid_snowflake_list) -> <<"Invalid snowflake ID in list">>;
error_message(validation_expected_list) -> <<"Expected a list">>;
error_message(validation_expected_map) -> <<"Expected a map">>;
error_message(validation_missing_field) -> <<"Missing required field">>;
error_message(validation_invalid_params) -> <<"Invalid parameters">>;
error_message(internal_error) -> <<"Internal server error">>;
error_message(timeout) -> <<"Request timed out">>;
error_message(unknown_error) -> <<"An unknown error occurred">>;
error_message(_) -> <<"An unknown error occurred">>.

-spec error_category(error_atom()) -> error_category().
error_category(voice_connection_not_found) -> not_found;
error_category(voice_channel_not_found) -> not_found;
error_category(voice_channel_not_voice) -> validation_error;
error_category(voice_member_not_found) -> not_found;
error_category(voice_user_not_in_voice) -> not_found;
error_category(voice_guild_not_found) -> not_found;
error_category(voice_permission_denied) -> permission_denied;
error_category(voice_member_timed_out) -> permission_denied;
error_category(voice_channel_full) -> permission_denied;
error_category(voice_missing_connection_id) -> validation_error;
error_category(voice_invalid_user_id) -> validation_error;
error_category(voice_invalid_channel_id) -> validation_error;
error_category(voice_invalid_state) -> validation_error;
error_category(voice_user_mismatch) -> validation_error;
error_category(voice_token_failed) -> voice_error;
error_category(voice_guild_id_missing) -> validation_error;
error_category(voice_invalid_guild_id) -> validation_error;
error_category(voice_moderator_missing_connect) -> permission_denied;
error_category(voice_unclaimed_account) -> permission_denied;
error_category(voice_update_rate_limited) -> rate_limited;
error_category(voice_nonce_mismatch) -> validation_error;
error_category(voice_pending_expired) -> validation_error;
error_category(voice_camera_user_limit) -> permission_denied;
error_category(dm_channel_not_found) -> not_found;
error_category(dm_not_recipient) -> permission_denied;
error_category(dm_invalid_channel_type) -> validation_error;
error_category(validation_invalid_snowflake) -> validation_error;
error_category(validation_null_snowflake) -> validation_error;
error_category(validation_invalid_snowflake_list) -> validation_error;
error_category(validation_expected_list) -> validation_error;
error_category(validation_expected_map) -> validation_error;
error_category(validation_missing_field) -> validation_error;
error_category(validation_invalid_params) -> validation_error;
error_category(internal_error) -> unknown;
error_category(timeout) -> timeout;
error_category(unknown_error) -> unknown;
error_category(_) -> unknown.

-spec is_recoverable(error_category()) -> boolean().
is_recoverable(not_found) -> true;
is_recoverable(permission_denied) -> true;
is_recoverable(voice_error) -> true;
is_recoverable(validation_error) -> true;
is_recoverable(timeout) -> true;
is_recoverable(unknown) -> true;
is_recoverable(rate_limited) -> false;
is_recoverable(auth_failed) -> false;
is_recoverable(_) -> true.

-ifdef(TEST).

error_test() ->
    ?assertEqual({error, not_found, voice_connection_not_found}, error(voice_connection_not_found)),
    ?assertEqual(
        {error, validation_error, voice_channel_not_voice}, error(voice_channel_not_voice)
    ),
    ?assertEqual(
        {error, permission_denied, voice_permission_denied}, error(voice_permission_denied)
    ).

error_code_test() ->
    ?assertEqual(<<"VOICE_CONNECTION_NOT_FOUND">>, error_code(voice_connection_not_found)),
    ?assertEqual(<<"VOICE_CHANNEL_NOT_FOUND">>, error_code(voice_channel_not_found)),
    ?assertEqual(<<"VOICE_PERMISSION_DENIED">>, error_code(voice_permission_denied)),
    ?assertEqual(<<"VOICE_PERMISSION_DENIED">>, error_code(voice_moderator_missing_connect)),
    ?assertEqual(<<"UNKNOWN_ERROR">>, error_code(some_random_error)),
    ?assertEqual(<<"TIMEOUT">>, error_code(timeout)),
    ?assertEqual(<<"INTERNAL_ERROR">>, error_code(internal_error)).

error_message_test() ->
    ?assertEqual(<<"Voice connection not found">>, error_message(voice_connection_not_found)),
    ?assertEqual(<<"Voice channel not found">>, error_message(voice_channel_not_found)),
    ?assertEqual(<<"Missing voice permissions">>, error_message(voice_permission_denied)),
    ?assertEqual(<<"Voice channel is full">>, error_message(voice_channel_full)),
    ?assertEqual(<<"An unknown error occurred">>, error_message(some_random_error)),
    ?assertEqual(<<"Request timed out">>, error_message(timeout)).

error_category_test() ->
    ?assertEqual(not_found, error_category(voice_connection_not_found)),
    ?assertEqual(not_found, error_category(voice_channel_not_found)),
    ?assertEqual(not_found, error_category(dm_channel_not_found)),
    ?assertEqual(validation_error, error_category(voice_channel_not_voice)),
    ?assertEqual(validation_error, error_category(validation_invalid_snowflake)),
    ?assertEqual(permission_denied, error_category(voice_permission_denied)),
    ?assertEqual(permission_denied, error_category(voice_channel_full)),
    ?assertEqual(voice_error, error_category(voice_token_failed)),
    ?assertEqual(rate_limited, error_category(voice_update_rate_limited)),
    ?assertEqual(timeout, error_category(timeout)),
    ?assertEqual(unknown, error_category(unknown_error)),
    ?assertEqual(unknown, error_category(some_random_error)).

is_recoverable_test() ->
    ?assert(is_recoverable(not_found)),
    ?assert(is_recoverable(permission_denied)),
    ?assert(is_recoverable(voice_error)),
    ?assert(is_recoverable(validation_error)),
    ?assert(is_recoverable(timeout)),
    ?assert(is_recoverable(unknown)),
    ?assertNot(is_recoverable(rate_limited)),
    ?assertNot(is_recoverable(auth_failed)).

all_voice_errors_have_codes_test() ->
    VoiceErrors = [
        voice_connection_not_found,
        voice_channel_not_found,
        voice_channel_not_voice,
        voice_member_not_found,
        voice_user_not_in_voice,
        voice_guild_not_found,
        voice_permission_denied,
        voice_member_timed_out,
        voice_channel_full,
        voice_missing_connection_id,
        voice_invalid_user_id,
        voice_invalid_channel_id,
        voice_invalid_state,
        voice_user_mismatch,
        voice_token_failed,
        voice_guild_id_missing,
        voice_invalid_guild_id,
        voice_moderator_missing_connect,
        voice_unclaimed_account,
        voice_update_rate_limited,
        voice_nonce_mismatch,
        voice_pending_expired,
        voice_camera_user_limit
    ],
    lists:foreach(
        fun(Error) ->
            Code = error_code(Error),
            ?assert(is_binary(Code)),
            ?assertNotEqual(<<"UNKNOWN_ERROR">>, Code)
        end,
        VoiceErrors
    ).

all_dm_errors_have_codes_test() ->
    DmErrors = [dm_channel_not_found, dm_not_recipient, dm_invalid_channel_type],
    lists:foreach(
        fun(Error) ->
            Code = error_code(Error),
            ?assert(is_binary(Code)),
            ?assertNotEqual(<<"UNKNOWN_ERROR">>, Code)
        end,
        DmErrors
    ).

all_validation_errors_have_codes_test() ->
    ValidationErrors = [
        validation_invalid_snowflake,
        validation_null_snowflake,
        validation_invalid_snowflake_list,
        validation_expected_list,
        validation_expected_map,
        validation_missing_field,
        validation_invalid_params
    ],
    lists:foreach(
        fun(Error) ->
            Code = error_code(Error),
            ?assert(is_binary(Code)),
            ?assertNotEqual(<<"UNKNOWN_ERROR">>, Code)
        end,
        ValidationErrors
    ).

-endif.
