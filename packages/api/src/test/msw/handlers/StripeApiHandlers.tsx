/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import {HttpResponse, http} from 'msw';

const STRIPE_API_BASE = 'https://api.stripe.com';

export interface CheckoutSessionParams {
	customer?: string;
	customer_email?: string;
	line_items?: Array<{price_data?: unknown; price?: string; quantity?: number}>;
	mode?: string;
	success_url?: string;
	cancel_url?: string;
	metadata?: Record<string, string>;
	allow_promotion_codes?: string;
}

export interface PortalSessionParams {
	customer: string;
	return_url?: string;
}

export interface StripeApiMockConfig {
	checkoutShouldFail?: boolean;
	portalShouldFail?: boolean;
	subscriptionShouldFail?: boolean;
	customerShouldFail?: boolean;
}

export interface StripeApiMockSpies {
	createdCheckoutSessions: Array<CheckoutSessionParams>;
	createdPortalSessions: Array<PortalSessionParams>;
	createdCustomers: Array<{id: string; email: string | null}>;
	retrievedSubscriptions: Array<string>;
	cancelledSubscriptions: Array<string>;
	retrievedCustomers: Array<string>;
	updatedSubscriptions: Array<{id: string; params: Record<string, unknown>}>;
}

function parseFormDataToObject(formData: FormData): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of formData.entries()) {
		if (key.includes('[')) {
			const matches = key.match(/^([^[]+)\[(\d+)\]\[([^\]]+)\](?:\[([^\]]+)\])?(?:\[([^\]]+)\])?$/);
			if (matches) {
				const [, arrayName, index, prop1, prop2, prop3] = matches;
				if (!result[arrayName!]) {
					result[arrayName!] = [];
				}
				const arr = result[arrayName!] as Array<Record<string, unknown>>;
				const idx = parseInt(index!, 10);
				if (!arr[idx]) {
					arr[idx] = {};
				}
				if (prop3) {
					if (!arr[idx][prop1!]) {
						arr[idx][prop1!] = {};
					}
					const nested = arr[idx][prop1!] as Record<string, unknown>;
					if (!nested[prop2!]) {
						nested[prop2!] = {};
					}
					(nested[prop2!] as Record<string, unknown>)[prop3] = value;
				} else if (prop2) {
					if (!arr[idx][prop1!]) {
						arr[idx][prop1!] = {};
					}
					(arr[idx][prop1!] as Record<string, unknown>)[prop2] = value;
				} else {
					arr[idx][prop1!] = value;
				}
			} else {
				const simpleMatch = key.match(/^([^[]+)\[([^\]]+)\]$/);
				if (simpleMatch) {
					const [, objName, objKey] = simpleMatch;
					if (!result[objName!]) {
						result[objName!] = {};
					}
					(result[objName!] as Record<string, unknown>)[objKey!] = value;
				}
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}

