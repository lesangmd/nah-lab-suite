# NAH Android Release Signing

This repository is configured for one permanent Android signing identity.

## Locked application identity

- Package: `vn.nah.iso15189suite`
- Current release candidate: `v1.1.6`
- Current versionCode: `11006`
- Signing model: one persistent NAH-controlled release keystore for v1.1.5 and every later Android release

Do not replace the signing key after v1.1.5 is accepted. Android in-place upgrades require the same signing certificate.

## Required GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions:

- `NAH_ANDROID_KEYSTORE_B64`
- `NAH_ANDROID_KEY_ALIAS`
- `NAH_ANDROID_KEYSTORE_PASSWORD`
- `NAH_ANDROID_KEY_PASSWORD`
- `NAH_ANDROID_CERT_SHA256`

The private JKS file, passwords and base64 payload must never be committed to Git.

## Generate the permanent keystore

Run `tools/GENERATE-NAH-ANDROID-RELEASE-KEY.ps1` on a trusted Windows computer with Java/keytool installed.

Default alias: `nah-lab-suite-release`

Recommended key parameters used by the script: RSA 4096, SHA256withRSA, validity 36,500 days, distinguished name `CN=NAH LAB SUITE, O=NAH, C=VN`.

Keep at least two encrypted offline backups of the JKS file. Store passwords separately.

## Build flow

1. `Validate Android v1.1.6 source` compiles an unsigned release.
2. After all five secrets exist, manually run `Build signed Android release`.
3. The signing workflow builds directly from this repository, restores the JKS only from encrypted GitHub Actions secrets, zipaligns and signs the APK, verifies the certificate SHA-256 against `NAH_ANDROID_CERT_SHA256`, and outputs the signed APK as a workflow artifact.

## One-time migration

v1.1.4 was produced with an ephemeral test signer. If its private key is unavailable, moving to the permanent v1.1.5 signing identity requires one uninstall/reinstall.

After v1.1.5 is installed with the permanent key, later releases must retain the same package ID, keystore, alias and certificate, while increasing versionCode monotonically.

Loss of the private signing key prevents future in-place updates under the same package identity.


## One-step setup on the trusted Windows machine

Prerequisites:

- Java 17 / `keytool`
- GitHub CLI `gh`
- GitHub CLI authenticated to the `lesangmd` account with repository access

If needed:

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
winget install GitHub.cli
gh auth login
```

From the repository root, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\SETUP-AND-SIGN-NAH-ANDROID-v1.1.5.ps1
```

The script will:

1. create the permanent JKS only if one does not already exist;
2. refuse to overwrite an existing signing identity;
3. calculate and save the certificate SHA-256 fingerprint;
4. export the public certificate;
5. configure the five GitHub Actions secrets without committing them;
6. launch the `Build signed Android release` workflow for v1.1.5 / 11005.

The JKS is created by default under:

`%USERPROFILE%\Documents\NAH-Android-Release-Key\NAH-Android-Release.jks`

After creation, make at least two encrypted offline backups before treating v1.1.5 as the production signing baseline.

## Update 1.1.6 / Web 1.58.12

The native-sync-web-1.58.12 branch contains the current update. Validation succeeded. The signing run stopped at the permanent-secret gate because one or more required signing values were absent.

Reuse the existing permanent JKS, alias, passwords and approved certificate fingerprint. Restore the five named Actions secrets, then run Build signed Android release on branch native-sync-web-1.58.12 with version 1.1.6 and versionCode 11006. Do not run the older 1.1.5 setup script for this update; it can create a new key if none exists. Do not create a replacement key for an in-place upgrade. Private signing material should be configured directly on a trusted computer, never uploaded to the chat or repository.
