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

-module(push_sender).

-export([send_to_user_subscriptions/9, send_push_notifications/8]).

-define(PUSH_TTL, <<"86400">>).
-define(STANDARD_PUSH_RECORD_SIZE, 4096).
-define(MOZILLA_COMPAT_PUSH_RECORD_SIZE, 2820).
-define(MOZILLA_CONSTRAINED_PUSH_RECORD_SIZE, 2048).
-define(MIN_PUSH_RECORD_SIZE, 1024).
-define(MAX_PAYLOAD_RETRY_ATTEMPTS, 2).

-spec send_to_user_subscriptions(
    integer(),
    list(),
    map(),
    integer(),
    integer(),
    integer(),
    binary() | undefined,
    binary() | undefined,
    non_neg_integer()
) -> ok.
send_to_user_subscriptions(
    UserId,
    Subscriptions,
    MessageData,
    GuildId,
    ChannelId,
    MessageId,
    GuildName,
    ChannelName,
    BadgeCount
) ->
    AuthorData = maps:get(<<"author">>, MessageData, #{}),
    AuthorUsername = maps:get(<<"username">>, AuthorData, <<"Unknown">>),
    AuthorAvatar = maps:get(<<"avatar">>, AuthorData, null),
    AuthorAvatarUrl =
        case AuthorAvatar of
            null -> push_utils:get_default_avatar_url(maps:get(<<"id">>, AuthorData, <<"0">>));
            Hash -> push_utils:construct_avatar_url(maps:get(<<"id">>, AuthorData, <<"0">>), Hash)
        end,
    NotificationPayload = push_notification:build_notification_payload(
        MessageData,
        GuildId,
        ChannelId,
        MessageId,
        GuildName,
        ChannelName,
        AuthorUsername,
        AuthorAvatarUrl,
        UserId,
        BadgeCount
    ),
    logger:debug(
        "Push: sending to user subscriptions",
        #{user_id => UserId, subscription_count => length(Subscriptions), badge_count => BadgeCount}
    ),
    case ensure_vapid_credentials() of
        {ok, VapidEmail, VapidPublicKey, VapidPrivateKey} ->
            FailedSubscriptions = lists:filtermap(
                fun(Sub) ->
                    send_notification_to_subscription(
                        UserId,
                        Sub,
                        NotificationPayload,
                        VapidEmail,
                        VapidPublicKey,
                        VapidPrivateKey
                    )
                end,
                Subscriptions
            ),
            case FailedSubscriptions of
                [] ->
                    logger:debug(
                        "Push: all subscriptions succeeded",
                        #{user_id => UserId}
                    ),
                    ok;
                _ ->
                    logger:debug(
                        "Push: removing failed subscriptions",
                        #{user_id => UserId, failed_count => length(FailedSubscriptions)}
                    ),
                    push_subscriptions:delete_failed_subscriptions(FailedSubscriptions)
            end;
        {error, Reason} ->
            logger:debug(
                "Push: VAPID credentials unavailable",
                #{user_id => UserId, reason => Reason}
            ),
            ok
    end.

-spec send_push_notifications(
    [integer()],
    map(),
    integer(),
    integer(),
    integer(),
    binary() | undefined,
    binary() | undefined,
    map()
) -> map().
send_push_notifications(
    UserIds, MessageData, GuildId, ChannelId, MessageId, GuildName, ChannelName, State
) ->
    logger:debug(
        "Push: send_push_notifications starting",
        #{
            message_id => MessageId,
            channel_id => ChannelId,
            guild_id => GuildId,
            user_count => length(UserIds)
        }
    ),
    {BadgeCounts, StateWithBadgeCounts} = ensure_badge_counts(UserIds, State),
    logger:debug(
        "Push: badge counts fetched",
        #{message_id => MessageId, badge_counts => BadgeCounts}
    ),
    {UncachedUsers, CachedState} = lists:foldl(
        fun(UserId, {Uncached, S}) ->
            Key = {subscriptions, UserId},
            PushSubscriptionsCache = maps:get(push_subscriptions_cache, S, #{}),
            case maps:is_key(Key, PushSubscriptionsCache) of
                true ->
                    Subscriptions = push_cache:get_user_push_subscriptions(UserId, S),
                    BadgeCount = maps:get(UserId, BadgeCounts, 0),
                    case Subscriptions of
                        [] ->
                            ok;
                        _ ->
                            send_to_user_subscriptions(
                                UserId,
                                Subscriptions,
                                MessageData,
                                GuildId,
                                ChannelId,
                                MessageId,
                                GuildName,
                                ChannelName,
                                BadgeCount
                            )
                    end,
                    {Uncached, S};
                false ->
                    {[UserId | Uncached], S}
            end
        end,
        {[], StateWithBadgeCounts},
        UserIds
    ),
    case UncachedUsers of
        [] ->
            logger:debug(
                "Push: all users had cached subscriptions",
                #{message_id => MessageId}
            ),
            CachedState;
        _ ->
            logger:debug(
                "Push: fetching subscriptions for uncached users",
                #{message_id => MessageId, uncached_count => length(UncachedUsers), uncached_user_ids => UncachedUsers}
            ),
            push_subscriptions:fetch_and_send_subscriptions(
                UncachedUsers,
                MessageData,
                GuildId,
                ChannelId,
                MessageId,
                GuildName,
                ChannelName,
                CachedState,
                BadgeCounts
            )
    end.

-spec ensure_badge_counts([integer()], map()) -> {map(), map()}.
ensure_badge_counts(UserIds, State) ->
    Now = erlang:system_time(second),
    TTL = maps:get(badge_counts_ttl_seconds, State, 0),
    {CachedCounts, Missing} =
        lists:foldl(
            fun(UserId, {Acc, MissingAcc}) ->
                case push_cache:get_user_badge_count(UserId, State) of
                    {Count, Timestamp} when TTL > 0, Now - Timestamp < TTL ->
                        {maps:put(UserId, Count, Acc), MissingAcc};
                    _ ->
                        {Acc, [UserId | MissingAcc]}
                end
            end,
            {#{}, []},
            UserIds
        ),
    UniqueMissing = lists:usort(Missing),
    case UniqueMissing of
        [] ->
            {CachedCounts, State};
        _ ->
            fetch_badge_counts(UniqueMissing, CachedCounts, State, Now)
    end.

-spec fetch_badge_counts([integer()], map(), map(), integer()) -> {map(), map()}.
fetch_badge_counts(UserIds, Counts, State, CachedAt) ->
    Request = #{
        <<"type">> => <<"get_badge_counts">>,
        <<"user_ids">> => [integer_to_binary(UserId) || UserId <- UserIds]
    },
    case rpc_client:call(Request) of
        {ok, Data} ->
            BadgeData = maps:get(<<"badge_counts">>, Data, #{}),
            lists:foldl(
                fun(UserId, {Acc, S}) ->
                    UserIdBin = integer_to_binary(UserId),
                    Count = normalize_badge_count(maps:get(UserIdBin, BadgeData, 0)),
                    NewState = push_cache:cache_user_badge_count(UserId, Count, CachedAt, S),
                    {maps:put(UserId, Count, Acc), NewState}
                end,
                {Counts, State},
                UserIds
            );
        {error, _Reason} ->
            {Counts, State}
    end.

-spec normalize_badge_count(integer() | term()) -> non_neg_integer().
normalize_badge_count(Value) when is_integer(Value), Value >= 0 ->
    Value;
normalize_badge_count(_) ->
    0.

-spec ensure_vapid_credentials() -> {ok, binary(), binary(), binary()} | {error, string()}.
ensure_vapid_credentials() ->
    Email = fluxer_gateway_env:get(vapid_email),
    Public = fluxer_gateway_env:get(vapid_public_key),
    Private = fluxer_gateway_env:get(vapid_private_key),
    case {Email, Public, Private} of
        {Email0, Public0, Private0} when
            is_binary(Email0),
            is_binary(Public0),
            is_binary(Private0),
            byte_size(Public0) > 0,
            byte_size(Private0) > 0
        ->
            {ok, Email0, Public0, Private0};
        _ ->
            {error, "Missing VAPID credentials"}
    end.

-spec send_notification_to_subscription(
    integer(), map(), map(), binary(), binary(), binary()
) -> false | {true, map()}.
send_notification_to_subscription(
    UserId,
    Subscription,
    Payload,
    VapidEmail,
    VapidPublicKey,
    VapidPrivateKey
) ->
    logger:debug(
        "Push: sending to subscription",
        #{user_id => UserId, endpoint => maps:get(<<"endpoint">>, Subscription, undefined)}
    ),
    case extract_subscription_fields(Subscription) of
        {ok, Endpoint, P256dhKey, AuthKey, SubscriptionId} ->
            VapidClaims = #{
                <<"sub">> => <<"mailto:", VapidEmail/binary>>,
                <<"aud">> => push_utils:extract_origin(Endpoint),
                <<"exp">> => erlang:system_time(second) + 43200
            },
            VapidTokenResult =
                try
                    {ok,
                        push_utils:generate_vapid_token(
                            VapidClaims, VapidPublicKey, VapidPrivateKey
                        )}
                catch
                    C:R ->
                        {error, {C, R}}
                end,
            case VapidTokenResult of
                {ok, VapidToken} ->
                    Headers = build_push_headers(VapidToken, VapidPublicKey),
                    PayloadJson = json:encode(Payload),
                    InitialRecordSize = initial_record_size_for_endpoint(Endpoint),
                    send_encrypted_push_notification(
                        UserId,
                        SubscriptionId,
                        Endpoint,
                        Headers,
                        PayloadJson,
                        P256dhKey,
                        AuthKey,
                        InitialRecordSize,
                        0
                    );
                {error, _} ->
                    otel_metrics:counter(<<"push.failure">>, 1, #{
                        <<"reason">> => <<"vapid_error">>,
                        <<"user_id">> => integer_to_binary(UserId)
                    }),
                    false
            end;
        {error, _Reason} ->
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"invalid_subscription">>,
                <<"user_id">> => integer_to_binary(UserId)
            }),
            false
    end.

