# NAH LabSuite Native Auto Update — release gate

## Phiên bản thử nghiệm
- WebApp v1.58.55 (phát hành manifest có điều kiện).
- Windows Native v1.3.26 (EXE Win32 x64 biên dịch, **chưa ký Authenticode**).
- Android v1.1.15 (mã nguồn, **chưa biên dịch/ký APK**).

## Phát hành Windows
1. Chọn 1 chứng chỉ **Authenticode code-signing** do đơn vị sở hữu, xuất *thumbprint công khai* và lưu ở `$pinnedSigner` trong `NAH-UPDATE.ps1`; không bao giờ lấy thumbprint đáng tin từ manifest một mình.
2. Ký **tất cả bản EXE mới và tệp NAH-UPDATE.ps1 bằng cùng chứng chỉ Authenticode**, dùng signtool với `sha256` và RFC3161 timestamp; xác minh `Get-AuthenticodeSignature`, thumbprint và số phiên bản trong EXE.
3. Phát hành ZIP với `NAH-LAB-SUITE.exe`, `offline/`, `NAH-UPDATE.ps1`, `NAH-UPDATE.cmd` và `INSTALL-OR-UPDATE.*` tại `updates/` trên WordPress. Kiểm SHA-256 ZIP sau tải.
4. Sau khi nghiệm thu, thay *chỉ* manifest desktop tương ứng: `file`, `version`, `sha256`, `authenticodeSignerThumbprint`, `releaseReady=true`, `mandatory=false`; server chỉ công bố gói nếu file có thật và điều kiện đạt. **Không bật trước.**
5. Windows v1.3.25 và cũ hơn cần **cài nâng cấp một lần bằng installer** để nhận native bridge + updater; các bản từ 1.3.26 mới có nút “Cập nhật tại chỗ”.
6. QA trên Windows 10/11, thiếu mạng, mất mạng khi tải, ZIP lỗi, chữ ký lạ, app còn mở, rollback, Taskbar và dữ liệu biểu mẫu đang chờ đồng bộ.

## Phát hành Android
1. Dùng **keystore PKCS12/alias hiện hành** của v1.1.12; không tạo khóa mới.
2. Biên dịch APK với `versionCode` **11015**, `packageName` **vn.nah.iso15189suite**. Xác minh bằng `apksigner verify --print-certs`; signer SHA-256 phải là `d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c`.
3. Thử cài đè APK lên bản v1.1.12/1.1.13 thực tế, giữ nguyên dữ liệu, thử offline và cập nhật trên thiết bị Android API 31 trở lên.
4. Tải APK đã duyệt lên `updates/` và cập nhật manifest Android: `version=1.1.15`, `versionCode=11015`, `file`, `sha256`, `signerCertificateSha256`, `releaseReady=true`; bật `mandatory` chỉ sau nghiệm thu cài nâng cấp. Không đặt `requiresReinstall=true` nếu chữ ký giống nhau.

## Phạm vi và giới hạn
- Cập nhật Windows là thao tác sau khi người dùng **tự bấm** và đóng ứng dụng; không tự ghi đè khi app đang chạy. Chỉ thay thư mục chương trình; *không xóa WebView2 User Data/IndexedDB*.
- Bộ cập nhật Windows yêu cầu chữ ký Authenticode *cố định giữa các bản Windows*, còn Android yêu cầu chứng chỉ ký APK cố định *giữa các bản Android*. Đây là hai cơ chế chữ ký khác nhau, không dùng cùng một file khóa giữa Windows và Android.
- Nếu không có chứng chỉ Windows đáng tin, trình cập nhật từ chối chạy; SHA-256 một mình **không đủ để xác minh nhà phát hành**.
- Chưa triển khai WordPress production hoặc thử cập nhật trên thiết bị thực.


**MIGRATION HOLD:** New Android signing identity; old installed apps cannot be updated in place. Export or sync offline forms before any consented reinstallation; do not auto-prompt uninstall.