export function createStripeApiHandlers(config: StripeApiMockConfig = {}) {
	const spies: StripeApiMockSpies = {
		createdCheckoutSessions: [],
		createdPortalSessions: [],
		createdCustomers: [],
		retrievedSubscriptions: [],
		cancelledSubscriptions: [],
		retrievedCustomers: [],
		updatedSubscriptions: [],
	};

	let sessionCounter = 0;
	let portalCounter = 0;

	const subscriptionStore = new Map<string, {trial_end: number | null}>();

	const handlers = [
		http.post(`${STRIPE_API_BASE}/v1/checkout/sessions`, async ({request}) => {
			if (config.checkoutShouldFail) {
				return HttpResponse.json(
					{
						error: {
							type: 'invalid_request_error',
							message: 'Mock checkout failure',
							code: 'resource_missing',
						},
					},
					{status: 400},
				);
			}

			const formData = await request.formData();
			const params = parseFormDataToObject(formData) as unknown as CheckoutSessionParams;
			spies.createdCheckoutSessions.push(params);

			sessionCounter++;
			const sessionId = `cs_test_${sessionCounter}_${Date.now()}`;
			return HttpResponse.json({
				id: sessionId,
				object: 'checkout.session',
				url: `https://checkout.stripe.com/c/pay/${sessionId}`,
				customer: params.customer ?? (params.customer_email ? `cus_test_${sessionCounter}` : null),
				customer_email: params.customer_email,
				mode: params.mode || 'subscription',
				metadata: params.metadata || {},
				status: 'open',
				success_url: params.success_url,
				cancel_url: params.cancel_url,
				amount_total: null,
				currency: null,
				livemode: false,
				payment_status: 'unpaid',
				created: Math.floor(Date.now() / 1000),
				expires_at: Math.floor(Date.now() / 1000) + 86400,
			});
		}),

		http.get(`${STRIPE_API_BASE}/v1/checkout/sessions/:id`, ({params}) => {
			const {id} = params;
			return HttpResponse.json({
				id,
				object: 'checkout.session',
				customer: 'cus_test_1',
				customer_email: 'test@example.com',
				subscription: 'sub_test_1',
				payment_intent: 'pi_test_1',
				amount_total: 2500,
				currency: 'usd',
				status: 'complete',
				payment_status: 'paid',
				metadata: {},
				mode: 'subscription',
				livemode: false,
				created: Math.floor(Date.now() / 1000) - 3600,
			});
		}),

		http.post(`${STRIPE_API_BASE}/v1/billing_portal/sessions`, async ({request}) => {
			if (config.portalShouldFail) {
				return HttpResponse.json(
					{
						error: {
							type: 'invalid_request_error',
							message: 'Mock portal failure',
							code: 'resource_missing',
						},
					},
					{status: 400},
				);
			}

			const formData = await request.formData();
			const customer = formData.get('customer') as string;
			const return_url = formData.get('return_url') as string | undefined;
			spies.createdPortalSessions.push({customer, return_url});

			portalCounter++;
			return HttpResponse.json({
				id: `bps_test_${portalCounter}`,
				object: 'billing_portal.session',
				url: `https://billing.stripe.com/p/session/test_${portalCounter}_${Date.now()}`,
				customer,
				return_url: return_url || null,
				livemode: false,
				created: Math.floor(Date.now() / 1000),
				configuration: 'bpc_test_config',
			});
		}),

		http.get(`${STRIPE_API_BASE}/v1/subscriptions/:id`, ({params}) => {
			if (config.subscriptionShouldFail) {
				return HttpResponse.json(
					{
						error: {
							type: 'invalid_request_error',
							message: 'No such subscription',
							code: 'resource_missing',
							param: 'id',
						},
					},
					{status: 404},
				);
			}

			const {id} = params;
			spies.retrievedSubscriptions.push(id as string);

			const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
			const subState = subscriptionStore.get(id as string);

			return HttpResponse.json({
				id,
				object: 'subscription',
				customer: 'cus_test_1',
				status: 'active',
				current_period_start: Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
				trial_end: subState?.trial_end ?? null,
				items: {
					object: 'list',
					data: [
						{
							id: 'si_test_1',
							object: 'subscription_item',
							price: {
								id: 'price_test_1',
								object: 'price',
								unit_amount: 2500,
								currency: 'usd',
								recurring: {
									interval: 'month',
									interval_count: 1,
								},
								type: 'recurring',
								active: true,
								livemode: false,
							},
							quantity: 1,
							current_period_end: currentPeriodEnd,
						},
					],
					has_more: false,
					url: `/v1/subscription_items?subscription=${id}`,
				},
				cancel_at: null,
				cancel_at_period_end: false,
				canceled_at: null,
				collection_method: 'charge_automatically',
				created: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60,
				livemode: false,
				metadata: {},
				start_date: Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60,
			});
		}),

		http.post(`${STRIPE_API_BASE}/v1/subscriptions/:id`, async ({params, request}) => {
			if (config.subscriptionShouldFail) {
				return HttpResponse.json(
					{
						error: {
							type: 'invalid_request_error',
							message: 'Mock subscription update failure',
							code: 'resource_missing',
						},
					},
					{status: 400},
				);
			}

			const {id} = params;
			const formData = await request.formData();
			const updateParams = parseFormDataToObject(formData);
			spies.updatedSubscriptions.push({id: id as string, params: updateParams});

			if (updateParams.trial_end) {
				const subState = subscriptionStore.get(id as string) ?? {trial_end: null};
				subState.trial_end = Number(updateParams.trial_end);
				subscriptionStore.set(id as string, subState);
			}

			return HttpResponse.json({
				id,
				object: 'subscription',
				customer: 'cus_test_1',
				status: 'active',
				cancel_at_period_end: updateParams.cancel_at_period_end === 'true',
				trial_end: updateParams.trial_end ? Number(updateParams.trial_end) : null,
				metadata: updateParams.metadata || {},
				livemode: false,
			});
		}),

		http.delete(`${STRIPE_API_BASE}/v1/subscriptions/:id`, ({params}) => {
			const {id} = params;
			spies.cancelledSubscriptions.push(id as string);

			return HttpResponse.json({
				id,
				object: 'subscription',
				customer: 'cus_test_1',
				status: 'canceled',
				canceled_at: Math.floor(Date.now() / 1000),
				ended_at: Math.floor(Date.now() / 1000),
				livemode: false,
			});
		}),

		http.get(`${STRIPE_API_BASE}/v1/customers/:id`, ({params}) => {
			if (config.customerShouldFail) {
				return HttpResponse.json(
					{
						error: {
							type: 'invalid_request_error',
							message: 'No such customer',
							code: 'resource_missing',
							param: 'id',
						},
					},
					{status: 404},
				);
			}

			const {id} = params;
			spies.retrievedCustomers.push(id as string);

			return HttpResponse.json({
				id,
				object: 'customer',
				email: 'test@example.com',
				name: 'Test Customer',
				created: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60,
				livemode: false,
				metadata: {},
				description: null,
				currency: 'usd',
				default_source: null,
				invoice_settings: {
					default_payment_method: 'pm_test_1',
				},
			});
		}),

		http.post(`${STRIPE_API_BASE}/v1/customers`, async ({request}) => {
			const formData = await request.formData();
			const email = formData.get('email') as string | null;
			const customerId = `cus_test_new_${Date.now()}`;

			spies.createdCustomers.push({id: customerId, email});

			return HttpResponse.json({
				id: customerId,
				object: 'customer',
				email,
				name: null,
				created: Math.floor(Date.now() / 1000),
				livemode: false,
				metadata: {},
			});
		}),

		http.get(`${STRIPE_API_BASE}/v1/prices/:id`, ({params}) => {
			const {id} = params;
			return HttpResponse.json({
				id,
				object: 'price',
				active: true,
				currency: 'usd',
				unit_amount: 2500,
				type: 'recurring',
				recurring: {
					interval: 'month',
					interval_count: 1,
				},
				product: 'prod_test_1',
				livemode: false,
				created: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60,
			});
		}),
	];

	function reset() {
		spies.createdCheckoutSessions.length = 0;
		spies.createdPortalSessions.length = 0;
		spies.createdCustomers.length = 0;
		spies.retrievedSubscriptions.length = 0;
		spies.cancelledSubscriptions.length = 0;
		spies.retrievedCustomers.length = 0;
		spies.updatedSubscriptions.length = 0;
	}

	function resetAll() {
		reset();
		sessionCounter = 0;
		portalCounter = 0;
		subscriptionStore.clear();
	}

	return {handlers, spies, reset, resetAll};
}

