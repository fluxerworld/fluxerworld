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

import surfaceStyles from '@app/components/form/FormSurface.module.css';
import styles from '@app/components/form/Input.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {shouldDisableAutofocusOnMobile} from '@app/lib/AutofocusUtils';
import {
	type InputWithPasswordManagerIgnoreAttributes,
	PASSWORD_MANAGER_IGNORE_ATTRIBUTES,
	shouldApplyPasswordManagerIgnoreAttributes,
	type TextareaWithPasswordManagerIgnoreAttributes,
} from '@app/lib/PasswordManagerAutocomplete';
import type {TextareaAutosizeProps} from '@app/lib/TextareaAutosize';
import {TextareaAutosize} from '@app/lib/TextareaAutosize';
import scrollerStyles from '@app/styles/Scroller.module.css';
import {useLingui} from '@lingui/react/macro';
import {EyeIcon, EyeSlashIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import lodash from 'lodash';
import React, {useCallback, useMemo, useRef, useState} from 'react';

type FieldSetProps = React.HTMLProps<HTMLFieldSetElement> & {
	children: React.ReactNode;
	error?: string;
	footer?: React.ReactNode;
	label?: string;
	labelRight?: React.ReactNode;
	htmlFor?: string;
};

const FieldSet = React.forwardRef<HTMLFieldSetElement, FieldSetProps>(
	({label, labelRight, children, error, footer, htmlFor}, ref) => (
		<fieldset ref={ref} className={styles.fieldset}>
			{label && (
				<div className={styles.labelContainer}>
					<label htmlFor={htmlFor} className={styles.label}>
						{label}
					</label>
					{labelRight}
				</div>
			)}
			<div className={styles.inputGroup}>
				{children}
				{error && <span className={styles.errorText}>{error}</span>}
			</div>
			{footer}
		</fieldset>
	),
);

FieldSet.displayName = 'FieldSet';

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null): void => {
	if (typeof ref === 'function') {
		ref(value);
	} else if (ref && typeof ref === 'object') {
		(ref as React.MutableRefObject<T | null>).current = value;
	}
};

