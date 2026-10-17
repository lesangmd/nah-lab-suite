$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceExe = Join-Path $source 'NAH-LAB-SUITE.exe'
$sourceOffline = Join-Path $source 'offline'
if (!(Test-Path -LiteralPath $sourceExe) -or !(Test-Path -LiteralPath (Join-Path $sourceOffline 'index.html'))) {
    throw 'Gói cài đặt không đủ NAH-LAB-SUITE.exe và thư mục offline.'
}
if (Get-Process -Name 'NAH-LAB-SUITE' -ErrorAction SilentlyContinue) {
    throw 'Hãy đóng NAH LAB SUITE trước khi cập nhật, rồi chạy lại tệp này.'
}

# A stable installation target is critical for grouping an existing pinned taskbar shortcut.
$target = Join-Path $env:LOCALAPPDATA 'Programs\NAH LAB SUITE'
$targetExe = Join-Path $target 'NAH-LAB-SUITE.exe'
$targetOffline = Join-Path $target 'offline'
New-Item -ItemType Directory -Path $targetOffline -Force | Out-Null
$robocopy = Start-Process -FilePath 'robocopy.exe' -ArgumentList @("`"$sourceOffline`"", "`"$targetOffline`"", '/E', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS') -NoNewWindow -Wait -PassThru
if ($robocopy.ExitCode -ge 8) { throw "Không sao chép được dữ liệu offline (robocopy $($robocopy.ExitCode))." }
$legacyFactory = Join-Path $targetOffline 'desktop-factory.js'
if (Test-Path -LiteralPath $legacyFactory) { Remove-Item -LiteralPath $legacyFactory -Force }
Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force
# Critical stage verification: copying the executable must never be silently treated as success.
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceExe).Hash
$installedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $targetExe).Hash
if ($installedHash -ne $sourceHash) {
    throw 'Không xác minh được tính toàn vẹn của NAH-LAB-SUITE.exe sau khi sao chép.'
}
Write-Host 'Đã cập nhật và xác minh NAH-LAB-SUITE.exe.'
# Install the Native updater in the SAME stable installation directory.
foreach ($name in @('NAH-UPDATE.cmd','NAH-UPDATE.ps1')) {
  $candidate = Join-Path $source $name
  if (Test-Path -LiteralPath $candidate) { Copy-Item -LiteralPath $candidate -Destination (Join-Path $target $name) -Force }
}


