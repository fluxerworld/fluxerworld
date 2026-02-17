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

package secrets

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
)

func RandomTokenURLSafe(nbytes int) string {
	b := make([]byte, nbytes)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand.Read failed: " + err.Error())
	}
	return base64.URLEncoding.EncodeToString(b)
}

func RandomTokenHex(nbytes int) string {
	b := make([]byte, nbytes)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand.Read failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}

func SafeAPIKey(prefix string, nbytes int) string {
	return prefix + RandomTokenHex(nbytes)
}

type Secrets struct {
	KVPassword              string `json:"kv_password"`
	LiveKitAPIKey           string `json:"livekit_api_key"`
	LiveKitAPISecret        string `json:"livekit_api_secret"`
	TURNUsername            string `json:"turn_username"`
	TURNPassword            string `json:"turn_password"`
	BlueskyOAuthPrivateKey  string `json:"bluesky_oauth_private_key"`
	BlueskyOAuthKeyID       string `json:"bluesky_oauth_key_id"`
}

func GenerateBlueskyOAuthRSAKey() (string, error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", err
	}

	privateKeyBytes := x509.MarshalPKCS1PrivateKey(privateKey)
	privateKeyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateKeyBytes,
	})

	return string(privateKeyPEM), nil
}

func GenerateNewSecrets() *Secrets {
	blueskyPrivateKey, err := GenerateBlueskyOAuthRSAKey()
	if err != nil {
		panic("Failed to generate Bluesky OAuth RSA key: " + err.Error())
	}

	return &Secrets{
		KVPassword:             RandomTokenURLSafe(24),
		LiveKitAPIKey:          SafeAPIKey("lk_", 16),
		LiveKitAPISecret:       RandomTokenURLSafe(48),
		TURNUsername:           "livekit",
		TURNPassword:           RandomTokenURLSafe(48),
		BlueskyOAuthPrivateKey: blueskyPrivateKey,
		BlueskyOAuthKeyID:      "prod-key-1",
	}
}