export interface RenderInputArgs {
	inputProps: InputWithPasswordManagerIgnoreAttributes;
	inputClassName: string;
	ref: React.Ref<HTMLInputElement>;
	defaultInput: React.ReactNode;
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
	error?: string;
	footer?: React.ReactNode;
	label?: string;
	labelRight?: React.ReactNode;
	leftElement?: React.ReactNode;
	rightElement?: React.ReactNode;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	renderInput?: (args: RenderInputArgs) => React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
	(
		{
			error,
			footer,
			label,
			labelRight,
			type,
			leftElement,
			rightElement,
			leftIcon,
			rightIcon,
			className,
			renderInput,
			disabled,
			readOnly,
			...props
		},
		forwardedRef,
	) => {
		const {t} = useLingui();
		const disableAutofocus = shouldDisableAutofocusOnMobile();
		const [showPassword, setShowPassword] = useState(false);
		const isPasswordType = type === 'password';
		const shouldIgnorePasswordManagers = useMemo(() => shouldApplyPasswordManagerIgnoreAttributes(type), [type]);
		const resolveInputType = useCallback((): string | undefined => {
			if (!isPasswordType) return type;
			return showPassword ? 'text' : 'password';
		}, [isPasswordType, showPassword, type]);
		const inputType = useMemo(() => resolveInputType(), [resolveInputType]);
		const hasRightElement = useMemo(
			() => isPasswordType || rightElement || rightIcon,
			[isPasswordType, rightElement, rightIcon],
		);
		const hasLeftElement = useMemo(() => !!leftElement, [leftElement]);
		const hasLeftIcon = useMemo(() => !!leftIcon, [leftIcon]);
		const inputRef = useRef<HTMLInputElement | null>(null);
		const inputWrapperRef = useRef<HTMLDivElement | null>(null);

		const setInputRefs = useCallback(
			(node: HTMLInputElement | null) => {
				inputRef.current = node;
				assignRef(forwardedRef, node);
			},
			[forwardedRef],
		);

		const ariaInvalid = !!error;
		const hasControlledValue = props.value !== undefined;
		const shouldForceReadOnly = useMemo(
			() => hasControlledValue && typeof props.onChange !== 'function',
			[hasControlledValue, props.onChange],
		);
		const normalizedReadOnly = readOnly ?? shouldForceReadOnly;
		const inputClassName = useMemo(
			() =>
				clsx(
					surfaceStyles.surface,
					styles.input,
					styles.minHeight,
					hasRightElement && styles.hasRightElement,
					(hasLeftIcon || hasLeftElement) && styles.hasLeftIcon,
					hasLeftElement && styles.hasLeftElement,
					error ? styles.error : styles.focusable,
					className,
				),
			[hasRightElement, hasLeftIcon, hasLeftElement, error, className],
		);

		const inputProps: InputWithPasswordManagerIgnoreAttributes = useMemo(
			() => ({
				...props,
				...(shouldIgnorePasswordManagers ? PASSWORD_MANAGER_IGNORE_ATTRIBUTES : {}),
				autoFocus: disableAutofocus ? false : props.autoFocus,
				disabled,
				readOnly: normalizedReadOnly,
				type: inputType,
				'aria-invalid': ariaInvalid || undefined,
			}),
			[props, shouldIgnorePasswordManagers, disableAutofocus, disabled, normalizedReadOnly, inputType, ariaInvalid],
		);

		const defaultInput = useMemo(
			() => <input {...inputProps} className={inputClassName} ref={setInputRefs} />,
			[inputProps, inputClassName, setInputRefs],
		);

		const renderedInput = useMemo(
			() =>
				renderInput
					? renderInput({
							inputProps,
							inputClassName,
							ref: setInputRefs,
							defaultInput,
						})
					: defaultInput,
			[renderInput, inputProps, inputClassName, setInputRefs, defaultInput],
		);

		const handlePasswordToggle = useCallback(() => {
			setShowPassword(!showPassword);
		}, [showPassword]);

		const passwordToggleLabel = useMemo(() => (showPassword ? t`Hide password` : t`Show password`), [showPassword, t]);

		const inputContent = useMemo(
			() => (
				<div ref={inputWrapperRef} className={styles.inputWrapper}>
					{leftElement && <div className={styles.leftElement}>{leftElement}</div>}
					{leftIcon && !leftElement && <div className={styles.leftIcon}>{leftIcon}</div>}
					{renderedInput}
					{isPasswordType && (
						<button
							type="button"
							className={styles.passwordToggle}
							onClick={handlePasswordToggle}
							aria-label={passwordToggleLabel}
						>
							{showPassword ? <EyeSlashIcon size={18} weight="fill" /> : <EyeIcon size={18} weight="fill" />}
						</button>
					)}
					{!isPasswordType && rightIcon && <div className={styles.rightIcon}>{rightIcon}</div>}
					{!isPasswordType && rightElement && <div className={styles.rightElement}>{rightElement}</div>}
				</div>
			),
			[
				inputWrapperRef,
				leftElement,
				leftIcon,
				renderedInput,
				isPasswordType,
				handlePasswordToggle,
				passwordToggleLabel,
				showPassword,
				rightIcon,
				rightElement,
			],
		);

		const focusDecoratedInput = useMemo(
			() => (
				<FocusRing focusTarget={inputRef} ringTarget={inputWrapperRef} offset={-2} enabled={!disabled}>
					{inputContent}
				</FocusRing>
			),
			[inputRef, inputWrapperRef, disabled, inputContent],
		);

		if (!label) {
			return (
				<div className={styles.inputContainer}>
					{focusDecoratedInput}
					{error && <span className={styles.errorText}>{error}</span>}
					{footer}
				</div>
			);
		}

		return (
			<FieldSet
				error={error}
				footer={footer}
				label={label}
				labelRight={labelRight}
				htmlFor={props.id as string | undefined}
			>
				{focusDecoratedInput}
			</FieldSet>
		);
	},
);

Input.displayName = 'Input';

const BaseTextarea = React.forwardRef<HTMLTextAreaElement, TextareaAutosizeProps>(({className, ...rest}, ref) => (
	<TextareaAutosize
		{...lodash.omit(rest, 'style')}
		className={clsx(surfaceStyles.surface, styles.input, scrollerStyles.scroller, className)}
		ref={ref}
	/>
));