# Native EXE uses Windows' implicit executable-path grouping. Remove historical
# explicit AppUserModelID from shortcuts that target this EXE, never PWA links.
$appId = '(tu nhan dien theo duong dan EXE)'
$taskbarIdentitySource = @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct NahPropertyKey {
    public Guid fmtid;
    public uint pid;
}
[StructLayout(LayoutKind.Explicit, Size=24)]
public struct NahPropVariant {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pszVal;
}
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
public interface INahPropertyStore {
    [PreserveSig] int GetCount(out uint cProps);
    [PreserveSig] int GetAt(uint iProp, out NahPropertyKey pkey);
    [PreserveSig] int GetValue(ref NahPropertyKey key, out NahPropVariant pv);
    [PreserveSig] int SetValue(ref NahPropertyKey key, ref NahPropVariant pv);
    [PreserveSig] int Commit();
}
[ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
public interface INahPersistFile {
    void GetClassID(out Guid pClassID);
    [PreserveSig] int IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [MarshalAs(UnmanagedType.Bool)] bool fRemember);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
    void GetCurFile(out IntPtr ppszFileName);
}
public static class NahTaskbarIdentity {
    private static readonly Guid ShellLinkClsid = new Guid("00021401-0000-0000-C000-000000000046");
    private static readonly Guid AppIdFmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
    [DllImport("ole32.dll")] private static extern int PropVariantClear(ref NahPropVariant pv);
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
    private static extern void SHChangeNotify(uint eventId, uint flags,
      [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr other);
    public static void RefreshShellShortcut(string path) {
        // SHCNE_UPDATEITEM + SHCNF_PATHW: notify Explorer about an updated .lnk.
        SHChangeNotify(0x00002000, 0x00000005, path, IntPtr.Zero);
    }

    // Uses the ShellLink property store, not a desktop shortcut display name.
    public static string ReadShortcutAppId(string path) {
        object link = Activator.CreateInstance(Type.GetTypeFromCLSID(ShellLinkClsid));
        try {
            ((INahPersistFile)link).Load(path, 0);
            INahPropertyStore store = (INahPropertyStore)link;
            NahPropertyKey key = new NahPropertyKey { fmtid = AppIdFmtid, pid = 5 };
            NahPropVariant actual;
            Marshal.ThrowExceptionForHR(store.GetValue(ref key, out actual));
            try {
                if (actual.vt == 31 && actual.pszVal != IntPtr.Zero)
                    return Marshal.PtrToStringUni(actual.pszVal);
                if (actual.vt == 8 && actual.pszVal != IntPtr.Zero)
                    return Marshal.PtrToStringBSTR(actual.pszVal);
                return "(không có định danh)";
            } finally { PropVariantClear(ref actual); }
        } finally { if (link != null && Marshal.IsComObject(link)) Marshal.FinalReleaseComObject(link); }
    }
    public static void ClearShortcutAppId(string path) {
        if (IntPtr.Size != 8 || Marshal.SizeOf(typeof(NahPropVariant)) != 24)
            throw new InvalidOperationException("Cấu trúc dữ liệu shortcut không phù hợp Windows x64.");
        object link = Activator.CreateInstance(Type.GetTypeFromCLSID(ShellLinkClsid));
        try {
            INahPersistFile file = (INahPersistFile)link;
            file.Load(path, 2);
            INahPropertyStore store = (INahPropertyStore)link;
            NahPropertyKey key = new NahPropertyKey { fmtid = AppIdFmtid, pid = 5 };
            // VT_EMPTY removes the explicit AppID and restores automatic shell grouping.
            NahPropVariant empty = new NahPropVariant { vt = 0 };
            Marshal.ThrowExceptionForHR(store.SetValue(ref key, ref empty));
            Marshal.ThrowExceptionForHR(store.Commit());
            file.Save(path, true);
        } finally { if (link != null && Marshal.IsComObject(link)) Marshal.FinalReleaseComObject(link); }
        string remaining = ReadShortcutAppId(path);
        if (!String.Equals(remaining, "(không có định danh)", StringComparison.Ordinal))
            throw new InvalidOperationException("Vẫn còn định danh cũ trong shortcut: " + remaining + " [" + path + "]");
    }

}
'@
# Shortcut metadata is optional: Explorer may refuse to persist/read properties of .lnk
# files created by another shell provider. It must not invalidate a verified EXE install.
$diagnosticsFile = Join-Path $target 'install-taskbar-diagnostics.txt'
$shortcutWarnings = New-Object 'System.Collections.Generic.List[string]'
$pwaPins = New-Object 'System.Collections.Generic.List[string]'
function Report-ShortcutWarning([string]$message) {
    Write-Warning $message
    [void]$shortcutWarnings.Add($message)
}
$helperReady = $false
try {
    Add-Type -TypeDefinition $taskbarIdentitySource -Language CSharp -ErrorAction Stop
    $helperReady = $true
} catch {
    Report-ShortcutWarning ("Không tải được tiện ích nhận diện shortcut: " + $_.Exception.Message)
}

$shell = $null
try { $shell = New-Object -ComObject WScript.Shell -ErrorAction Stop }
catch { Report-ShortcutWarning ("Không tạo được WScript.Shell: " + $_.Exception.Message) }

$startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shortcutPath = Join-Path $startMenu 'NAH LAB SUITE.lnk'
if ($null -ne $shell) {
    try {
        New-Item -ItemType Directory -Path $startMenu -Force -ErrorAction Stop | Out-Null
        # Recreate the Start Menu link rather than retaining old explicit AppID metadata.
        if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction Stop }
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $targetExe
        $shortcut.WorkingDirectory = $target
        $shortcut.IconLocation = "$targetExe,0"
        $shortcut.Description = 'Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2 - Quản lý chất lượng xét nghiệm'
        $shortcut.Save()
        if ($helperReady) {
            try {
                [NahTaskbarIdentity]::ClearShortcutAppId($shortcutPath)
                [NahTaskbarIdentity]::RefreshShellShortcut($shortcutPath)
                Write-Host 'Shortcut Start Menu: không còn định danh tùy chỉnh; Windows nhận diện theo EXE.'
            } catch {
                Report-ShortcutWarning ("Không xóa được định danh cũ của shortcut Start Menu: " + $_.Exception.Message)
            }
        }
    } catch {
        Report-ShortcutWarning ("Không cập nhật được shortcut Start Menu: " + $_.Exception.Message)
    }
}

