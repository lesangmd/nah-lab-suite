NAH LAB SUITE Windows v1.3.15 — Installer Hotfix 1 (14/10/2026)

Đây là hotfix của INSTALL-OR-UPDATE, KHÔNG phải thay đổi EXE/WebApp.
Ứng dụng: Windows v1.3.15 / WebApp v1.58.29 (giữ nguyên).

Sửa lỗi:
- AppUserModelID readback sai không được chặn toàn bộ cài đặt.
- Lỗi PowerShell/Add-Type/shortcut optional được ghi cảnh báo, không làm hỏng cài đặt EXE thành công.
- Kiểm tra SHA-256 EXE sau khi sao chép; vẫn dừng khi sao chép không thành công.
- Chỉ sửa shortcut ghim nếu TargetPath có tên NAH-LAB-SUITE.exe; không tự chiếm shortcut PWA cùng tên.
- Không xóa IndexedDB/WebView2 user-data/profile.

Cách dùng:
1. Đóng hoàn toàn NAH LAB SUITE.
2. Giải nén toàn bộ ZIP vào một thư mục mới.
3. Chạy INSTALL-OR-UPDATE.cmd.
4. Nếu có cảnh báo AppUserModelID, vẫn có thể mở bản mới; xem nhật ký tại:
   %LOCALAPPDATA%\Programs\NAH LAB SUITE\install-taskbar-diagnostics.txt
5. Nếu Taskbar vẫn có hai biểu tượng, bỏ ghim shortcut Native cũ,
   mở ứng dụng từ Start Menu rồi chọn Pin to taskbar.

Phạm vi QA: phân tích mã nguồn + kiểm tra tĩnh + checksum tệp. Chưa chạy trình cài trên Windows.
