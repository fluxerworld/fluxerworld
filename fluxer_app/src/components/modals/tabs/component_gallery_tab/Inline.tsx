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

import {openFromEvent} from '@app/actions/ContextMenuActionCreators';
import {ButtonsTab} from '@app/components/modals/tabs/component_gallery_tab/ButtonsTab';
import {IndicatorsTab} from '@app/components/modals/tabs/component_gallery_tab/IndicatorsTab';
import styles from '@app/components/modals/tabs/component_gallery_tab/Inline.module.css';
import {InputsTab} from '@app/components/modals/tabs/component_gallery_tab/InputsTab';
import {OverlaysTab} from '@app/components/modals/tabs/component_gallery_tab/OverlaysTab';
import {SelectionsTab} from '@app/components/modals/tabs/component_gallery_tab/SelectionsTab';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuGroups} from '@app/components/uikit/context_menu/MenuGroups';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSlider} from '@app/components/uikit/context_menu/MenuItemSlider';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {RadioOption} from '@app/components/uikit/radio_group/RadioGroup';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	DotsThreeOutlineIcon,
	GearIcon,
	LinkSimpleIcon,
	PlayIcon,
	PlusIcon,
	ShareFatIcon,
	TrashIcon,
} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

export const ComponentGalleryInlineTab: React.FC = observer(() => {
	const {t} = useLingui();
	const [primarySwitch, setPrimarySwitch] = useState(true);
	const [dangerSwitch, setDangerSwitch] = useState(false);
	const [selectValue, setSelectValue] = useState('opt1');
	const [selectValue2, setSelectValue2] = useState('size-md');
	const [sliderValue, setSliderValue] = useState(42);
	const [sliderValue2, setSliderValue2] = useState(75);
	const [sliderValue3, setSliderValue3] = useState(50);
	const [sliderValue4, setSliderValue4] = useState(75);
	const [sliderValue5, setSliderValue5] = useState(60);
	const [color, setColor] = useState(0x3b82f6);
	const [color2, setColor2] = useState(0xff5733);
	const [radioValue, setRadioValue] = useState<'a' | 'b' | 'c'>('a');
	const [checkOne, setCheckOne] = useState(true);
	const [checkTwo, setCheckTwo] = useState(false);
	const [checkboxChecked, setCheckboxChecked] = useState(false);
	const [checkboxChecked2, setCheckboxChecked2] = useState(true);
	const [radioGroupValue, setRadioGroupValue] = useState<string>('option1');
	const [inputValue1, setInputValue1] = useState('');
	const [inputValue2, setInputValue2] = useState('');
	const [inputValue3, setInputValue3] = useState('');
	const [searchValue, setSearchValue] = useState('');
	const [emailValue, setEmailValue] = useState('');
	const [passwordValue, setPasswordValue] = useState('');
	const [textareaValue1, setTextareaValue1] = useState('');
	const [textareaValue2, setTextareaValue2] = useState('This is some example text in the textarea.');
	const [inlineEditValue, setInlineEditValue] = useState('EditableText');

	const radioOptions: Array<RadioOption<string>> = [
		{value: 'option1', name: t`First Option`, desc: t`This is the first option description`},
		{value: 'option2', name: t`Second Option`, desc: t`This is the second option description`},
		{value: 'option3', name: t`Third Option`, desc: t`This is the third option description`},
	];

	const handleOpenContextMenu = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			openFromEvent(event, ({onClose}) => (
				<MenuGroups>
					<MenuGroup>
						<MenuItem icon={<GearIcon size={16} />} onClick={() => onClose()}>
							<Trans>Settings</Trans>
						</MenuItem>
						<MenuItem icon={<ShareFatIcon size={16} />} onClick={() => onClose()}>
							<Trans>Share</Trans>
						</MenuItem>
						<MenuItem icon={<LinkSimpleIcon size={16} weight="bold" />} onClick={() => onClose()}>
							<Trans>Copy Link</Trans>
						</MenuItem>
					</MenuGroup>

					<MenuGroup>
						<CheckboxItem icon={<PlusIcon size={16} weight="bold" />} checked={checkOne} onCheckedChange={setCheckOne}>
							<Trans>Enable Extra Option</Trans>
						</CheckboxItem>
						<CheckboxItem icon={<PlusIcon size={16} weight="bold" />} checked={checkTwo} onCheckedChange={setCheckTwo}>
							<Trans>Enable Beta Feature</Trans>
						</CheckboxItem>
					</MenuGroup>

					<MenuGroup>
						<MenuItemRadio
							icon={<PlayIcon size={16} />}
							selected={radioValue === 'a'}
							onSelect={() => setRadioValue('a')}
						>
							<Trans>Mode A</Trans>
						</MenuItemRadio>
						<MenuItemRadio
							icon={<PlayIcon size={16} />}
							selected={radioValue === 'b'}
							onSelect={() => setRadioValue('b')}
						>
							<Trans>Mode B</Trans>
						</MenuItemRadio>
						<MenuItemRadio
							icon={<PlayIcon size={16} />}
							selected={radioValue === 'c'}
							onSelect={() => setRadioValue('c')}
						>
							<Trans>Mode C</Trans>
						</MenuItemRadio>
					</MenuGroup>

					<MenuGroup>
						<MenuItemSlider
							label={t`Opacity`}
							value={sliderValue}
							minValue={0}
							maxValue={100}
							onChange={(v: number) => setSliderValue(Math.round(v))}
							onFormat={(v: number) => `${Math.round(v)}%`}
						/>
					</MenuGroup>

					<MenuGroup>
						<MenuItemSubmenu
							label={t`More Actions`}
							icon={<DotsThreeOutlineIcon size={16} />}
							render={() => (
								<>
									<MenuItem onClick={() => onClose()}>
										<Trans>Duplicate</Trans>
									</MenuItem>
									<MenuItem onClick={() => onClose()}>
										<Trans>Archive</Trans>
									</MenuItem>
								</>
							)}
						/>
						<MenuItem icon={<TrashIcon size={16} />} danger onClick={() => onClose()}>
							<Trans>Delete</Trans>
						</MenuItem>
					</MenuGroup>
				</MenuGroups>
			));
		},
		[checkOne, checkTwo, radioValue, sliderValue],
	);

	return (
		<div className={styles.container}>
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>{t`Buttons`}</h3>
				<ButtonsTab openContextMenu={handleOpenContextMenu} />
			</div>
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>{t`Inputs & Text`}</h3>
				<InputsTab
					inputValue1={inputValue1}
					setInputValue1={setInputValue1}
					inputValue2={inputValue2}
					setInputValue2={setInputValue2}
					inputValue3={inputValue3}
					setInputValue3={setInputValue3}
					searchValue={searchValue}
					setSearchValue={setSearchValue}
					emailValue={emailValue}
					setEmailValue={setEmailValue}
					passwordValue={passwordValue}
					setPasswordValue={setPasswordValue}
					textareaValue1={textareaValue1}
					setTextareaValue1={setTextareaValue1}
					textareaValue2={textareaValue2}
					setTextareaValue2={setTextareaValue2}
					inlineEditValue={inlineEditValue}
					setInlineEditValue={setInlineEditValue}
					color={color}
					setColor={setColor}
					color2={color2}
					setColor2={setColor2}
				/>
			</div>
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>{t`Selections`}</h3>
				<SelectionsTab
					selectValue={selectValue}
					setSelectValue={setSelectValue}
					selectValue2={selectValue2}
					setSelectValue2={setSelectValue2}
					primarySwitch={primarySwitch}
					setPrimarySwitch={setPrimarySwitch}
					dangerSwitch={dangerSwitch}
					setDangerSwitch={setDangerSwitch}
					checkboxChecked={checkboxChecked}
					setCheckboxChecked={setCheckboxChecked}
					checkboxChecked2={checkboxChecked2}
					setCheckboxChecked2={setCheckboxChecked2}
					radioGroupValue={radioGroupValue}
					setRadioGroupValue={setRadioGroupValue}
					radioOptions={radioOptions}
					sliderValue={sliderValue}
					setSliderValue={setSliderValue}
					sliderValue2={sliderValue2}
					setSliderValue2={setSliderValue2}
					sliderValue3={sliderValue3}
					setSliderValue3={setSliderValue3}
					sliderValue4={sliderValue4}
					setSliderValue4={setSliderValue4}
					sliderValue5={sliderValue5}
					setSliderValue5={setSliderValue5}
				/>
			</div>
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>{t`Overlays & Menus`}</h3>
				<OverlaysTab openContextMenu={handleOpenContextMenu} />
			</div>
			<div>
				<h3 className={styles.sectionTitle}>{t`Indicators & Status`}</h3>
				<IndicatorsTab />
			</div>
		</div>
	);
});
