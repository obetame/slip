# Security

Slip is a household board on the local network. It is not a service for the public internet.

## What it does

- Listens for connections from loopback, private, and link-local addresses. Public addresses are refused. `X-Forwarded-For` is ignored, so a reverse proxy cannot widen this check.
- Stores the household passphrase only as an Argon2id hash. The passphrase is never written to the log.
- Gives each browser an HttpOnly session cookie for 180 days. The disk copy is a SHA-256 of the token.
- Slows passphrase guessing: 8 failures in 10 minutes lock that address for 15 minutes.
- Lets a device finish setup only from loopback, and only once.
- Requires `X-Slip: 1` on changes, and refuses a cross-site `Origin`.
- Serves HTML and SVG uploads as downloads (`application/octet-stream`), never inline. JPEG, PNG, GIF, WebP, and PDF may be shown inline.
- Sets `nosniff`, denies framing, and sends a Content Security Policy with no inline scripts.
- Keeps a secret slip's body out of the listing, expires it, and can burn it once another browser has read it.
- With a code, writes a secret to disk as ciphertext under Argon2id and AES-256-GCM, and stores the code nowhere. Ten wrong codes destroy the slip.

## What it does not do

The page is HTTP. Anyone on the same network who can see the traffic can read a slip and the passphrase at the moment they are sent. A guest on the Wi-Fi is on that network. A router port-forward still looks like a private address to Slip, so the passphrase is the lock, not the address check.

A code on a secret protects the copy on disk, not the wire: the body and the code are readable to anyone who can see the traffic when the slip is put down and again when it is read. A secret is also not private from the household. It is hidden from the board and it expires, but anyone signed in who is told the code can open it, which is what makes handing a token to another device work.

Deleting is not shredding. The file is rewritten without the slip, but a backup, a filesystem journal, or the flash on an SSD may still hold the old bytes. If a secret must not survive anywhere, do not put it here.

Do not reuse a passphrase from email, a bank, or anything else that matters. Do not put Slip on a network you do not trust. Do not publish the port.

Changing the passphrase signs out every browser except the one that changed it. "Sign out everywhere" drops every session, including this one.

## Reporting

Please use a private [GitHub security advisory](https://github.com/obetame/slip/security/advisories/new).

Include the version, what you expected, and what happened. Do not include the household passphrase, a copy of `config.json`, or a session cookie.
