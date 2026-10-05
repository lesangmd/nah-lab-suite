param(
    [string]$OutputDirectory = ".\NAH-Android-Release-Key",
    [string]$Alias = "nah-lab-suite-release"
)

$ErrorActionPreference = "Stop"
$keytool = Get-Command keytool -ErrorAction Stop
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$keystore = Join-Path $OutputDirectory "NAH-Android-Release.jks"
$fingerprint = Join-Path $OutputDirectory "NAH-Android-Release-CERT-SHA256.txt"

if (Test-Path $keystore) {
    throw "Keystore already exists: $keystore. Refusing to overwrite the permanent signing identity."
}

Write-Host "NAH LAB SUITE - Permanent Android Release Keystore" -ForegroundColor Green
Write-Host "This key must be reused for every Android release from v1.1.5 onward." -ForegroundColor Yellow

$secureStore = Read-Host "Keystore password" -AsSecureString
$secureKey = Read-Host "Key password" -AsSecureString

$ptr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureStore)
$ptr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $storePass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr1)
    $keyPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr2)

    if ($storePass.Length -lt 16 -or $keyPass.Length -lt 16) {
        throw "Use passwords of at least 16 characters."
    }

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
    if ($LASTEXITCODE -ne 0) { throw "keytool failed." }

    $details = & $keytool.Source -list -v -keystore $keystore -alias $Alias -storepass $storePass
    if ($LASTEXITCODE -ne 0) { throw "Cannot read generated keystore." }

    $shaLine = $details | Where-Object { $_ -match "SHA256:" } | Select-Object -First 1
    if (-not $shaLine) { throw "Cannot find SHA-256 certificate fingerprint." }

    $sha = ($shaLine -replace '.*SHA256:\s*','').Trim().ToLower().Replace(':','')
    Set-Content -Path $fingerprint -Value $sha -Encoding ascii

    Write-Host ""
    Write-Host "Generated permanent signing identity:" -ForegroundColor Green
    Write-Host "  $keystore"
    Write-Host "  Certificate SHA-256: $sha"
    Write-Host ""
    Write-Host "Create these GitHub Actions secrets:" -ForegroundColor Cyan
    Write-Host "  NAH_ANDROID_KEYSTORE_B64"
    Write-Host "  NAH_ANDROID_KEY_ALIAS = $Alias"
    Write-Host "  NAH_ANDROID_KEYSTORE_PASSWORD"
    Write-Host "  NAH_ANDROID_KEY_PASSWORD"
    Write-Host "  NAH_ANDROID_CERT_SHA256 = $sha"
    Write-Host ""
    Write-Host "Copy JKS as base64 to clipboard with:" -ForegroundColor Cyan
    Write-Host "[Convert]::ToBase64String([IO.File]::ReadAllBytes('$keystore')) | Set-Clipboard"
    Write-Host ""
    Write-Host "Never commit the JKS, passwords, or base64 payload to Git." -ForegroundColor Yellow
}
finally {
    if ($ptr1 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr1) }
    if ($ptr2 -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr2) }
}
