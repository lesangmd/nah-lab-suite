param([Parameter(Mandatory=$true)][string]$BackupDirectory,[string]$Repository='lesangmd/nah-lab-suite')
$ErrorActionPreference='Stop'
$expected='6b33b13104b53c124e5b675c10223306dcbdefbd05674a86be94793473b6790d'
$meta=Get-Content (Join-Path $BackupDirectory 'signing-private.json') -Raw | ConvertFrom-Json
$keystore=Join-Path $BackupDirectory 'NAH-Android-Baseline-v1.1.6.jks'
if (!(Test-Path $keystore)) { throw 'Existing baseline keystore is required. No replacement key will be generated.' }
$env:NAH_BASELINE_STORE_PASS=$meta.storePassword
try {
 $details=& keytool -list -v -keystore $keystore -alias $meta.alias -storepass:env NAH_BASELINE_STORE_PASS
 if ($LASTEXITCODE -ne 0) {throw 'Cannot open baseline keystore.'}
 $line=$details | Where-Object {$_ -match 'SHA256:'} | Select-Object -First 1
 $cert=($line -replace '.*SHA256:\s*','').Trim().ToLower().Replace(':','')
 if ($cert -ne $expected) {throw 'Keystore does not match the locked baseline certificate.'}
 $values=@{NAH_ANDROID_KEYSTORE_B64=[Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore));NAH_ANDROID_KEY_ALIAS=$meta.alias;NAH_ANDROID_KEYSTORE_PASSWORD=$meta.storePassword;NAH_ANDROID_KEY_PASSWORD=$meta.keyPassword;NAH_ANDROID_CERT_SHA256=$expected}
 foreach ($name in $values.Keys) {$values[$name] | & gh secret set $name --repo $Repository; if ($LASTEXITCODE -ne 0) {throw "Cannot configure $name"}}
 Write-Host 'New baseline signing secrets configured. Future releases must reuse this key.'
} finally {Remove-Item Env:NAH_BASELINE_STORE_PASS -ErrorAction SilentlyContinue; $meta=$null; $values=$null}
