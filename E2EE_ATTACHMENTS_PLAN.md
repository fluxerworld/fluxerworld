# E2EE Attachments — planning doc

Working notes for the next slice on the `e2ee` branch. Not committed
prose — read, scribble, push back.

## What's in scope for v1

- Image attachments (png/jpg/webp/gif).
- Generic file attachments (download-after-decrypt, no inline preview).
- Backwards compat with the existing v1 plaintext envelope (raw string).

Deferring:

- Video and audio (lazy-loading + range-request streaming makes these
  fundamentally harder; we'd need to fetch the whole ciphertext blob,
  decrypt, then play from a blob URL — fine for short clips, terrible
  for long ones).
- Voice messages (waveform metadata is exposed pre-encryption today;
  hiding it requires a separate scheme).
- Stickers (separate table; can defer).
- Animated GIF previews (treat as static image for v1; can revisit).
- Server-side thumbnails — encrypted bytes can't be thumbnailed.

## Wire format

Bump the Olm plaintext from a raw string to a versioned JSON envelope:

```json
{
  "v": 2,
  "text": "the actual message body",
  "attachments": [
    {
      "id": "<attachment.id from server response>",
      "key": "<base64 32-byte AES-256 key>",
      "iv":  "<base64 12-byte IV>",
      "mime": "image/png",
      "name": "vacation.png",
      "width": 1920,
      "height": 1080
    }
  ]
}
```

Decode rule: Olm decrypts → if the result starts with `{` and parses as
JSON with `v: 2`, treat as envelope. Otherwise treat the entire string
as v1 raw text (current behaviour preserved).

Open questions:

- **Match key for attachments.** The server assigns the attachment id
  on upload. We'd want the encrypted-payload envelope to carry the
  same id so the receiver can pair the key with the right
  `message.attachments[i]`. That means: the sender uploads first,
  *then* encrypts the resulting attachment-ids+keys into the envelope,
  *then* posts the message. Currently it's all one POST. Two options:
    1. Two-step upload: client gets attachment ids back from a
       /channels/:id/attachments endpoint, builds the envelope, then
       posts the actual message referencing those ids.
    2. Use a deterministic content-addressable id (e.g. SHA-256 of
       ciphertext) instead — sender + server both compute it.
  Option 1 is more invasive (new endpoint) but cleaner. Option 2 is
  hackier but unblocks v1 with no server changes.

- **Keys-per-device duplication.** Each recipient device gets its own
  Olm-encrypted copy of the envelope, so the AES keys are duplicated
  N times. Acceptable: 32+12 bytes per attachment per device, in a
  message that already does per-device ciphertexts.

## Server contract

- **Content-Type for ciphertext uploads.** Easiest path: upload as
  `application/octet-stream` with a generic filename like
  `encrypted.bin`. Server skips thumbnailing, proxy_url is useless
  but unused. The original mime + filename live in the envelope.
- **Size limit.** AES-GCM adds 16 bytes (auth tag). Negligible. Need
  to confirm the max-attachment-size check fires on encrypted size.
- **No new endpoints needed for v1** if we go with content-addressable
  ids. If we go with the two-step approach we'd need
  `POST /channels/:id/attachments` returning ids + signed upload urls.

## Render-path refactor

Single new hook/component `EncryptedBlobLoader` (probably in
`src/lib/e2ee/EncryptedAttachmentLoader.tsx`):

```ts
function useDecryptedAttachment(params: {
  url: string;          // ciphertext URL from message.attachments[i]
  key: string;          // base64 AES key from envelope
  iv: string;           // base64 IV from envelope
  mime: string;         // original mime to reapply on the blob
  enabled?: boolean;    // false until in viewport
}): {
  status: 'idle' | 'loading' | 'ready' | 'error';
  blobUrl: string | null;
  error: Error | null;
};
```

- Fetches ciphertext via `fetch(url)` (CORS already set up for media).
- AES-GCM decrypts to a `Blob`.
- Returns a `URL.createObjectURL(blob)` blob URL.
- Revokes on unmount.
- Caches keyed by `(url, key)` so re-renders don't re-decrypt.

Files that consume `attachment.url` / `attachment.proxy_url` and need
an "is this encrypted? get blob first" branch:

- `src/components/channel/embeds/attachments/Attachment.tsx`
- `src/components/channel/embeds/attachments/AttachmentMosaic.tsx`
- `src/components/channel/embeds/attachments/AttachmentSingleMedia.tsx`
- `src/components/channel/embeds/attachments/AttachmentFile.tsx`
- `src/components/channel/embeds/attachments/AttachmentGridItem.tsx`
- `src/components/channel/embeds/attachments/TextualAttachmentPreview.tsx`
- `src/components/channel/embeds/attachments/TextualAttachmentPreviewBottomSheet.tsx`
- `src/components/channel/MessageAttachmentUtils.tsx`

