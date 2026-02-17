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

package download

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
)

type DownloadResult struct {
	Path           string
	SHA256Verified bool
}

func httpGet(url string, timeoutS int) ([]byte, error) {
	client := &http.Client{Timeout: time.Duration(timeoutS) * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "livekitctl/0.1")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

func httpHeadOK(url string, timeoutS int) bool {
	client := &http.Client{Timeout: time.Duration(timeoutS) * time.Second}
	req, err := http.NewRequest("HEAD", url, nil)
	if err != nil {
		return false
	}
	req.Header.Set("User-Agent", "livekitctl/0.1")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()

	return resp.StatusCode >= 200 && resp.StatusCode < 400
}

func parseSHA256File(text string) string {
	t := strings.TrimSpace(text)
	if t == "" {
		return ""
	}
	parts := strings.Fields(t)
	if len(parts) == 0 {
		return ""
	}
	h := strings.ToLower(strings.TrimSpace(parts[0]))
	if len(h) != 64 {
		return ""
	}
	for _, c := range h {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return ""
		}
	}
	return h
}

func DownloadWithOptionalSHA256(url, dest string, timeoutS, retries int) (*DownloadResult, error) {
	if timeoutS <= 0 {
		timeoutS = 30
	}
	if retries < 0 {
		retries = 0
	}

	var lastErr error
	for i := 0; i <= retries; i++ {
		data, err := httpGet(url, timeoutS)
		if err != nil {
			lastErr = err
			continue
		}

		dir := filepath.Dir(dest)
		if err := os.MkdirAll(dir, 0755); err != nil {
			lastErr = err
			continue
		}

		if err := os.WriteFile(dest, data, 0644); err != nil {
			lastErr = err
			continue
		}

		shaURL := url + ".sha256"
		verified := false
		if httpHeadOK(shaURL, timeoutS) {
			shaText, err := httpGet(shaURL, timeoutS)
			if err == nil {
				expected := parseSHA256File(string(shaText))
				if expected != "" {
					h := sha256.Sum256(data)
					got := hex.EncodeToString(h[:])
					if got != expected {
						lastErr = errors.NewCmdError(fmt.Sprintf("SHA256 mismatch for %s", url), nil)
						os.Remove(dest)
						continue
					}
					verified = true
				}
			}
		}

		return &DownloadResult{Path: dest, SHA256Verified: verified}, nil
	}

	return nil, errors.NewCmdError(fmt.Sprintf("Download failed: %s (%v)", url, lastErr), nil)
}