-spec extract_subscription_fields(map()) ->
    {ok, binary(), binary(), binary(), binary()} | {error, string()}.
extract_subscription_fields(Subscription) ->
    Endpoint = maps:get(<<"endpoint">>, Subscription, undefined),
    P256dhKey = maps:get(<<"p256dh_key">>, Subscription, undefined),
    AuthKey = maps:get(<<"auth_key">>, Subscription, undefined),
    SubscriptionId = maps:get(<<"subscription_id">>, Subscription, undefined),
    case {Endpoint, P256dhKey, AuthKey, SubscriptionId} of
        {E, P, A, S} when
            is_binary(E), is_binary(P), is_binary(A), is_binary(S)
        ->
            {ok, E, P, A, S};
        _ ->
            {error, "missing keys"}
    end.

-spec build_push_headers(binary(), binary()) -> [{binary(), binary()}].
build_push_headers(VapidToken, VapidPublicKey) ->
    [
        {<<"TTL">>, ?PUSH_TTL},
        {<<"Content-Type">>, <<"application/octet-stream">>},
        {<<"Content-Encoding">>, <<"aes128gcm">>},
        {<<"Authorization">>, <<"vapid t=", VapidToken/binary, ", k=", VapidPublicKey/binary>>}
    ].

-spec send_encrypted_push_notification(
    integer(),
    binary(),
    binary(),
    [{binary(), binary()}],
    binary(),
    binary(),
    binary(),
    pos_integer(),
    non_neg_integer()
) -> false | {true, map()}.
send_encrypted_push_notification(
    UserId,
    SubscriptionId,
    Endpoint,
    Headers,
    PayloadJson,
    P256dhKey,
    AuthKey,
    RecordSize,
    Attempt
) ->
    case push_utils:encrypt_payload(PayloadJson, P256dhKey, AuthKey, RecordSize) of
        {ok, EncryptedBody} ->
            Response = request_push_endpoint(Endpoint, Headers, EncryptedBody),
            case maybe_retry_with_smaller_record_size(Endpoint, Response, RecordSize, Attempt) of
                {retry, NextRecordSize} ->
                    otel_metrics:counter(<<"push.retry_payload_resize">>, 1, #{
                        <<"user_id">> => integer_to_binary(UserId),
                        <<"from_record_size">> => integer_to_binary(RecordSize),
                        <<"to_record_size">> => integer_to_binary(NextRecordSize)
                    }),
                    send_encrypted_push_notification(
                        UserId,
                        SubscriptionId,
                        Endpoint,
                        Headers,
                        PayloadJson,
                        P256dhKey,
                        AuthKey,
                        NextRecordSize,
                        Attempt + 1
                    );
                no_retry ->
                    handle_push_response(UserId, SubscriptionId, Response)
            end;
        {error, _EncryptError} ->
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"encryption_error">>,
                <<"user_id">> => integer_to_binary(UserId)
            }),
            false
    end.

