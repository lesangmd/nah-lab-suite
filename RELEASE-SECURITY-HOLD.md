# NAH LabSuite release security policy (HOLD)

* Android v1.1.15 starts a NEW permanent signing identity. Its signer is pinned in `signing-baseline.json` and `release-certificate.der`. Subsequent Android APKs **must** use that same private key. Do not rotate per release.
* An existing Android installation signed with the retired signer **cannot** be updated in place to the new certificate with the same package ID. Back up, synchronize and independently verify all local draft reports before any assisted migration. Never delete application data automatically.
* Windows v1.3.27 uses a self-signed certificate **for internal environments only**. It is not publicly trusted. Clients must establish explicit trust as permitted by hospital IT policy. Do not activate the public Windows updater until certificate trust, rollback and data-preservation QA pass.
* Keys/passwords are **never** committed to this repository. Store them in a restricted key vault; configure encrypted GitHub Actions Secrets privately.
* All workflows are manual-only or fail closed while full source synchronization is pending.
* Do not publish downloads, auto-update URLs or `releaseReady=true` without APK/EXE signature verification, SHA-256 checks and device acceptance testing.
