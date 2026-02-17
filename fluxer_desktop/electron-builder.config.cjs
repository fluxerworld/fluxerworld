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

const isCanary = process.env.BUILD_CHANNEL === 'canary';

const productName = isCanary ? 'Fluxer Canary' : 'Fluxer';
const appId = isCanary ? 'app.fluxer.canary' : 'app.fluxer';
const iconDir = isCanary ? 'icons-canary' : 'icons-stable';
const packageName = isCanary ? 'fluxer_desktop_canary' : 'fluxer_desktop';

/** @type {import('electron-builder').Configuration} */
module.exports = {
	appId,
	productName,
	// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder placeholder syntax
	artifactName: '${productName}-${version}-${os}-${arch}.${ext}',

	directories: {
		buildResources: 'build_resources',
		output: 'dist-electron',
	},

	files: ['dist/**/*', 'package.json'],

	extraMetadata: {
		main: 'dist/main/index.js',
		name: packageName,
	},

	extraResources: [
		{
			from: `build_resources/${iconDir}/badges/`,
			to: 'badges',
			filter: ['**/*'],
		},
	],

	asar: true,
	compression: 'maximum',

	mac: {
		category: 'public.app-category.social-networking',
		icon: `build_resources/${iconDir}/_compiled/AppIcon.icns`,
		darkModeSupport: true,
		hardenedRuntime: true,
		gatekeeperAssess: false,
		entitlements: isCanary
			? 'build_resources/entitlements.mac.canary.plist'
			: 'build_resources/entitlements.mac.stable.plist',
		entitlementsInherit: 'build_resources/entitlements.mac.inherit.plist',
		target: [
			{
				target: 'dmg',
				arch: ['x64', 'arm64'],
			},
			{
				target: 'zip',
				arch: ['x64', 'arm64'],
			},
		],
		extendInfo: {
			NSMicrophoneUsageDescription: 'Fluxer needs access to your microphone to enable voice chat features.',
			NSCameraUsageDescription: 'Fluxer needs access to your camera to enable video chat features.',
			NSAppleEventsUsageDescription: 'Fluxer needs access to Apple Events for automation features.',
		},
	},

	dmg: {
		contents: [
			{
				x: 130,
				y: 220,
			},
			{
				x: 410,
				y: 220,
				type: 'link',
				path: '/Applications',
			},
		],
	},

	win: {
		icon: `build_resources/${iconDir}/icon.ico`,
		target: [
			{
				target: 'nsis',
				arch: ['x64', 'arm64'],
			},
			{
				target: 'squirrel',
				arch: ['x64'],
			},
		],
	},

	nsis: {
		oneClick: false,
		perMachine: false,
		allowToChangeInstallationDirectory: true,
		deleteAppDataOnUninstall: false,
		createDesktopShortcut: true,
		createStartMenuShortcut: true,
	},

	squirrelWindows: {
		iconUrl: `https://fluxerstatic.com/desktop/${iconDir}/icon.ico`,
		name: packageName,
	},

	linux: {
		icon: `build_resources/${iconDir}/icon.png`,
		category: 'Network;InstantMessaging;',
		target: [
			{
				target: 'AppImage',
				arch: ['x64', 'arm64'],
			},
			{
				target: 'deb',
				arch: ['x64', 'arm64'],
			},
			{
				target: 'rpm',
				arch: ['x64', 'arm64'],
			},
			{
				target: 'tar.gz',
				arch: ['x64', 'arm64'],
			},
		],
		desktop: {
			Name: productName,
			Comment: 'Instant messaging and VoIP application',
			Categories: 'Network;InstantMessaging;',
			StartupWMClass: isCanary ? 'fluxer-canary' : 'fluxer',
		},
	},

	deb: {
		depends: [
			'libgtk-3-0',
			'libnotify4',
			'libnss3',
			'libxss1',
			'libxtst6',
			'xdg-utils',
			'libatspi2.0-0',
			'libuuid1',
			'libsecret-1-0',
		],
	},

	rpm: {
		depends: [
			'gtk3',
			'libnotify',
			'nss',
			'libXScrnSaver',
			'libXtst',
			'xdg-utils',
			'at-spi2-core',
			'libuuid',
			'libsecret',
		],
	},

	publish: null,
};
