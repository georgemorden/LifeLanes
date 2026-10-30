# Security

Life Lanes is a local-first browser app. It does not send board data to a server, but data stored in `localStorage` is not encrypted and is accessible to anyone who can use the same browser profile.

Browser storage is shared by origin, not by URL path. On GitHub Pages, other projects hosted under the same `georgemorden.github.io` origin share that security boundary. Use a dedicated origin if stronger isolation is needed.

Exported backups and recovery copies contain board contents in plain text. Keep them private. Personal exports, environment files, credentials, browser authentication state and local databases are excluded by `.gitignore`; check staged files before committing, since ignore rules cannot protect files already tracked by Git.

## Reporting an issue

Please report suspected security or privacy issues privately through GitHub's security advisory feature rather than opening a public issue. Include the affected browser, reproduction steps, and the impact you observed.

## Supported version

Security fixes are applied to the latest version on `main`.
