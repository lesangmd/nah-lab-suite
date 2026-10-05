param(
    [string]$Repository = "lesangmd/nah-lab-suite",
    [string]$OutputDirectory = "$HOME\Documents\NAH-Android-Release-Key",
    [string]$Alias = "nah-lab-suite-release",
    [string]$Version = "1.1.5",
    [string]$VersionCode = "11005",
    [switch]$SkipWorkflow
)

$ErrorActionPreference = "Stop"

function ConvertFrom-Secure([Security.SecureString]$Secure) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$keytool = Get-Command keytool -ErrorAction Stop
$gh = Get-Command gh -ErrorAction Stop

& $gh.Source auth status
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not authenticated. Run: gh auth login" }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$keystore = Join-Path $OutputDirectory "NAH-Android-Release.jks"
$fingerprintFile = Join-Path $OutputDirectory "NAH-Android-Release-CERT-SHA256.txt"
$publicCertFile = Join-Path $OutputDirectory "NAH-Android-Release-PUBLIC-CERT.pem"

Write-Host ""
Write-Host "NAH LAB SUITE - Permanent Android signing setup" -ForegroundColor Green
Write-Host "Repository: $Repository"
Write-Host "Package: vn.nah.iso15189suite"
Write-Host "Release: v$Version ($VersionCode)"
Write-Host ""

if (Test-Path $keystore) {
    Write-Host "Existing permanent keystore found. It will be REUSED, not replaced:" -ForegroundColor Yellow
    Write-Host "  $keystore"
    $answer = Read-Host "Type REUSE to continue"
    if ($answer -ne "REUSE") { throw "Cancelled. Existing signing identity was not modified." }
} else {
    Write-Host "No keystore exists yet. A new permanent NAH release identity will now be created." -ForegroundColor Yellow
}

$secureStore = Read-Host "Keystore password (minimum 16 characters)" -AsSecureString
$secureKey = Read-Host "Key password (minimum 16 characters)" -AsSecureString
$storePass = ConvertFrom-Secure $secureStore
$keyPass = ConvertFrom-Secure $secureKey

try {
    if ($storePass.Length -lt 16 -or $keyPass.Length -lt 16) {
        throw "Passwords must contain at least 16 characters."
    }

    if (-not (Test-Path $keystore)) {
        $ktArgs = @(
            "-genkeypair",
            "-v",
            "-keystore", $keystore,
            "-storetype", "JKS",
            "-alias", $Alias,
            "-keyalg", "RSA",
            "-keysize", "4096",
            "-sigalg", "SHA256withRSA",
            "-validity", "36500",
            "-dname", "CN=NAH LAB SUITE, O=NAH, C=VN",
            "-storepass", $storePass,
            "-keypass", $keyPass
        )
        & $keytool.Source @ktArgs
        if ($LASTEXITCODE -ne 0) { throw "keytool failed while creating the release key." }
    }

    $details = & $keytool.Source -list -v -keystore $keystore -alias $Alias -storepass $storePass
    if ($LASTEXITCODE -ne 0) { throw "Cannot open the keystore with the supplied password/alias." }

    $shaLine = $details | Where-Object { $_ -match "SHA256:" } | Select-Object -First 1
    if (-not $shaLine) { throw "Could not read certificate SHA-256 fingerprint." }

    $certSha = ($shaLine -replace '.*SHA256:\s*','').Trim().ToLower().Replace(':','')
    if ($certSha -notmatch '^[0-9a-f]{64}$') { throw "Invalid certificate SHA-256 value." }
    Set-Content -Path $fingerprintFile -Value $certSha -Encoding ascii

    & $keytool.Source -exportcert -rfc -keystore $keystore -alias $Alias -storepass $storePass -file $publicCertFile
    if ($LASTEXITCODE -ne 0) { throw "Unable to export public certificate." }

    $jksBytes = [IO.File]::ReadAllBytes($keystore)
    $jksB64 = [Convert]::ToBase64String($jksBytes)

    Write-Host ""
    Write-Host "Permanent certificate SHA-256:" -ForegroundColor Green
    Write-Host "  $certSha"
    Write-Host ""
    Write-Host "Uploading encrypted GitHub Actions secrets..." -ForegroundColor Cyan

    $jksB64 | & $gh.Source secret set NAH_ANDROID_KEYSTORE_B64 --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Failed to set NAH_ANDROID_KEYSTORE_B64." }

    $Alias | & $gh.Source secret set NAH_ANDROID_KEY_ALIAS --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Failed to set NAH_ANDROID_KEY_ALIAS." }

    $storePass | & $gh.Source secret set NAH_ANDROID_KEYSTORE_PASSWORD --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Failed to set NAH_ANDROID_KEYSTORE_PASSWORD." }

    $keyPass | & $gh.Source secret set NAH_ANDROID_KEY_PASSWORD --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Failed to set NAH_ANDROID_KEY_PASSWORD." }

    $certSha | & $gh.Source secret set NAH_ANDROID_CERT_SHA256 --repo $Repository
    if ($LASTEXITCODE -ne 0) { throw "Failed to set NAH_ANDROID_CERT_SHA256." }

    Write-Host ""
    Write-Host "Configured secret names:" -ForegroundColor Green
    & $gh.Source secret list --repo $Repository

    if (-not $SkipWorkflow) {
        Write-Host ""
        Write-Host "Starting signed v$Version release workflow..." -ForegroundColor Cyan
        $wfArgs = @(
            "workflow", "run", "build-signed-release.yml",
            "--repo", $Repository,
            "--ref", "main",
            "-f", "release_version=$Version",
            "-f", "release_version_code=$VersionCode"
        )
        & $gh.Source @wfArgs
        if ($LASTEXITCODE -ne 0) { throw "GitHub workflow dispatch failed." }

        Start-Sleep -Seconds 3
        Write-Host ""
        Write-Host "Latest workflow runs:" -ForegroundColor Green
        & $gh.Source run list --repo $Repository --workflow build-signed-release.yml --limit 3
    }

    Write-Host ""
    Write-Host "Signing setup complete." -ForegroundColor Green
    Write-Host "Permanent JKS: $keystore"
    Write-Host "Fingerprint:   $fingerprintFile"
    Write-Host "Public cert:   $publicCertFile"
    Write-Host ""
    Write-Host "CRITICAL: make at least two encrypted offline backups of the JKS." -ForegroundColor Yellow
    Write-Host "Do not regenerate this signing identity for future Android releases." -ForegroundColor Yellow
}
finally {
    $storePass = $null
    $keyPass = $null
    $jksB64 = $null
}
