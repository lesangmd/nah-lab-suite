# NAH LabSuite Windows: signed, in-place, user-approved updater.
# Does not manipulate the WebView2 user-data folder (offline drafts / credentials).
# No silent replacement of a running executable.
param([switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$manifestUrl = 'https://www.sachyhoc.com/wp-json/nah-iso15189/v1/app/update-manifest'
$installedVersion = [version]'1.3.27'
try {
    $fileVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'NAH-LAB-SUITE.exe')).FileVersion
    if ($fileVersion -match '^\d+\.\d+\.\d+(?:\.\d+)?$') { $installedVersion = [version]$fileVersion }
} catch { }
# Intentionally blank for candidate builds. Release engineering MUST pin the
# 40-hex thumbprint of the existing Authenticode release certificate here.
# NEVER copy a thumbprint supplied solely by the remote manifest into this constant.
$pinnedSigner = '77EFA11665FC70E54D392A3582AFB2C2F484230E'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exe = Join-Path $root 'NAH-LAB-SUITE.exe'
$working = Join-Path $env:LOCALAPPDATA 'NAH-LabSuite-Updates'
$staging = Join-Path $working 'staging'
$backup = Join-Path $working 'rollback'
$log = Join-Path $working 'updater.log'
New-Item -ItemType Directory -Force -Path $working | Out-Null
function Log([string]$s) { Add-Content -LiteralPath $log -Value ("$(Get-Date -Format o) " + $s) -Encoding UTF8 }
function Fail([string]$s) { Log "FAILED $s"; throw $s }
function EnsureHttpsDownload([string]$url) {
    $u = [uri]$url
    if ($u.Scheme -ne 'https' -or $u.Host -notin @('sachyhoc.com','www.sachyhoc.com') -or
        $u.AbsolutePath -notmatch '^/wp-content/plugins/nah-iso15189-suite/updates/[A-Za-z0-9_.-]+\.zip$' -or
        $u.UserInfo -or $u.Fragment) { Fail 'Đường dẫn tải bản cập nhật không hợp lệ.' }
}
function GetSignedExe([string]$path,[string]$trustedSigner) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Fail 'Không tìm thấy chương trình mới trong ZIP.' }
    $sig = Get-AuthenticodeSignature -LiteralPath $path
    if ($sig.Status -ne 'Valid' -or $null -eq $sig.SignerCertificate) { Fail 'Chương trình mới không có chữ ký Authenticode hợp lệ.' }
    if ($sig.SignerCertificate.Thumbprint.ToUpperInvariant() -ne $trustedSigner.ToUpperInvariant()) {
        Fail 'Chứng chỉ ký EXE khác chứng chỉ phát hành đã ghim; từ chối cập nhật.'
    }
}
function ExtractCheckedZip([string]$archive,[string]$destination) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $prefix = [IO.Path]::GetFullPath($destination + [IO.Path]::DirectorySeparatorChar)
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.Contains([char]92) -or $entry.FullName.StartsWith('/') -or $entry.FullName.Contains(':')) { Fail 'Tên tệp ZIP không an toàn.' }
            $output = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName.Replace('/',[IO.Path]::DirectorySeparatorChar)))
            if (-not $output.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)) { Fail 'ZIP chứa đường dẫn ngoài thư mục tạm.' }
            if ($entry.Name -eq '') { New-Item -Path $output -ItemType Directory -Force | Out-Null; continue }
            New-Item -Path (Split-Path -Parent $output) -ItemType Directory -Force | Out-Null
            $inputStream = $entry.Open()
            $outputStream = [IO.File]::Create($output)
            try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose(); $inputStream.Dispose() }
        }
    } finally { $zip.Dispose() }
}
try {
    # GET is unauthenticated; do not rely on signed-in WebView cookies.
    $m = Invoke-RestMethod -Method Get -Uri ($manifestUrl + '?_ts=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -TimeoutSec 25 -Headers @{ 'Cache-Control'='no-cache' }
    $e = $m.platforms.desktop
    if ($null -eq $e -or $e.available -ne $true -or $e.releaseReady -ne $true) {
        Write-Host 'Chưa có bản Windows đã duyệt để cập nhật.'; exit 0
    }
    if ([version]$e.version -le $installedVersion) { Write-Host 'Windows Native đang ở phiên bản mới nhất.'; exit 0 }
    if ($e.signatureRequired -ne $true -or $e.sha256 -notmatch '^[a-fA-F0-9]{64}$' -or
        $e.authenticodeSignerThumbprint -notmatch '^[a-fA-F0-9]{40}$') { Fail 'Thiếu xác nhận phát hành và chữ ký.' }
    if ($pinnedSigner -notmatch '^[a-fA-F0-9]{40}$') { Fail 'Chưa ghim chứng chỉ ký Windows; không cho phép cập nhật tự động trên bản ứng viên.' }
    if ($pinnedSigner.ToUpperInvariant() -ne ([string]$e.authenticodeSignerThumbprint).ToUpperInvariant()) { Fail 'Chứng chỉ phát hành không trùng chứng chỉ đã ghim trong ứng dụng.' }
    EnsureHttpsDownload([string]$e.downloadUrl)
    if ($CheckOnly) { Write-Host ('Có bản cập nhật Windows v'+$e.version); exit 0 }
    Write-Host ('Đang tải Windows v'+$e.version+' vào vùng tạm...')
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Force -Recurse }
    New-Item -Path $staging -ItemType Directory | Out-Null
    $archive = Join-Path $working 'candidate.zip'
    Invoke-WebRequest -Uri $e.downloadUrl -OutFile $archive -TimeoutSec 180 -MaximumRedirection 0
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash
    if ($actualHash -ne ([string]$e.sha256).ToUpperInvariant()) { Fail 'SHA-256 của ZIP không trùng bản đã phát hành.' }
    ExtractCheckedZip $archive $staging
    $candidates = @(Get-ChildItem -LiteralPath $staging -Filter 'NAH-LAB-SUITE.exe' -Recurse -File)
    if ($candidates.Count -ne 1) { Fail 'ZIP phải có đúng một tệp NAH-LAB-SUITE.exe.' }
    $newDir = $candidates[0].DirectoryName
    $newExe = $candidates[0].FullName
    if (-not (Test-Path -LiteralPath (Join-Path $newDir 'offline/index.html'))) { Fail 'ZIP thiếu bộ tài nguyên ngoại tuyến.' }
    GetSignedExe $newExe $pinnedSigner
    $newUpdateScript = Join-Path $newDir 'NAH-UPDATE.ps1'
    if (-not (Test-Path -LiteralPath $newUpdateScript)) { Fail 'ZIP thiếu trình cập nhật đã ký số.' }
    GetSignedExe $newUpdateScript $pinnedSigner
    Write-Host 'Gói cập nhật hợp lệ. Hãy lưu mọi biểu mẫu đang soạn và đóng NAH LAB SUITE.'
    $deadline = [DateTime]::UtcNow.AddMinutes(10)
    while (@(Get-Process -Name 'NAH-LAB-SUITE' -ErrorAction SilentlyContinue).Count -gt 0) {
        if ([DateTime]::UtcNow -gt $deadline) { Fail 'Hết thời gian chờ đóng ứng dụng. Chưa thay đổi tệp cài đặt.' }
        Start-Sleep -Seconds 2
    }
    $oldOffline=Join-Path $root 'offline'
    $oldExe=Join-Path $root 'NAH-LAB-SUITE.exe'
    $newOffline=Join-Path $newDir 'offline'
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
    New-Item -Path $backup -ItemType Directory -Force | Out-Null
    # Copy to separate staging inside same volume before swapping.
    $readyOffline=Join-Path $root 'offline.next'
    $previousOffline=Join-Path $backup 'offline'
    $previousExe=Join-Path $backup 'NAH-LAB-SUITE.exe'
    $readyExe=Join-Path $root 'NAH-LAB-SUITE.next.exe'
    if (Test-Path $readyOffline) { Remove-Item $readyOffline -Force -Recurse }
    Copy-Item -LiteralPath $newOffline -Destination $readyOffline -Recurse -Force
    Copy-Item -LiteralPath $newExe -Destination $readyExe -Force
    if ((Get-FileHash -LiteralPath $readyExe -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $newExe -Algorithm SHA256).Hash) { Fail 'EXE staging không vượt qua kiểm tra SHA-256.' }
    $oldExeMoved=$false; $oldOfflineMoved=$false
    try {
        Move-Item -LiteralPath $oldOffline -Destination $previousOffline; $oldOfflineMoved=$true
        Move-Item -LiteralPath $oldExe -Destination $previousExe; $oldExeMoved=$true
        Move-Item -LiteralPath $readyOffline -Destination $oldOffline
        Move-Item -LiteralPath $readyExe -Destination $oldExe
        GetSignedExe $oldExe $pinnedSigner
    } catch {
        # Full rollback, do not touch user-data / WebView2 local storage.
        if ($oldExeMoved -and (Test-Path $oldExe)) { Remove-Item -LiteralPath $oldExe -Force }
        if ($oldOfflineMoved -and (Test-Path $oldOffline)) { Remove-Item -LiteralPath $oldOffline -Recurse -Force }
        if ($oldExeMoved) { Move-Item -LiteralPath $previousExe -Destination $oldExe }
        if ($oldOfflineMoved) { Move-Item -LiteralPath $previousOffline -Destination $oldOffline }
        throw
    }
    # Script was Authenticode verified above; do not replace the trusted .cmd
    # bootstrap or install scripts from an untrusted ZIP member.
    Copy-Item -LiteralPath $newUpdateScript -Destination (Join-Path $root 'NAH-UPDATE.ps1') -Force
    Log ('SUCCESS Windows '+$e.version)
    Write-Host 'Cập nhật hoàn tất. Hãy khởi động lại NAH LAB SUITE từ biểu tượng hiện có.'
} catch {
    Write-Host ('Không cập nhật: '+$_.Exception.Message)
    Log ('Exception '+$_.Exception.Message)
    exit 1
}