-spec request_push_endpoint(binary(), [{binary(), binary()}], binary()) ->
    {ok, non_neg_integer(), [{binary(), binary()}], binary()} | {error, term()}.
request_push_endpoint(Endpoint, Headers, Body) ->
    gateway_http_client:request(
        push,
        post,
        Endpoint,
        Headers,
        Body,
        #{content_type => <<"application/octet-stream">>}
    ).

-spec maybe_retry_with_smaller_record_size(binary(), term(), pos_integer(), non_neg_integer()) ->
    no_retry | {retry, pos_integer()}.
maybe_retry_with_smaller_record_size(_Endpoint, _Response, _CurrentRecordSize, Attempt)
    when Attempt >= ?MAX_PAYLOAD_RETRY_ATTEMPTS
->
    no_retry;
maybe_retry_with_smaller_record_size(
    Endpoint,
    {ok, 413, _ResponseHeaders, ResponseBody},
    CurrentRecordSize,
    _Attempt
) ->
    case next_record_size_for_payload_too_large(CurrentRecordSize, Endpoint, ResponseBody) of
        undefined ->
            no_retry;
        NextRecordSize ->
            {retry, NextRecordSize}
    end;
maybe_retry_with_smaller_record_size(_Endpoint, _Response, _CurrentRecordSize, _Attempt) ->
    no_retry.

