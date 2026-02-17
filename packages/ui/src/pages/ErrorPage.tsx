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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {CdnEndpoints} from '@fluxer/constants/src/CdnEndpoints';
import type {FC} from 'hono/jsx';
export interface ErrorPageProps {
	statusCode: number;
	title: string;
	description: string;
	locale?: string;
	staticCdnEndpoint?: string;
	homeUrl?: string;
	homeLabel?: string;
	helpUrl?: string;
	helpLabel?: string;
	showLogo?: boolean;
}

const inlineStyles = `
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}
html, body {
	height: 100%;
}
body {
	font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	background: linear-gradient(180deg, #4641D9 0%, #3832B8 100%);
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
	padding: 1.5rem;
}
.error-container {
	text-align: center;
	max-width: 32rem;
}
.logo {
	height: 4rem;
	opacity: 0.8;
	margin-bottom: 2rem;
}
.status-code {
	font-family: 'Bricolage Grotesque', 'IBM Plex Sans', sans-serif;
	font-size: 6rem;
	font-weight: 700;
	line-height: 1;
	margin-bottom: 1.5rem;
	opacity: 0.9;
}
.title {
	font-family: 'Bricolage Grotesque', 'IBM Plex Sans', sans-serif;
	font-size: 1.875rem;
	font-weight: 600;
	margin-bottom: 1rem;
}
.description {
	font-size: 1.125rem;
	opacity: 0.8;
	margin-bottom: 2rem;
	line-height: 1.6;
}
.buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	justify-content: center;
}
.btn {
	display: inline-block;
	padding: 0.75rem 1.5rem;
	border-radius: 0.5rem;
	font-size: 1rem;
	font-weight: 500;
	text-decoration: none;
	transition: opacity 0.15s ease;
}
.btn:hover {
	opacity: 0.9;
}
.btn-primary {
	background: #fff;
	color: #4641D9;
	border: 1px solid #fff;
}
.btn-secondary {
	background: transparent;
	color: #fff;
	border: 1px solid rgba(255, 255, 255, 0.3);
}
.btn-secondary:hover {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(255, 255, 255, 0.5);
}
@media (max-width: 640px) {
	.status-code {
		font-size: 4rem;
	}
	.title {
		font-size: 1.5rem;
	}
	.description {
		font-size: 1rem;
	}
}
`;