BaseTextarea.displayName = 'BaseTextarea';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
	error?: string;
	footer?: React.ReactNode;
	label: string;
	minRows?: number;
	maxRows?: number;
	showCharacterCount?: boolean;
	actionButton?: React.ReactNode;
	innerActionButton?: React.ReactNode;
	characterCountTooltip?: (remaining: number, total: number, current: number) => React.ReactNode;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
			error,
			footer,
			label,
			minRows = 2,
			maxRows = 10,
			showCharacterCount,
			maxLength,
			value,
			actionButton,
			innerActionButton,
			characterCountTooltip,
			disabled,
			id,
			...props
		},
		forwardedRef,
	) => {
		const disableAutofocus = shouldDisableAutofocusOnMobile();
		const currentValue = useMemo(() => value || '', [value]);
		const currentLength = useMemo(() => String(currentValue).length, [currentValue]);
		const textareaRef = useRef<HTMLTextAreaElement | null>(null);
		const textareaWrapperRef = useRef<HTMLDivElement | null>(null);

		const setTextareaRefs = useCallback(
			(node: HTMLTextAreaElement | null) => {
				textareaRef.current = node;
				assignRef(forwardedRef, node);
			},
			[forwardedRef],
		);

		const sanitizedProps = useMemo(
			(): TextareaWithPasswordManagerIgnoreAttributes => ({
				...lodash.omit(props, 'style'),
				...PASSWORD_MANAGER_IGNORE_ATTRIBUTES,
				autoFocus: disableAutofocus ? false : props.autoFocus,
			}),
			[props, disableAutofocus],
		);
		const textareaProps = useMemo(
			() => ({
				...sanitizedProps,
				id,
				'aria-invalid': !!error,
				maxRows,
				minRows,
				maxLength,
				value,
				disabled,
			}),
			[sanitizedProps, id, error, maxRows, minRows, maxLength, value, disabled],
		);

		const characterCounter = useMemo(
			() =>
				showCharacterCount &&
				maxLength && (
					<span className={styles.characterCount}>
						{currentLength}/{maxLength}
					</span>
				),
			[showCharacterCount, maxLength, currentLength],
		);

		const labelRight = useMemo(
			() => (
				<div className={styles.labelContainerWithGap}>
					{!innerActionButton && characterCounter}
					{actionButton}
				</div>
			),
			[innerActionButton, characterCounter, actionButton],
		);

		const textareaWithActions = useMemo(
			() =>
				innerActionButton ? (
					<div
						ref={textareaWrapperRef}
						className={clsx(styles.textareaWrapper, surfaceStyles.surface, error ? styles.error : styles.focusable)}
					>
						<TextareaAutosize
							{...textareaProps}
							className={clsx(scrollerStyles.scroller, scrollerStyles.scrollerTextarea, styles.textarea)}
							ref={setTextareaRefs}
						/>
						<div className={styles.textareaActions}>
							{innerActionButton}
							{showCharacterCount && maxLength && (
								<div className={styles.characterCountContainer}>
									{characterCountTooltip ? (
										characterCountTooltip(maxLength - currentLength, maxLength, currentLength)
									) : (
										<span className={styles.characterCount}>
											{currentLength}/{maxLength}
										</span>
									)}
								</div>
							)}
						</div>
					</div>
				) : null,
			[
				innerActionButton,
				textareaWrapperRef,
				error,
				textareaProps,
				setTextareaRefs,
				showCharacterCount,
				maxLength,
				characterCountTooltip,
				currentLength,
			],
		);

		const simpleTextarea = useMemo(
			() =>
				!innerActionButton ? (
					<BaseTextarea
						{...textareaProps}
						className={clsx(error ? styles.error : styles.focusable)}
						ref={setTextareaRefs}
					/>
				) : null,
			[innerActionButton, textareaProps, error, setTextareaRefs],
		);

		const ringTarget = useMemo(
			() => (innerActionButton ? textareaWrapperRef : textareaRef),
			[innerActionButton, textareaWrapperRef, textareaRef],
		);
		const control = useMemo(
			() => (innerActionButton ? textareaWithActions : simpleTextarea)!,
			[innerActionButton, textareaWithActions, simpleTextarea],
		);

		return (
			<FieldSet error={error} footer={footer} label={label} labelRight={labelRight} htmlFor={id}>
				<FocusRing focusTarget={textareaRef} ringTarget={ringTarget} offset={-2} enabled={!disabled}>
					{control}
				</FocusRing>
			</FieldSet>
		);
	},
);

Textarea.displayName = 'Textarea';