-spec next_record_size_for_payload_too_large(pos_integer(), binary(), binary()) ->
    pos_integer() | undefined.
next_record_size_for_payload_too_large(CurrentRecordSize, Endpoint, ResponseBody) ->
    case parse_constrained_overage_bytes(ResponseBody) of
        OverageBytes when is_integer(OverageBytes), OverageBytes > 0 ->
            sanitize_next_record_size(CurrentRecordSize - OverageBytes, CurrentRecordSize);
        _ ->
            FallbackRecordSize = fallback_record_size_for_endpoint(CurrentRecordSize, Endpoint),
            sanitize_next_record_size(FallbackRecordSize, CurrentRecordSize)
    end.

-spec sanitize_next_record_size(integer() | undefined, pos_integer()) -> pos_integer() | undefined.
sanitize_next_record_size(undefined, _CurrentRecordSize) ->
    undefined;
sanitize_next_record_size(CandidateRecordSize, CurrentRecordSize)
    when is_integer(CandidateRecordSize)
->
    ClampedRecordSize = erlang:max(?MIN_PUSH_RECORD_SIZE, CandidateRecordSize),
    case ClampedRecordSize < CurrentRecordSize of
        true -> ClampedRecordSize;
        false -> undefined
    end.

-spec fallback_record_size_for_endpoint(pos_integer(), binary()) -> pos_integer() | undefined.
fallback_record_size_for_endpoint(CurrentRecordSize, Endpoint) ->
    case is_mozilla_push_endpoint(Endpoint) of
        true when CurrentRecordSize > ?MOZILLA_COMPAT_PUSH_RECORD_SIZE ->
            ?MOZILLA_COMPAT_PUSH_RECORD_SIZE;
        true when CurrentRecordSize > ?MOZILLA_CONSTRAINED_PUSH_RECORD_SIZE ->
            ?MOZILLA_CONSTRAINED_PUSH_RECORD_SIZE;
        _ ->
            undefined
    end.

