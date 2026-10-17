$ErrorActionPreference='Continue'
$target=Join-Path $env:LOCALAPPDATA 'Programs\NAH LAB SUITE'
$exe=Join-Path $target 'NAH-LAB-SUITE.exe'
$installer=Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'INSTALL-OR-UPDATE.ps1'
$appId='(không có định danh)'
$helperReady=$false
try {
  $raw=[IO.File]::ReadAllText($installer)
  $match=[regex]::Match($raw, '(?s)\$taskbarIdentitySource\s*=\s*@''\r?\n(.*?)\r?\n''@')
  if ($match.Success) { Add-Type -TypeDefinition $match.Groups[1].Value -Language CSharp -ErrorAction Stop; $helperReady=$true }
} catch { Write-Warning ('Chưa đọc được định danh từ lối tắt: '+$_.Exception.Message) }
$startMenu=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\NAH LAB SUITE.lnk'
$pinned=Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$paths=@($startMenu)
if (Test-Path -LiteralPath $pinned) { $paths+=@(Get-ChildItem -LiteralPath $pinned -Filter '*.lnk' -File -ErrorAction SilentlyContinue | ForEach-Object FullName) }
$lines=New-Object 'System.Collections.Generic.List[string]'
[void]$lines.Add('Kiểm tra biểu tượng - '+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
[void]$lines.Add('Định danh mong đợi trên shortcut Native: '+$appId)
[void]$lines.Add('Tệp chương trình: '+$exe)
# Compare the actual running program with the canonical installed EXE.
try {
 $processes = @(Get-CimInstance Win32_Process -Filter "Name='NAH-LAB-SUITE.exe'" -ErrorAction Stop)
 [void]$lines.Add('Số tiến trình Windows Native đang chạy: '+$processes.Count)
 foreach($proc in $processes) {
  [void]$lines.Add('  PID='+$proc.ProcessId+' | EXE='+$proc.ExecutablePath+' | CommandLine='+$proc.CommandLine)
  if($proc.ExecutablePath -and [IO.Path]::GetFullPath($proc.ExecutablePath) -ine [IO.Path]::GetFullPath($exe)) {
   [void]$lines.Add('  CẢNH BÁO: tiến trình không chạy từ thư mục cài đặt chuẩn.')
  }
 }
} catch {
 [void]$lines.Add('Không đọc được đường dẫn tiến trình: '+$_.Exception.Message)
}

# Live top-level window data helps distinguish a stale pin from a different EXE.
try {
    foreach ($p in @(Get-Process -Name 'NAH-LAB-SUITE' -ErrorAction SilentlyContinue)) {
        $hwndHex = ('0x{0:X}' -f [int64]$p.MainWindowHandle)
        [void]$lines.Add("Cửa sổ đang chạy: PID=$($p.Id) | HWND=$hwndHex | Tiêu đề=$($p.MainWindowTitle)")
    }
} catch { [void]$lines.Add('Không đọc được cửa sổ đang chạy: '+$_.Exception.Message) }

$shell=New-Object -ComObject WScript.Shell
foreach($path in $paths){
 if(!(Test-Path -LiteralPath $path)){continue}
 try {
   $lnk=$shell.CreateShortcut($path);$dest=[string]$lnk.TargetPath;$args=[string]$lnk.Arguments
   if($path -ne $startMenu -and $path -notmatch '(?i)NAH|ISO|LAB' -and $dest -notmatch '(?i)NAH-LAB-SUITE' -and $args -notmatch '(?i)nah-lab-iso|--app-id'){continue}
   $id='(chưa đọc được)';if($helperReady){ try {$id=[NahTaskbarIdentity]::ReadShortcutAppId($path)}catch {$id='(lỗi: '+$_.Exception.Message+')'} }
   $type=if([IO.Path]::GetFileName($dest) -ieq 'NAH-LAB-SUITE.exe'){'Windows Native'}elseif($dest -match '(?i)msedge|chrome' -or $args -match '(?i)--app-id'){'Ứng dụng web'}else{'Khác'}
   [void]$lines.Add("[$type] $path")
   [void]$lines.Add("  Đích: $dest")
   [void]$lines.Add("  Tham số: $args")
   [void]$lines.Add("  AppUserModelID: $id")
   if($type -eq 'Ứng dụng web') {[void]$lines.Add('  Hướng xử lý: bỏ ghim biểu tượng ứng dụng web cũ; mở Windows Native từ Bắt đầu rồi ghim lại.')}
   if($type -eq 'Windows Native' -and $id -ne $appId){[void]$lines.Add('  CẢNH BÁO: shortcut Native còn AppID tùy chỉnh; hãy gửi báo cáo này để kiểm tra.')}
 }catch{[void]$lines.Add('Không đọc được '+$path+' : '+$_.Exception.Message)}
}
$out=Join-Path $target 'taskbar-check.txt'
New-Item -ItemType Directory -Path $target -Force | Out-Null
[IO.File]::WriteAllLines($out,[string[]]$lines.ToArray(),[Text.Encoding]::UTF8)
$lines|ForEach-Object{Write-Host $_}
Write-Host ('Đã lưu: '+$out)
