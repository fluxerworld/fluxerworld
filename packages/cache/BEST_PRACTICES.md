# Cache package – best practices

Working document. Append new lessons as they arise.

---

## 1. Extract shared logic into focused, single-responsibility files

When two or more providers (KV, Redis, InMemory) share identical logic, extract it
into a dedicated file rather than duplicating it. Each extracted file should own
exactly one concern:

| File | Concern |
|---|---|
| `CacheProviderTypes.tsx` | Shared interfaces consumed by providers and callers (`CacheLogger`, `CacheTelemetry`, `CacheKeyClassifier`) |
| `CacheSerialization.tsx` | JSON parse/stringify helpers with error handling and truncation |
| `CacheLockValidation.tsx` | Lock key/token format validation, token generation, key formatting |
| `CacheKeyClassification.tsx` | Mapping a cache key to a telemetry dimension string |
| `RedisClientTypes.tsx` | `RedisClient` and `RedisPipeline` interface contracts |

**Why:** duplicated code drifts apart over time, bugs get fixed in one copy but not
another, and readers have to mentally diff near-identical methods.

---

## 2. Separate public contract types from implementation files

Types that callers or tests need to import (`CacheLogger`, `CacheTelemetry`,
`RedisClient`) belong in their own files – not buried inside a provider class.

**Rule of thumb:** if a type appears in an `import type` statement in a file that is
not the defining file, it deserves its own home.

**Before:**
```tsx
// KVCacheProvider.tsx defines AND exports CacheLogger
export interface CacheLogger { ... }
export class KVCacheProvider { ... }
```

**After:**
```tsx
// CacheProviderTypes.tsx – sole owner of the type
export interface CacheLogger { ... }

// KVCacheProvider.tsx – imports the type
import type {CacheLogger} from '@fluxer/cache/src/CacheProviderTypes';
```

---

## 3. Use an `instrumented` helper to collapse telemetry boilerplate

When every method in a class follows the same start/try/record-success/catch/record-error
pattern, extract it into a single private method:

```tsx
private async instrumented<T>(
  operation: string,
  key: string,
  fn: () => Promise<T>,
  statusResolver?: (result: T) => string,
): Promise<T> { ... }
```

Each call site then becomes one line of intent instead of 25 lines of ceremony:

```tsx
async get<T>(key: string): Promise<T | null> {
  return this.instrumented('get', key, async () => {
    const value = await this.client.get(key);
    if (value == null) return null;
    return safeJsonParse<T>(value, this.logger);
  }, (result) => (result == null ? 'miss' : 'hit'));
}
```

**Why:** the telemetry pattern was copy-pasted across `get`, `set`, `delete` with
only the operation name and status differing. A helper makes the unique logic visible
and the boilerplate invisible.

---

## 4. Keep serialisation consistent

Use `serializeValue()` and `safeJsonParse()` from `CacheSerialization.tsx` inside the
cache package rather than bare `JSON.stringify` / `JSON.parse`. Benefits:

- Parse errors are caught and logged with truncated values, not swallowed or thrown
  raw.
- A single place to add future concerns (metrics on parse failures, encoding changes,
  etc.).
- Callers outside the cache package doing their own `JSON.stringify` for HTTP bodies,
  worker queues, etc. do **not** need these helpers – they are cache-specific.

---

## 5. Centralise validation and make it reusable

Lock key and token validation was copy-pasted across all three providers with identical
regexes and error messages. `CacheLockValidation.tsx` now owns:

- `validateLockKey(key)` – throws on bad format
- `validateLockToken(token)` – throws on bad format
- `generateLockToken()` – `randomBytes(16).toString('hex')`
- `formatLockKey(key)` – returns `lock:${key}`

**Guideline:** if the same regex or format string appears in more than one file, it
should be a named export in a shared module.

---

## 6. Import from the defining file ("horse's mouth")

Per project conventions: all callsites import directly from the file that defines the
symbol. Never re-export. Never create barrel files.

```tsx
// Good
import type {CacheLogger} from '@fluxer/cache/src/CacheProviderTypes';

// Bad – importing a type from a file that re-exports it
import type {CacheLogger} from '@fluxer/cache/src/providers/KVCacheProvider';
```

When moving a type to a new home, grep for every import and update it in the same
change. Do not leave the old export as a compatibility shim.

---

## 7. Provider-specific config stays in the provider file

`KVCacheProviderConfig` stays in `KVCacheProvider.tsx` because it references
`IKVProvider`, which is specific to that implementation. Only types shared across
multiple providers get extracted.

**Heuristic:** if a type is only imported by a single file and its tests, it belongs
in that file.

---

## 8. Verify refactors with the full test suite, formatter, and type checker

After any structural refactor, run in order:

```bash
cd packages/cache && pnpm test          # all existing tests pass
pnpm biome check --write packages/cache/src/  # formatting (run from repo root)
cd packages/cache && pnpm typecheck     # type checking
```

Then spot-check downstream consumers:

```bash
cd packages/api && pnpm typecheck
```

Pre-existing failures in downstream packages are acceptable so long as **none of the
errors reference the refactored package**.

---