Probably easier to centralise: have each renderer call a tiny
`useResolvedAttachmentUrl(attachment, message)` that returns the
plaintext URL when not encrypted, the decrypted blob URL when
encrypted-and-ready, and a sentinel when loading.

## Sender pipeline

Order of operations when user hits Send with E2EE on + attachments:

1. For each File: generate AES-256 key + 12-byte IV, encrypt bytes,
   wrap in a new File named `encrypted.bin` with mime
   `application/octet-stream`.
2. Compute original-file metadata (dimensions for images, original
   name + mime) — this all goes in the envelope, not on the wire.
3. Upload encrypted Files via existing multipart path. Get attachment
   ids back.
4. Build v2 envelope with `text` + `attachments[{id, key, iv, mime,
   name, width, height}]`.
5. Encrypt envelope with `tryEncryptForChannel`.
6. POST message with empty content + ENCRYPTED flag + encrypted_payload.

Step 3 → step 4 sequencing is the awkward part — currently the
multipart POST sends payload_json + files as one request. Either:

- Split into two requests (matches option 1 in the wire format).
- Use content-addressable ids and build the envelope client-side
  before upload (matches option 2).

Recommend: **option 2 for v1** — generate `id = base64(sha256(ciphertext))`
client-side, send as `attachment.id` in payload_json, server stores by
that id. Faster to ship.

## Backwards compat

- Old client receiving v2 envelope: `JSON.parse` succeeds, but the
  client doesn't know what to do with `attachments[]`. Falls back to
  `text`-only rendering, attachments show as failed-decrypt
  placeholders. Acceptable degradation.
- New client receiving v1 raw string: detected by the leading `{`
  check, treated as plaintext content. Already covered by the format
  detection rule above.
- New client encrypting for an old client: we don't know the
  recipient's client version. Worst case the recipient sees garbled
  attachments. Mitigation: bump the v in the envelope, so a future
  client *could* refuse to send attachments to a peer whose registered
  client signals "v1 only". Not for v1.

## Edge cases

- **Spoiler flag** is on the attachment row, not the bytes — works as-is.
- **Lazy loading.** Existing attachment renderers use Intersection
  Observer for above-the-fold loading. The `enabled` flag on the hook
  defers fetch+decrypt until visible.
- **Memory.** Decrypted blobs sit in browser memory until revoked.
  Need to revoke aggressively on scroll-away. Probably the existing
  intersection observer already handles teardown — confirm.
- **Errors.** Decryption fails (wrong key, truncated bytes, key
  rotation issue) → show "couldn't decrypt this attachment" in place
  of the image. Don't crash the message bubble.
- **Retries.** If the multipart upload succeeds but the message POST
  fails, the encrypted bytes are orphaned on the server. Not a
  regression — same is true for plaintext attachments today.
- **CSP.** `blob:` URLs in `<img src>` and `<a href>` should already
  work (we use them elsewhere).
- **Per-message progress.** AES-GCM doesn't stream — we encrypt the
  whole file at once, then upload. Progress reporting works the same
  as today (XHR onprogress on the upload itself); no progress for the
  encrypt step, which is fast enough for typical sizes.

## Slice ordering

Smallest-first so each slice ships:

1. **v2 envelope, text-only.** Bump format, both directions decode.
   No attachments yet. Compatible with existing clients.
2. **EncryptedBlobLoader hook + image renderer integration.** Image
   renderers consume the loader. No way to *create* encrypted images
   yet — slice is purely receive-side, exercised via hand-crafted
   test messages.
3. **Sender pipeline for images only.** End-to-end image send/receive.
   Drop the "send unencrypted" prompt for image-only attachments;
   keep it for video/audio/files.
4. **Generic file renderer.** Decrypt-then-download for non-image mime
   types.
5. **Drop the prompt for all attachments.** Once everything is
   encryptable, the "couldn't encrypt" prompt goes back to being a
   peer-without-E2EE-only thing.

That's about ten files of real changes for slice 2 and 3. Slice 1 is
small. Slice 4 is small. Slice 5 is removal + UI polish.

## Open questions for you

1. Two-step upload endpoint or content-addressable ids?
2. v1 image-only, or do we stretch to all file types day one (slices
   3 + 4 land together)?
3. Anything I'm forgetting that's specific to how Fluxerworld
   diverges from the upstream Discord-clone path here?