# Repair only shortcuts whose TARGET is the native executable; do not overwrite PWA pins.
$pinnedDir = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$pinsChanged = 0
if ($null -ne $shell -and (Test-Path -LiteralPath $pinnedDir)) {
    foreach ($item in @(Get-ChildItem -LiteralPath $pinnedDir -Filter '*.lnk' -File -ErrorAction SilentlyContinue)) {
        try {
            $pin = $shell.CreateShortcut($item.FullName)
            $oldTarget = [string]$pin.TargetPath
            if ([IO.Path]::GetFileName($oldTarget) -ine 'NAH-LAB-SUITE.exe') {
                # Browser-installed app shortcuts have a separate Windows identity.
                # They cannot be merged reliably into a native pin by rewriting only the target.
                $argsText = [string]$pin.Arguments
                if ($item.BaseName -match '(?i)NAH.?LAB|NAH.?ISO' -and
                    ($oldTarget -match '(?i)msedge|chrome|webapp' -or
                     $argsText -match '(?i)--app-id|sachyhoc.com/nah-lab-iso')) {
                    [void]$pwaPins.Add($item.FullName)
                }
                continue
            }
            $pin.TargetPath = $targetExe
            $pin.WorkingDirectory = $target
            $pin.IconLocation = "$targetExe,0"
            $pin.Description = 'Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2 - Quản lý chất lượng xét nghiệm'
            $pin.Save()
            if ($helperReady) {
                try {
                    [NahTaskbarIdentity]::ClearShortcutAppId($item.FullName)
                    [NahTaskbarIdentity]::RefreshShellShortcut($item.FullName)
                } catch {
                    Report-ShortcutWarning ("Không xóa được định danh cũ của shortcut Taskbar '$($item.Name)': " + $_.Exception.Message)
                }
            }
            $pinsChanged++
        } catch {
            Report-ShortcutWarning ("Không cập nhật được shortcut Taskbar '$($item.Name)': " + $_.Exception.Message)
        }
    }
}
Write-Host "Đã xử lý $pinsChanged biểu tượng Windows Native đang ghim; không thay đổi ứng dụng web đã ghim."
if ($pwaPins.Count -gt 0) {
    Report-ShortcutWarning ("Phát hiện $($pwaPins.Count) biểu tượng ứng dụng web cũ có thể bị Windows tách khỏi bản Windows Native: " + ($pwaPins -join '; '))
}
# Always save the Taskbar inventory, because a pinned browser/PWA shortcut cannot be
# fixed by renaming or by assigning properties to the native EXE.
try {
    $report = New-Object 'System.Collections.Generic.List[string]'
    [void]$report.Add("Kiểm tra biểu tượng và lối tắt - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    [void]$report.Add("Ứng dụng Windows: $targetExe")
    [void]$report.Add("Chế độ định danh: $appId")
    [void]$report.Add("Mã SHA-256 ứng dụng: $installedHash")
    $allLinks = @($shortcutPath)
    if (Test-Path -LiteralPath $pinnedDir) {
        $allLinks += @(Get-ChildItem -LiteralPath $pinnedDir -Filter '*.lnk' -File -ErrorAction SilentlyContinue | ForEach-Object FullName)
    }
    foreach ($linkPath in $allLinks) {
        if (!(Test-Path -LiteralPath $linkPath) -or $null -eq $shell) { continue }
        try {
            $lnk=$shell.CreateShortcut($linkPath)
            $targetText=[string]$lnk.TargetPath
            $argsText=[string]$lnk.Arguments
            if (([IO.Path]::GetFileName($targetText) -ine 'NAH-LAB-SUITE.exe') -and
                ($linkPath -ne $shortcutPath) -and
                ($linkPath -notmatch '(?i)NAH|ISO|LAB') -and
                ($argsText -notmatch '(?i)nah-lab-iso|--app-id')) { continue }
            $linkAppId='(chưa đọc được)'
            if ($helperReady) { try { $linkAppId=[NahTaskbarIdentity]::ReadShortcutAppId($linkPath) } catch { $linkAppId='(lỗi đọc: '+$_.Exception.Message+')' } }
            [void]$report.Add("Lối tắt: $linkPath")
            [void]$report.Add("  Đích: $targetText")
            [void]$report.Add("  Tham số: $argsText")
            [void]$report.Add("  Định danh: $linkAppId")
            if ($targetText -match '(?i)msedge|chrome' -or $argsText -match '(?i)--app-id|nah-lab-iso') {
                [void]$report.Add('  Nhận xét: ứng dụng web được ghim dùng định danh khác ứng dụng Windows; cần bỏ ghim thủ công nếu muốn gộp.')
            } elseif ([IO.Path]::GetFileName($targetText) -ieq 'NAH-LAB-SUITE.exe' -and $linkAppId -ne '(không có định danh)') {
                [void]$report.Add('  Nhận xét: shortcut Native vẫn còn định danh tùy chỉnh; có thể tiếp tục tách nhóm Taskbar.')
            }
        } catch { [void]$report.Add('Không đọc được lối tắt: '+$linkPath+' '+$_.Exception.Message) }
    }
    if ($shortcutWarnings.Count -gt 0) {
        [void]$report.Add('CẢNH BÁO CẤU HÌNH:')
        foreach($warning in $shortcutWarnings) { [void]$report.Add($warning) }
    }
    [IO.File]::WriteAllLines($diagnosticsFile, [string[]]$report.ToArray(), [Text.Encoding]::UTF8)
} catch {
    Write-Warning ('Không lưu được báo cáo định danh Taskbar: '+$_.Exception.Message)
}
if ($shortcutWarnings.Count -eq 0) {
    Write-Host "ĐÃ CẬP NHẬT CHƯƠNG TRÌNH VÀ KIỂM TRA SHORTCUT: $targetExe"
} else {
    Write-Warning "EXE đã cập nhật nhưng chưa xác minh xong biểu tượng Taskbar: $($shortcutWarnings.Count) cảnh báo."
    Write-Host "Nhật ký: $diagnosticsFile"
    Write-Host 'Nếu Taskbar còn hai biểu tượng, gửi tệp taskbar-check.txt; không xóa dữ liệu ứng dụng.'
}
try {
    Start-Process -FilePath $targetExe -WorkingDirectory $target -ErrorAction Stop
} catch {
    Write-Warning ("EXE đã cài thành công nhưng không tự khởi động được: " + $_.Exception.Message)
    Write-Host "Hãy mở ứng dụng thủ công: $targetExe"
}
