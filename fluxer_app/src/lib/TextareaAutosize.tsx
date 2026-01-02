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

import * as React from 'react';

export interface TextareaAutosizeProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	minRows?: number;
	maxRows?: number;
	onHeightChange?: (height: number, meta: {rowHeight: number}) => void;
}

function getLineHeight(style: CSSStyleDeclaration): number {
	const lh = Number.parseFloat(style.lineHeight);
	if (Number.isFinite(lh)) return lh;
	const fs = Number.parseFloat(style.fontSize);
	return Number.isFinite(fs) ? fs * 1.2 : 16 * 1.2;
}

function getNumber(v: string): number {
	const n = Number.parseFloat(v);
	return Number.isFinite(n) ? n : 0;
}

function computeRowConstraints(el: HTMLTextAreaElement, minRows?: number, maxRows?: number) {
	const cs = window.getComputedStyle(el);
	const lineHeight = getLineHeight(cs);
	const paddingBlock = getNumber(cs.paddingTop) + getNumber(cs.paddingBottom);
	const borderBlock = getNumber(cs.borderTopWidth) + getNumber(cs.borderBottomWidth);
	const extra = cs.boxSizing === 'border-box' ? paddingBlock + borderBlock : 0;

	return {
		minHeight: minRows != null ? lineHeight * minRows + extra : undefined,
		maxHeight: maxRows != null ? lineHeight * maxRows + extra : undefined,
		lineHeight,
	};
}

export const TextareaAutosize = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>((props, forwardedRef) => {
	const {minRows: minRowsProp, maxRows, style, onHeightChange, rows, onInput, ...rest} = props;

	const resolvedRows = rows ?? 1;
	const minRows = minRowsProp ?? (typeof resolvedRows === 'number' ? resolvedRows : undefined);

	const elRef = React.useRef<HTMLTextAreaElement | null>(null);
	const onHeightChangeRef = React.useRef(onHeightChange);
	const lastWidthRef = React.useRef<number | null>(null);
	const lastHeightRef = React.useRef<number | null>(null);
	const resizeScheduledRef = React.useRef(false);

	const setRef = React.useCallback(
		(node: HTMLTextAreaElement | null) => {
			elRef.current = node;
			if (typeof forwardedRef === 'function') forwardedRef(node);
			else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
		},
		[forwardedRef],
	);

	React.useEffect(() => {
		onHeightChangeRef.current = onHeightChange;
	}, [onHeightChange]);

	React.useLayoutEffect(() => {
		const el = elRef.current;
		if (!el || (minRows == null && maxRows == null)) return;

		const {minHeight, maxHeight} = computeRowConstraints(el, minRows, maxRows);

		if (minHeight != null) {
			el.style.minHeight = `${minHeight}px`;
		}
		if (maxHeight != null) {
			el.style.maxHeight = `${maxHeight}px`;
		}
	}, [minRows, maxRows]);

	const resize = React.useCallback(() => {
		const el = elRef.current;
		if (!el) return;

		const cs = window.getComputedStyle(el);
		const {minHeight, maxHeight, lineHeight} = computeRowConstraints(el, minRows, maxRows);
		const borderBlock = getNumber(cs.borderTopWidth) + getNumber(cs.borderBottomWidth);
		const isBorderBox = cs.boxSizing === 'border-box';

		el.style.height = 'auto';

		let nextHeight = el.scrollHeight + (isBorderBox ? borderBlock : 0);
		if (minHeight != null) nextHeight = Math.max(nextHeight, minHeight);
		if (maxHeight != null) nextHeight = Math.min(nextHeight, maxHeight);

		const heightPx = `${nextHeight}px`;
		if (el.style.height !== heightPx) {
			el.style.height = heightPx;
		}

		if (lastHeightRef.current !== nextHeight) {
			lastHeightRef.current = nextHeight;
			onHeightChangeRef.current?.(nextHeight, {rowHeight: lineHeight});
		}
	}, [maxRows, minRows]);

	const scheduleResize = React.useCallback(() => {
		if (resizeScheduledRef.current) return;
		resizeScheduledRef.current = true;
		requestAnimationFrame(() => {
			resizeScheduledRef.current = false;
			resize();
		});
	}, [resize]);

	React.useEffect(() => {
		const el = elRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;

		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const width = entry.borderBoxSize?.[0]?.inlineSize ?? el.getBoundingClientRect().width;
			if (width !== lastWidthRef.current) {
				lastWidthRef.current = width;
				scheduleResize();
			}
		});

		ro.observe(el);
		return () => ro.disconnect();
	}, [scheduleResize]);

	const computedStyle = React.useMemo(
		(): React.CSSProperties => ({
			overflow: maxRows ? 'auto' : 'hidden',
			...style,
		}),
		[maxRows, style],
	);

	const handleInput = React.useCallback(
		(event: React.FormEvent<HTMLTextAreaElement>) => {
			resize();
			onInput?.(event);
		},
		[onInput, resize],
	);

	React.useLayoutEffect(() => {
		resize();
	}, [resize, props.value, props.defaultValue, rows]);

	return <textarea {...rest} ref={setRef} rows={resolvedRows} style={computedStyle} onInput={handleInput} />;
});

TextareaAutosize.displayName = 'TextareaAutosize';
