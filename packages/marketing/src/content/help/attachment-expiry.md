Fluxer automatically expires older attachments. Smaller files stay available longer; bigger ones expire sooner. If people view a message with a file when it is close to expiring, we extend it so it stays available.

## How expiry is decided

- The clock starts when you upload.
- Files **5 MB or smaller** keep links for about **3 years** (the longest window).
- Files near **500 MB** keep links for about **14 days** (the shortest window).
- Between 5 MB and 500 MB, larger files get shorter windows and smaller files get longer ones.
- Files over 500 MB are not accepted on the current plan.

## Extending availability when accessed

If a message with a file is loaded and the remaining time is inside the renewal window, we push the expiry forward. The renewal window depends on size: small files can renew up to about **30 days**; the largest files renew up to about **7 days**.

One view is enough to refresh it – you don't have to click or download the file. Multiple views inside the same window don't stack. The total lifetime is capped to the size-based budget, so repeated renewals can't keep a file available indefinitely.

## What happens after expiry

We regularly sweep expired attachments and delete them from our CDN and storage. There can be a short delay after the expiry time before removal.

## Why we expire attachments

- **Storage fairness**: Large media is costly to keep forever; expiring it keeps things fair for everyone.
- **Safety and privacy**: Clearing out long-lived uploads reduces the chance that old sensitive files linger.
- **Predictable limits**: Clear timeframes help you download what you need to keep.

## Keeping important files

Download attachments you need before they expire. For full account exports (including attachment URLs), see [Exporting your account data](/help/data-export).

## Frequently asked questions

**Does Plutonium extend file expiry?**
Not at this time. All users are subject to the same limits.

**Do I need to click or download a file to keep it available?**
No. Viewing the message in chat or search is enough.

**What about Saved Media?**
Saved Media lets you keep up to **50** files (or **500** with Plutonium). Saved Media is **not** subject to attachment expiry.

**Can I hide the expiry indicator?**
Yes. Go to User Settings > Messages & Media > Media and toggle off "Show Attachment Expiry Indicator".
