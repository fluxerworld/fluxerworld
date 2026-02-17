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

import mime from 'mime';

const CUSTOM_EXTENSION_MAPPINGS: Record<string, string> = {
	erl: 'text/plain',
	hrl: 'text/plain',
	ex: 'text/plain',
	exs: 'text/plain',
	rs: 'text/plain',
	go: 'text/plain',
	ts: 'text/plain',
	tsx: 'text/plain',
	jsx: 'text/plain',
	vue: 'text/plain',
	svelte: 'text/plain',
	astro: 'text/plain',
	toml: 'text/plain',
	yaml: 'text/plain',
	yml: 'text/plain',
	ini: 'text/plain',
	conf: 'text/plain',
	config: 'text/plain',
	sh: 'text/plain',
	bash: 'text/plain',
	zsh: 'text/plain',
	fish: 'text/plain',
	ps1: 'text/plain',
	bat: 'text/plain',
	cmd: 'text/plain',
	dockerfile: 'text/plain',
	makefile: 'text/plain',
	cmake: 'text/plain',
	gradle: 'text/plain',
	kt: 'text/plain',
	kts: 'text/plain',
	swift: 'text/plain',
	dart: 'text/plain',
	zig: 'text/plain',
	nim: 'text/plain',
	cr: 'text/plain',
	v: 'text/plain',
	clj: 'text/plain',
	cljs: 'text/plain',
	edn: 'text/plain',
	el: 'text/plain',
	lisp: 'text/plain',
	scm: 'text/plain',
	rkt: 'text/plain',
	hs: 'text/plain',
	lhs: 'text/plain',
	cabal: 'text/plain',
	ml: 'text/plain',
	mli: 'text/plain',
	fs: 'text/plain',
	fsi: 'text/plain',
	fsx: 'text/plain',
	scala: 'text/plain',
	sc: 'text/plain',
	sbt: 'text/plain',
	groovy: 'text/plain',
	gvy: 'text/plain',
	gy: 'text/plain',
	gsh: 'text/plain',
	r: 'text/plain',
	rmd: 'text/plain',
	jl: 'text/plain',
	m: 'text/plain',
	lua: 'text/plain',
	tcl: 'text/plain',
	vb: 'text/plain',
	vbs: 'text/plain',
	asm: 'text/plain',
	s: 'text/plain',
	nasm: 'text/plain',
	d: 'text/plain',
	pas: 'text/plain',
	pp: 'text/plain',
	f90: 'text/plain',
	f95: 'text/plain',
	f03: 'text/plain',
	f08: 'text/plain',
	for: 'text/plain',
	f: 'text/plain',
	cob: 'text/plain',
	cbl: 'text/plain',
	adb: 'text/plain',
	ads: 'text/plain',
	proto: 'text/plain',
	graphql: 'text/plain',
	gql: 'text/plain',
	prisma: 'text/plain',
	tf: 'text/plain',
	tfvars: 'text/plain',
	hcl: 'text/plain',
	vim: 'text/plain',
	vimrc: 'text/plain',
	gitignore: 'text/plain',
	gitattributes: 'text/plain',
	editorconfig: 'text/plain',
	prettierrc: 'text/plain',
	eslintrc: 'text/plain',
	babelrc: 'text/plain',
	env: 'text/plain',
	envrc: 'text/plain',
	log: 'text/plain',
	org: 'text/plain',
	rst: 'text/plain',
	adoc: 'text/plain',
	asciidoc: 'text/plain',
	txt: 'text/plain',
	text: 'text/plain',
	me: 'text/plain',
	readme: 'text/plain',
	license: 'text/plain',
	authors: 'text/plain',
	contributors: 'text/plain',
	changelog: 'text/plain',
	news: 'text/plain',
	pod: 'text/plain',
	diff: 'text/plain',
	patch: 'text/plain',
};

export function getContentTypeFromFilename(filename: string): string {
	const lowerFilename = filename.toLowerCase();
	const lastDotIndex = lowerFilename.lastIndexOf('.');
	const ext = lastDotIndex !== -1 ? lowerFilename.slice(lastDotIndex + 1) : '';

	if (ext && CUSTOM_EXTENSION_MAPPINGS[ext]) {
		return CUSTOM_EXTENSION_MAPPINGS[ext];
	}

	const baseFilename = lowerFilename.split('/').pop() ?? '';
	if (CUSTOM_EXTENSION_MAPPINGS[baseFilename]) {
		return CUSTOM_EXTENSION_MAPPINGS[baseFilename];
	}

	const mimeType = mime.getType(filename);
	if (mimeType) {
		return mimeType;
	}

	return 'application/octet-stream';
}
