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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {CaptchaModal, type CaptchaType} from '@app/components/modals/CaptchaModal';
import HttpClient, {type HttpResponse} from '@app/lib/HttpClient';
import {getResponseCode, getResponseMessage} from '@app/utils/ApiErrorUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {action, makeObservable, observable} from 'mobx';
import {observer} from 'mobx-react-lite';

export interface CaptchaResult {
	token: string;
	type: CaptchaType;
}

class CaptchaState {
	error: string | null = null;
	isVerifying = false;

	constructor() {
		makeObservable(this, {
			error: observable,
			isVerifying: observable,
			setError: action,
			setIsVerifying: action,
			reset: action,
		});
	}

	setError(error: string | null) {
		this.error = error;
	}

	setIsVerifying(isVerifying: boolean) {
		this.isVerifying = isVerifying;
	}

	reset() {
		this.error = null;
		this.isVerifying = false;
	}
}

class CaptchaInterceptorStore {
	private state = new CaptchaState();
	private pendingPromise: {resolve: (result: CaptchaResult) => void; reject: (error: Error) => void} | null = null;
	private i18n: I18n | null = null;

	setI18n(i18n: I18n) {
		this.i18n = i18n;
	}

	constructor() {
		HttpClient.setInterceptors({
			interceptResponse: this.intercept.bind(this),
		});
	}

	private isCaptchaError(response: HttpResponse): boolean {
		const code = getResponseCode(response.body);
		return code === 'CAPTCHA_REQUIRED' || code === 'INVALID_CAPTCHA';
	}

	private showCaptchaModal(): Promise<CaptchaResult> {
		if (this.pendingPromise) {
			this.pendingPromise.reject(new Error('Captcha cancelled'));
			this.pendingPromise = null;
		}

		this.state.reset();

		return new Promise((resolve, reject) => {
			this.pendingPromise = {resolve, reject};

			const handleVerify = (token: string, captchaType: CaptchaType) => {
				const result = {token, type: captchaType};
				this.state.setIsVerifying(true);
				if (this.pendingPromise) {
					this.pendingPromise.resolve(result);
					this.pendingPromise = null;
				}
			};

			const handleCancel = () => {
				this.state.reset();
				if (this.pendingPromise) {
					this.pendingPromise.reject(new Error('Captcha cancelled'));
					this.pendingPromise = null;
				}
				ModalActionCreators.pop();
			};

			const CaptchaModalWrapper = observer(() => (
				<CaptchaModal
					onVerify={handleVerify}
					onCancel={handleCancel}
					error={this.state.error}
					isVerifying={this.state.isVerifying}
					closeOnVerify={false}
				/>
			));

			ModalActionCreators.push(modal(() => <CaptchaModalWrapper />));
		});
	}

	private intercept(
		response: HttpResponse,
		retryWithHeaders: (headers: Record<string, string>) => Promise<HttpResponse>,
		reject: (error: Error) => void,
	): boolean | Promise<HttpResponse> | undefined {
		if (response.status === 400 && this.isCaptchaError(response)) {
			const i18n = this.i18n!;
			const errorMessage =
				getResponseMessage(response.body) || i18n._(msg`Captcha verification failed. Please try again.`);

			this.state.setError(errorMessage);
			this.state.setIsVerifying(false);

			const promise = this.showCaptchaModal()
				.then((captchaResult) => {
					this.state.setError(null);
					this.state.setIsVerifying(false);
					ModalActionCreators.pop();
					return retryWithHeaders({
						'X-Captcha-Token': captchaResult.token,
						'X-Captcha-Type': captchaResult.type,
					});
				})
				.catch((error) => {
					this.state.reset();
					ModalActionCreators.pop();
					reject(error);
					throw error;
				});

			return promise;
		}

		return undefined;
	}
}

export default new CaptchaInterceptorStore();
