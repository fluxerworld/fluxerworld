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

package errors

import "fmt"

type LiveKitCtlError struct {
	Message string
	Err     error
}

func (e *LiveKitCtlError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

func (e *LiveKitCtlError) Unwrap() error {
	return e.Err
}

type CmdError struct {
	LiveKitCtlError
}

func NewCmdError(msg string, err error) *CmdError {
	return &CmdError{LiveKitCtlError{Message: msg, Err: err}}
}

type ValidationError struct {
	LiveKitCtlError
}

func NewValidationError(msg string) *ValidationError {
	return &ValidationError{LiveKitCtlError{Message: msg}}
}

type PlatformError struct {
	LiveKitCtlError
}

func NewPlatformError(msg string) *PlatformError {
	return &PlatformError{LiveKitCtlError{Message: msg}}
}

func NewPlatformErrorf(format string, args ...interface{}) *PlatformError {
	return &PlatformError{LiveKitCtlError{Message: fmt.Sprintf(format, args...)}}
}