-spec parse_constrained_overage_bytes(binary()) -> non_neg_integer() | undefined.
parse_constrained_overage_bytes(ResponseBody) ->
    case decode_push_error_body(ResponseBody) of
        #{<<"message">> := Message} ->
            parse_constrained_overage_from_message(Message);
        _ ->
            undefined
    end.

-spec parse_constrained_overage_from_message(binary() | list()) -> non_neg_integer() | undefined.
parse_constrained_overage_from_message(Message) when is_list(Message) ->
    parse_constrained_overage_from_message(list_to_binary(Message));
parse_constrained_overage_from_message(Message) when is_binary(Message) ->
    case re:run(Message, <<"too long by ([0-9]+) bytes">>, [caseless, {capture, [1], binary}]) of
        {match, [OverageBytesBin]} ->
            parse_non_neg_integer(OverageBytesBin);
        _ ->
            undefined
    end.

-spec decode_push_error_body(binary()) -> map() | undefined.
decode_push_error_body(ResponseBody) when is_binary(ResponseBody), byte_size(ResponseBody) > 0 ->
    try json:decode(ResponseBody) of
        ParsedBody when is_map(ParsedBody) ->
            ParsedBody;
        _ ->
            undefined
    catch
        _:_ ->
            undefined
    end;
decode_push_error_body(_ResponseBody) ->
    undefined.

-spec parse_non_neg_integer(binary()) -> non_neg_integer() | undefined.
parse_non_neg_integer(Value) when is_binary(Value) ->
    try
        ParsedValue = binary_to_integer(Value),
        case ParsedValue >= 0 of
            true -> ParsedValue;
            false -> undefined
        end
    catch
        _:_ ->
            undefined
    end.
-spec initial_record_size_for_endpoint(binary()) -> pos_integer().
initial_record_size_for_endpoint(Endpoint) ->
    case is_mozilla_push_endpoint(Endpoint) of
        true ->
            ?MOZILLA_COMPAT_PUSH_RECORD_SIZE;
        false ->
            ?STANDARD_PUSH_RECORD_SIZE
    end.

-spec is_mozilla_push_endpoint(binary()) -> boolean().
is_mozilla_push_endpoint(Endpoint) ->
    LowerEndpoint = lowercase_binary(Endpoint),
    case binary:match(LowerEndpoint, <<"push.services.mozilla.com">>) of
        nomatch -> false;
        _ -> true
    end.

-spec lowercase_binary(binary()) -> binary().
lowercase_binary(Value) ->
    list_to_binary(string:lowercase(binary_to_list(Value))).

-spec handle_push_response(integer(), binary(), term()) ->
    false | {true, map()}.
handle_push_response(UserId, SubscriptionId, Response) ->
    case Response of
        {ok, Status, _, _} when Status >= 200, Status < 300 ->
            logger:debug(
                "Push: delivery succeeded",
                #{user_id => UserId, subscription_id => SubscriptionId, status => Status}
            ),
            otel_metrics:counter(<<"push.success">>, 1, #{
                <<"user_id">> => integer_to_binary(UserId),
                <<"status_code">> => integer_to_binary(Status)
            }),
            false;
        {ok, 410, _, _} ->
            logger:debug(
                "Push: subscription expired (410), will delete",
                #{user_id => UserId, subscription_id => SubscriptionId}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"expired">>,
                <<"user_id">> => integer_to_binary(UserId),
                <<"subscription_id">> => SubscriptionId
            }),
            {true, delete_payload(UserId, SubscriptionId)};
        {ok, 404, _, _} ->
            logger:debug(
                "Push: subscription not found (404), will delete",
                #{user_id => UserId, subscription_id => SubscriptionId}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"not_found">>,
                <<"user_id">> => integer_to_binary(UserId),
                <<"subscription_id">> => SubscriptionId
            }),
            {true, delete_payload(UserId, SubscriptionId)};
        {ok, Status, _, Body} ->
            logger:debug(
                "Push: delivery failed with HTTP error",
                #{user_id => UserId, subscription_id => SubscriptionId, status => Status, body => Body}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"http_error">>,
                <<"user_id">> => integer_to_binary(UserId),
                <<"status_code">> => integer_to_binary(Status)
            }),
            false;
        {error, overloaded} ->
            logger:debug(
                "Push: HTTP client overloaded",
                #{user_id => UserId, subscription_id => SubscriptionId}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"client_overloaded">>,
                <<"user_id">> => integer_to_binary(UserId)
            }),
            false;
        {error, circuit_open} ->
            logger:debug(
                "Push: circuit breaker open",
                #{user_id => UserId, subscription_id => SubscriptionId}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"circuit_open">>,
                <<"user_id">> => integer_to_binary(UserId)
            }),
            false;
        {error, Reason} ->
            logger:debug(
                "Push: network error",
                #{user_id => UserId, subscription_id => SubscriptionId, reason => Reason}
            ),
            otel_metrics:counter(<<"push.failure">>, 1, #{
                <<"reason">> => <<"network_error">>,
                <<"user_id">> => integer_to_binary(UserId)
            }),
            false
    end.

