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

package validate

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
)

var labelRE = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)
var tldRE = regexp.MustCompile(`^[a-z]{2,63}$`)

func RequireDomain(name, field string) (string, error) {
	name = strings.TrimSpace(strings.ToLower(name))
	if len(name) < 1 || len(name) > 253 {
		return "", errors.NewValidationError("Invalid " + field + ": " + name)
	}
	parts := strings.Split(name, ".")
	if len(parts) < 2 {
		return "", errors.NewValidationError("Invalid " + field + ": " + name)
	}
	for i, part := range parts {
		if len(part) < 1 || len(part) > 63 {
			return "", errors.NewValidationError("Invalid " + field + ": " + name)
		}
		if i == len(parts)-1 {
			if !tldRE.MatchString(part) {
				return "", errors.NewValidationError("Invalid " + field + ": " + name)
			}
		} else {
			if !labelRE.MatchString(part) {
				return "", errors.NewValidationError("Invalid " + field + ": " + name)
			}
		}
	}
	return name, nil
}

func RequireEmail(email string) (string, error) {
	email = strings.TrimSpace(email)
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") ||
		strings.HasPrefix(email, "@") || strings.HasSuffix(email, "@") {
		return "", errors.NewValidationError("Email does not look valid.")
	}
	return email, nil
}

var versionRE = regexp.MustCompile(`^\d+\.\d+\.\d+$`)
var branchRE = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_-]*$`)

func NormaliseVersionTag(v string) (string, error) {
	v = strings.TrimSpace(v)
	if v == "latest" {
		return v, nil
	}
	if strings.HasPrefix(v, "v") {
		return v, nil
	}
	if versionRE.MatchString(v) {
		return "v" + v, nil
	}
	if branchRE.MatchString(v) {
		return v, nil
	}
	return "", errors.NewValidationError("Invalid version: " + v)
}

func RequireWebhookURL(urlStr string, allowHTTP bool) (string, error) {
	u := strings.TrimSpace(urlStr)
	parsed, err := url.Parse(u)
	if err != nil {
		return "", errors.NewValidationError("Invalid webhook URL: " + u)
	}

	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return "", errors.NewValidationError("Invalid webhook URL scheme: " + u)
	}

	if parsed.Scheme == "http" && !allowHTTP {
		return "", errors.NewValidationError("Refusing insecure webhook URL: " + u)
	}

	if parsed.Host == "" {
		return "", errors.NewValidationError("Invalid webhook URL host: " + u)
	}

	return u, nil
}
