# Release HOLD — Android 1.1.15 / Web 1.58.56

This branch is a candidate. The full Android/Web 1.58.56 source has not yet been pushed. The verification gate intentionally rejects stale assets.

New permanent Android certificate SHA-256: `d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c`. Prior baseline certificate: `76a2a3289bd26bc255caa3465f609a1b83992b3f4fe0b44813e67296e01d52ac`.

**Android cannot install this build over the old signer with the same package name.** Before deleting or replacing a previous app, back up and verify all offline data and pending reports. Preserve previous installed app until migration plan is accepted. Never delete app data as an automated fallback.

Do not push PKCS12/PFX, passwords, GitHub Secrets, keystores, or .env files to the repository.

Signing secrets must be configured privately and the whole source synchronized before manually dispatching the signing workflow. The build must pass `tools/verify-source-release.py`, `apksigner verify --print-certs`, APK SHA-256 verification and device migration checks. Set `releaseReady=true` only with explicit approval after validation.

Windows Authenticode: currently only a **self-signed internal-only** certificate, not publicly trusted. Keep Windows production updater disabled until device trust and rollback are tested.