export interface StripeWebhookEventData {
	id?: string;
	type: string;
	data: {object: Record<string, unknown>};
	created?: number;
}

export function createMockWebhookPayload(eventData: StripeWebhookEventData): {
	payload: string;
	timestamp: number;
} {
	const timestamp = Math.floor(Date.now() / 1000);
	const event = {
		id: eventData.id ?? `evt_test_${Date.now()}`,
		object: 'event',
		api_version: '2026-01-28.clover',
		created: eventData.created ?? timestamp,
		type: eventData.type,
		data: eventData.data,
		livemode: false,
		pending_webhooks: 1,
		request: {
			id: `req_test_${Date.now()}`,
			idempotency_key: null,
		},
	};
	return {payload: JSON.stringify(event), timestamp};
}

export function createCheckoutCompletedEvent(options: {
	sessionId?: string;
	customerId?: string;
	customerEmail?: string;
	subscriptionId?: string;
	amountTotal?: number;
	currency?: string;
	metadata?: Record<string, string>;
}): StripeWebhookEventData {
	return {
		type: 'checkout.session.completed',
		data: {
			object: {
				id: options.sessionId ?? `cs_test_${Date.now()}`,
				object: 'checkout.session',
				customer: options.customerId ?? 'cus_test_1',
				customer_email: options.customerEmail ?? 'test@example.com',
				subscription: options.subscriptionId ?? 'sub_test_1',
				amount_total: options.amountTotal ?? 2500,
				currency: options.currency ?? 'usd',
				mode: 'subscription',
				payment_status: 'paid',
				status: 'complete',
				metadata: options.metadata ?? {is_donation: 'true'},
			},
		},
	};
}

