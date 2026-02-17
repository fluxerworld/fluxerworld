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

package util

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"time"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
)

func Log(msg string) {
	fmt.Println(msg)
}

func Logf(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
}

func Which(binName string) string {
	path, err := exec.LookPath(binName)
	if err != nil {
		return ""
	}
	return path
}

type RunOptions struct {
	Check   bool
	Capture bool
	Env     []string
	Cwd     string
}

type RunResult struct {
	ExitCode int
	Output   string
}

func Run(cmd []string, opts RunOptions) (*RunResult, error) {
	if len(cmd) == 0 {
		return nil, errors.NewCmdError("empty command", nil)
	}

	c := exec.Command(cmd[0], cmd[1:]...)
	if opts.Cwd != "" {
		c.Dir = opts.Cwd
	}
	if len(opts.Env) > 0 {
		c.Env = append(os.Environ(), opts.Env...)
	}

	var output bytes.Buffer
	if opts.Capture {
		c.Stdout = &output
		c.Stderr = &output
	} else {
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
	}

	err := c.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, errors.NewCmdError(fmt.Sprintf("command not found: %s", cmd[0]), err)
		}
	}

	result := &RunResult{
		ExitCode: exitCode,
		Output:   output.String(),
	}

	if opts.Check && exitCode != 0 {
		return result, errors.NewCmdError(
			fmt.Sprintf("command failed (%d): %v\n%s", exitCode, cmd, result.Output),
			nil,
		)
	}

	return result, nil
}

func RunSimple(cmd []string) error {
	_, err := Run(cmd, RunOptions{Check: true, Capture: false})
	return err
}

func RunCapture(cmd []string) (string, error) {
	result, err := Run(cmd, RunOptions{Check: true, Capture: true})
	if err != nil {
		return "", err
	}
	return result.Output, nil
}

func RunCaptureNoCheck(cmd []string) (string, int) {
	result, _ := Run(cmd, RunOptions{Check: false, Capture: true})
	if result == nil {
		return "", -1
	}
	return result.Output, result.ExitCode
}

func AtomicWriteText(path string, content string, mode os.FileMode, uid, gid int) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tmpFile, err := os.CreateTemp(dir, ".tmp-")
	if err != nil {
		return err
	}
	tmpName := tmpFile.Name()

	_, err = tmpFile.WriteString(content)
	if err != nil {
		tmpFile.Close()
		os.Remove(tmpName)
		return err
	}

	if err := tmpFile.Sync(); err != nil {
		tmpFile.Close()
		os.Remove(tmpName)
		return err
	}

	tmpFile.Close()

	if err := os.Chmod(tmpName, mode); err != nil {
		os.Remove(tmpName)
		return err
	}

	if uid >= 0 || gid >= 0 {
		if err := os.Chown(tmpName, uid, gid); err != nil {
			os.Remove(tmpName)
			return err
		}
	}

	return os.Rename(tmpName, path)
}

func ReadJSON(path string, v interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, v)
}

func WriteJSON(path string, v interface{}, mode os.FileMode, uid, gid int) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	content := string(data) + "\n"
	return AtomicWriteText(path, content, mode, uid, gid)
}

func NowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func EnsureDir(path string, mode os.FileMode, uid, gid int) error {
	if err := os.MkdirAll(path, mode); err != nil {
		return err
	}
	if err := os.Chmod(path, mode); err != nil {
		return err
	}
	if uid >= 0 || gid >= 0 {
		if err := os.Chown(path, uid, gid); err != nil {
			return err
		}
	}
	return nil
}

type UserGroup struct {
	UID int
	GID int
}

func LookupUserGroup(username string) *UserGroup {
	u, err := user.Lookup(username)
	if err != nil {
		return nil
	}

	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		return nil
	}

	gid, err := strconv.Atoi(u.Gid)
	if err != nil {
		return nil
	}

	return &UserGroup{UID: uid, GID: gid}
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func CopyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}