## 9. Do not over-extract

Not every use of `randomBytes` or `JSON.stringify` in the codebase needs to use the
cache package's helpers. Cache serialisation helpers are for **cache values**. Other
domains (SSO tokens, CSP nonces, HTTP bodies, worker queues) have their own
serialisation needs and should not couple to the cache package.

**Rule:** extract shared code within a bounded context (the cache package), not across
unrelated domains.

---

## 10. Naming conventions for extracted files

Follow the project's descriptive-filename convention. Avoid generic names:

| Good | Bad |
|---|---|
| `CacheLockValidation.tsx` | `Validation.tsx` |
| `CacheKeyClassification.tsx` | `Utils.tsx` |
| `CacheProviderTypes.tsx` | `Types.tsx` |
| `RedisClientTypes.tsx` | `RedisTypes.tsx` |

Domain-prefix every file so it is unambiguous in search results and import
auto-complete.

---

## 11. Avoid backwards-compatibility shims

When moving exports to new files, do not leave behind re-exports or aliases in the old
location. This creates indirection and lets stale imports survive indefinitely.
Instead:

1. Move the definition.
2. Update every import site in the same commit.
3. Delete the old export entirely.

---

## 12. Keep the abstract contract stable

`ICacheService` and `CacheMSetEntry` stay in `ICacheService.tsx`. They define the
public contract that all providers implement and all consumers depend on. Refactoring
provider internals should never change this file.

---

## 13. One import block, no blank lines inside

Per project conventions, keep a single contiguous import block at the top of each file
with no blank lines or code between imports. Let biome handle ordering.

```tsx
// Good
import {classifyKeyType} from '@fluxer/cache/src/CacheKeyClassification';
import {formatLockKey, generateLockToken} from '@fluxer/cache/src/CacheLockValidation';
import type {CacheLogger} from '@fluxer/cache/src/CacheProviderTypes';
import {safeJsonParse, serializeValue} from '@fluxer/cache/src/CacheSerialization';
import {ICacheService} from '@fluxer/cache/src/ICacheService';
```

---

## 14. Scope of `safeJsonParse` logger parameter

`safeJsonParse` accepts an optional `CacheLogger`. The KV provider passes its logger
so parse errors are reported. The Redis provider passes nothing (logs to console as a
fallback in the provider itself – now removed in favour of silent null return). The
InMemory provider does not call `safeJsonParse` at all because it stores native values,
not serialised strings.

When adding a new provider, decide up front whether parse errors should be logged and
pass the logger accordingly.

---

## 15. Watch for non-atomic operations

The Redis provider's `acquireLock` was (and remains, pending a proper fix) non-atomic:

```tsx
await this.client.set(lockKey, token);
await this.client.expire(lockKey, ttlSeconds);
```

Between these two calls, the lock exists without a TTL. If the process crashes, the
lock is held forever. The KV provider uses `SET ... EX ... NX` in a single command,
which is correct. When implementing distributed primitives, always prefer atomic
operations.

---

## 16. Downstream callsites should use shared utilities

After extracting shared logic, audit the rest of the codebase for consumers that
duplicate the same logic inline. Common patterns:

- `lock:${key}` string templates → `formatLockKey(key)`
- `crypto.randomBytes(16).toString('hex')` → `generateLockToken()`
- `Math.random().toString(36)...` → `generateLockToken()` (also a security fix)
- Mock implementations with inline lock validation → import from `CacheLockValidation`

Update downstream callsites in the same change to prevent the shared code from
becoming an orphan.

---

## 17. Never use Math.random() for tokens

`Math.random()` is not cryptographically secure. For any token used in locking,
authentication, or session management, use `crypto.randomBytes()` or the shared
`generateLockToken()` utility.

```tsx
// bad
const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// good
import {generateLockToken} from '@fluxer/cache/src/CacheLockValidation';
const token = generateLockToken();
```

---

## 18. Remove no-op string operations

Watch for `.replace()` calls that silently match nothing:

```tsx
// bad — 'deletion_queue:rebuild_lock' doesn't contain 'lock:' as a prefix
// .replace('lock:', '') matches nothing and returns the original string unchanged
REBUILD_LOCK_KEY.replace('lock:', '')

// good — pass the key directly
REBUILD_LOCK_KEY
```

No-op operations are a sign the author assumed a different key format. Verify the
format and remove the dead code.

---

## 19. Mock implementations should use shared utilities

Test mocks (like `MockCacheService`) that implement lock acquisition should use the
same shared utilities as real providers:

```tsx
// bad — inline duplication
const lockKey = `lock:${key}`;
const token = crypto.randomBytes(16).toString('hex');

// good — shared utilities keep mocks consistent
import {formatLockKey, generateLockToken} from '@fluxer/cache/src/CacheLockValidation';
const lockKey = formatLockKey(key);
const token = generateLockToken();
```

This ensures mocks produce tokens in the same format as real providers and that
format changes propagate automatically.

---

## Changelog

| Date | Change |
|---|---|
| 2026-02-06 | Initial version from cache package refactoring |
| 2026-02-06 | Added downstream cleanup lessons (sections 16–19) |