export function createSubscriptionUpdatedEvent(options: {
	subscriptionId?: string;
	customerId?: string;
	status?: string;
	cancelAtPeriodEnd?: boolean;
}): StripeWebhookEventData {
	const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
	return {
		type: 'customer.subscription.updated',
		data: {
			object: {
				id: options.subscriptionId ?? 'sub_test_1',
				object: 'subscription',
				customer: options.customerId ?? 'cus_test_1',
				status: options.status ?? 'active',
				cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
				items: {
					data: [{current_period_end: currentPeriodEnd}],
				},
			},
		},
	};
}

export function createSubscriptionDeletedEvent(options: {
	subscriptionId?: string;
	customerId?: string;
}): StripeWebhookEventData {
	return {
		type: 'customer.subscription.deleted',
		data: {
			object: {
				id: options.subscriptionId ?? 'sub_test_1',
				object: 'subscription',
				customer: options.customerId ?? 'cus_test_1',
				status: 'canceled',
				canceled_at: Math.floor(Date.now() / 1000),
			},
		},
	};
}

export function createInvoicePaidEvent(options: {
	invoiceId?: string;
	customerId?: string;
	subscriptionId?: string;
	amountPaid?: number;
	currency?: string;
}): StripeWebhookEventData {
	return {
		type: 'invoice.paid',
		data: {
			object: {
				id: options.invoiceId ?? `in_test_${Date.now()}`,
				object: 'invoice',
				customer: options.customerId ?? 'cus_test_1',
				subscription: options.subscriptionId ?? 'sub_test_1',
				amount_paid: options.amountPaid ?? 2500,
				currency: options.currency ?? 'usd',
				status: 'paid',
				paid: true,
			},
		},
	};
}

export function createInvoicePaymentFailedEvent(options: {
	invoiceId?: string;
	customerId?: string;
	subscriptionId?: string;
	amountDue?: number;
}): StripeWebhookEventData {
	return {
		type: 'invoice.payment_failed',
		data: {
			object: {
				id: options.invoiceId ?? `in_test_${Date.now()}`,
				object: 'invoice',
				customer: options.customerId ?? 'cus_test_1',
				subscription: options.subscriptionId ?? 'sub_test_1',
				amount_due: options.amountDue ?? 2500,
				status: 'open',
				paid: false,
				attempt_count: 1,
				next_payment_attempt: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60,
			},
		},
	};
}