const FluxerLogoWordmark: FC = () => {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 1959 512" class="logo">
			<path
				fill="currentColor"
				d="M585 431.4V93.48h82.944V431.4H585Zm41.472-120.32v-67.584h172.032v67.584H626.472Zm0-148.48V93.48h189.44v69.12h-189.44ZM843.951 431.4V73h82.944v358.4h-82.944ZM1047.92 438.568c-29.35 0-51.2-10.24-65.536-30.72-13.995-20.48-20.992-51.883-20.992-94.208V161.064h82.948v151.552c0 19.797 2.73 33.621 8.19 41.472 5.8 7.851 13.99 11.776 24.57 11.776 7.51 0 14.34-1.877 20.48-5.632 6.49-4.096 12.12-10.069 16.9-17.92 4.78-8.192 8.36-18.603 10.75-31.232 2.73-12.629 4.1-27.819 4.1-45.568V161.064h82.94V431.4h-70.65V325.928h-3.59c-2.05 26.283-6.65 47.787-13.82 64.512-7.17 16.384-17.07 28.501-29.7 36.352-12.63 7.851-28.16 11.776-46.59 11.776ZM1232.57 431.4l84.99-135.68-83.97-134.656h96.26l39.42 87.552h2.56l38.4-87.552h95.23l-81.4 134.656 82.43 135.68h-97.79l-37.38-86.016h-2.05L1327.8 431.4h-95.23Z"
			/>
			<path
				fill="currentColor"
				d="M1630.96 438.568c-25.6 0-47.1-3.584-64.51-10.752-17.06-7.509-30.89-17.579-41.47-30.208-10.58-12.971-18.26-27.648-23.04-44.032-4.44-16.384-6.66-33.621-6.66-51.712 0-19.456 2.39-38.059 7.17-55.808 5.12-17.749 12.8-33.451 23.04-47.104 10.58-13.995 24.07-24.917 40.45-32.768 16.73-8.192 36.69-12.288 59.9-12.288s43.01 4.096 59.4 12.288c16.72 7.851 30.03 18.944 39.93 33.28 9.9 14.336 16.22 30.891 18.95 49.664 3.07 18.773 2.73 39.083-1.03 60.928L1547 313.128v-45.056l132.6-2.56-10.75 26.112c2.05-15.701 1.71-28.843-1.02-39.424-2.39-10.923-7-19.115-13.83-24.576-6.82-5.803-16.21-8.704-28.16-8.704-12.63 0-22.69 3.243-30.2 9.728-7.51 6.485-12.8 15.701-15.88 27.648-3.07 11.605-4.6 25.429-4.6 41.472 0 27.648 4.6 47.787 13.82 60.416 9.22 12.629 23.38 18.944 42.5 18.944 8.19 0 15.01-1.024 20.48-3.072 5.46-2.048 9.89-4.949 13.31-8.704 3.41-4.096 5.8-8.875 7.17-14.336 1.36-5.803 1.87-12.288 1.53-19.456l75.78 4.096c1.02 11.264-.17 22.869-3.59 34.816-3.07 11.947-9.04 23.04-17.92 33.28-8.87 10.24-21.33 18.603-37.37 25.088-15.7 6.485-35.67 9.728-59.91 9.728ZM1778.45 431.4V161.064h71.68v107.52h4.1c2.05-28.672 5.97-51.2 11.77-67.584 6.15-16.725 13.66-28.501 22.53-35.328 9.22-7.168 19.46-10.752 30.72-10.752 6.15 0 12.46.853 18.95 2.56 6.82 1.707 13.48 4.437 19.96 8.192l-4.09 92.16c-7.51-4.437-14.85-7.68-22.02-9.728-7.17-2.389-13.99-3.584-20.48-3.584-10.92 0-20.14 3.072-27.65 9.216-7.51 6.144-13.31 15.189-17.4 27.136-3.76 11.947-5.64 26.453-5.64 43.52V431.4h-82.43ZM256 0c141.385 0 256 114.615 256 256S397.385 512 256 512 0 397.385 0 256 114.615 0 256 0Zm-68.47 266.057c-15.543 0-30.324 3.505-44.343 10.514-13.866 7.01-25.143 18.21-33.828 33.6-5.616 10.129-9.318 22.403-11.1061 36.822-1.6543 13.341 9.5761 24.207 23.0181 24.207 13.778 0 24.065-11.574 27.402-24.941 1.891-7.579 4.939-13.589 9.142-18.03 8.076-8.534 18.286-12.8 30.629-12.8 8.229 0 15.772 2.057 22.629 6.171 6.857 3.962 15.771 10.743 26.742 20.343 16.762 14.781 31.544 25.524 44.344 32.228 12.8 6.553 26.971 9.829 42.514 9.829 15.543 0 30.324-3.505 44.343-10.514 14.019-7.01 25.371-18.21 34.057-33.6 5.738-10.168 9.448-22.497 11.129-36.987 1.543-13.302-9.704-24.042-23.096-24.042-13.863.001-24.202 11.704-27.888 25.07-1.797 6.515-4.512 12.025-8.145 16.53-7.619 9.448-18.057 14.172-31.314 14.172-8.229 0-15.696-1.982-22.4-5.943-6.553-4.115-15.543-10.972-26.972-20.572-16.914-14.171-31.772-24.685-44.572-31.543-12.647-7.009-26.742-10.514-42.285-10.514Zm0-138.057c-15.543 0-30.324 3.505-44.343 10.514-13.866 7.01-25.143 18.21-33.828 33.6-5.616 10.129-9.318 22.403-11.1061 36.821-1.6544 13.341 9.5761 24.207 23.0181 24.208 13.778 0 24.065-11.574 27.402-24.941 1.891-7.579 4.939-13.589 9.142-18.031 8.076-8.533 18.286-12.8 30.629-12.8 8.229 0 15.772 2.058 22.629 6.172 6.857 3.962 15.771 10.743 26.742 20.343 16.762 14.781 31.544 25.524 44.344 32.228 12.8 6.553 26.971 9.829 42.514 9.829 15.543 0 30.324-3.505 44.343-10.514 14.019-7.01 25.371-18.21 34.057-33.6 5.738-10.168 9.448-22.497 11.129-36.987 1.543-13.303-9.704-24.042-23.096-24.042-13.863 0-24.202 11.704-27.888 25.07-1.797 6.515-4.512 12.025-8.145 16.53-7.619 9.448-18.057 14.171-31.314 14.171-8.229 0-15.696-1.981-22.4-5.942-6.553-4.115-15.543-10.972-26.972-20.572-16.914-14.171-31.772-24.686-44.572-31.543C217.168 131.505 203.073 128 187.53 128Z"
			/>
		</svg>
	);
};

export function ErrorPage({
	statusCode,
	title,
	description,
	locale = 'en',
	staticCdnEndpoint = CdnEndpoints.STATIC,
	homeUrl,
	homeLabel = 'Go home',
	helpUrl = 'https://fluxer.app/help',
	helpLabel = 'Get help',
	showLogo = true,
}: ErrorPageProps) {
	const hasButtons = homeUrl || helpUrl;

	return (
		<html lang={locale}>
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="robots" content="noindex, nofollow" />
				<title>
					{statusCode} - {title}
				</title>
				<link rel="preconnect" href={staticCdnEndpoint} />
				<link rel="stylesheet" href={`${staticCdnEndpoint}/fonts/ibm-plex.css`} />
				<link rel="stylesheet" href={`${staticCdnEndpoint}/fonts/bricolage.css`} />
				<link rel="icon" type="image/x-icon" href={`${staticCdnEndpoint}/web/favicon.ico`} />
				<link rel="apple-touch-icon" href={`${staticCdnEndpoint}/web/apple-touch-icon.png`} />
				<link rel="icon" type="image/png" sizes="32x32" href={`${staticCdnEndpoint}/web/favicon-32x32.png`} />
				<link rel="icon" type="image/png" sizes="16x16" href={`${staticCdnEndpoint}/web/favicon-16x16.png`} />
				<style dangerouslySetInnerHTML={{__html: inlineStyles}} />
			</head>
			<body>
				<div class="error-container">
					{showLogo && <FluxerLogoWordmark />}
					<div class="status-code">{statusCode}</div>
					<h1 class="title">{title}</h1>
					<p class="description">{description}</p>
					{hasButtons && (
						<div class="buttons">
							{homeUrl && (
								<a href={homeUrl} class="btn btn-primary">
									{homeLabel}
								</a>
							)}
							{helpUrl && (
								<a href={helpUrl} class="btn btn-secondary">
									{helpLabel}
								</a>
							)}
						</div>
					)}
				</div>
			</body>
		</html>
	);
}