-spec delete_payload(integer(), binary()) -> map().
delete_payload(UserId, SubscriptionId) ->
    #{
        <<"user_id">> => integer_to_binary(UserId),
        <<"subscription_id">> => SubscriptionId
    }.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

is_mozilla_push_endpoint_test() ->
    ?assertEqual(
        true,
        is_mozilla_push_endpoint(<<"https://updates.push.services.mozilla.com/wpush/v2/token">>)
    ),
    ?assertEqual(true, is_mozilla_push_endpoint(<<"https://push.services.mozilla.com/wpush/x">>)),
    ?assertEqual(false, is_mozilla_push_endpoint(<<"https://fcm.googleapis.com/fcm/send">>)).

initial_record_size_for_endpoint_test() ->
    ?assertEqual(
        ?MOZILLA_COMPAT_PUSH_RECORD_SIZE,
        initial_record_size_for_endpoint(<<"https://updates.push.services.mozilla.com/wpush/v2/x">>)
    ),
    ?assertEqual(
        ?STANDARD_PUSH_RECORD_SIZE,
        initial_record_size_for_endpoint(<<"https://fcm.googleapis.com/fcm/send">>)
    ).

next_record_size_for_payload_too_large_overage_test() ->
    ResponseBody = <<
        "{\"code\":413,\"errno\":104,\"error\":\"Payload Too Large\","
        "\"message\":\"This message is intended for a constrained device and is limited in size. "
        "Converted buffer is too long by 1441 bytes\"}"
    >>,
    ?assertEqual(
        2655,
        next_record_size_for_payload_too_large(
            ?STANDARD_PUSH_RECORD_SIZE,
            <<"https://updates.push.services.mozilla.com/wpush/v2/x">>,
            ResponseBody
        )
    ).

next_record_size_for_payload_too_large_fallback_test() ->
    ResponseBody = <<"{\"code\":413,\"errno\":104,\"error\":\"Payload Too Large\"}">>,
    MozillaEndpoint = <<"https://updates.push.services.mozilla.com/wpush/v2/x">>,
    ?assertEqual(
        ?MOZILLA_COMPAT_PUSH_RECORD_SIZE,
        next_record_size_for_payload_too_large(?STANDARD_PUSH_RECORD_SIZE, MozillaEndpoint, ResponseBody)
    ),
    ?assertEqual(
        ?MOZILLA_CONSTRAINED_PUSH_RECORD_SIZE,
        next_record_size_for_payload_too_large(
            ?MOZILLA_COMPAT_PUSH_RECORD_SIZE,
            MozillaEndpoint,
            ResponseBody
        )
    ),
    ?assertEqual(
        undefined,
        next_record_size_for_payload_too_large(
            ?MOZILLA_CONSTRAINED_PUSH_RECORD_SIZE,
            MozillaEndpoint,
            ResponseBody
        )
    ),
    ?assertEqual(
        undefined,
        next_record_size_for_payload_too_large(
            ?STANDARD_PUSH_RECORD_SIZE,
            <<"https://fcm.googleapis.com/fcm/send">>,
            ResponseBody
        )
    ).

-endif.
