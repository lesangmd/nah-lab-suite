# Windows Native v1.3.28 — Web v1.58.58 (NỘI BỘ / CHỜ NGHIỆM THU)

Ngày chuẩn bị: 20/10/2026. Nhánh: release/windows-v1.3.28-web-v1.58.58-rc.

## Phạm vi đã chuẩn bị
- Đối chiếu chính xác SHA-256 của app.js, app.css và service-worker.js với ZIP Web v1.58.58.
- Giữ nguyên cấu trúc WebView2, đường dẫn dữ liệu người dùng; không xóa cache/IndexedDB.
- Đồng bộ phiên bản giao diện, EXE, file resources, user-agent và trình đồng bộ Desktop thành 1.3.28 / 1.58.58.
- Cấu hình đường dẫn tải CSV/XLSX từ admin-post.php của máy chủ; yêu cầu máy chủ đã cập nhật plugin Web v1.58.58.
- Giữ lại chữ ký chỉ phục vụ nội bộ và trạng thái HOLD: releaseReady=false, publiclyTrusted=false; không bật auto-update.
- Không sửa APK Android, khóa ký Android hoặc ứng dụng Android v1.1.15.

## Lệnh kiểm tra cục bộ trên checkout đầy đủ (Windows)
python -X utf8 tools/verify-source-release.py
python -X utf8 tools/verify-native-parity.py
python -X utf8 tools/prepare-windows-v1.3.28.py
node --check native/windows/offline/assets/app.js
cd native\windows
BUILD-X64.cmd

Lưu ý: Hai lệnh verify baseline cần chạy TRƯỚC prepare; Android và Windows hiện cùng mốc Web v1.58.56 ở source ban đầu. Sau prepare, dùng gate Windows v1.3.28 riêng, không tuyên bố đã cập nhật Android.

## Ký số bằng GitHub Actions
1. Chỉ thực hiện sau khi xem xét mã nhánh và xác nhận bộ cài thử nghiệm.
2. Actions → Windows internal signing (workflow file release-windows-1.3.27-manual.yml).
3. Nhấn Run workflow, chọn **release/windows-v1.3.28-web-v1.58.58-rc**, KHÔNG chọn nhánh release Android cũ hoặc main.
4. Kiểm tra tên job phiên bản 1.3.28, bước kiểm tra SHA-256 và bước ký EXE/NAH-UPDATE.ps1 đều PASS.
5. Tải Artifact **windows-v1.3.28-INTERNAL-ONLY-NO-AUTO-UPDATE**. Không đăng GitHub Release hoặc manifest cập nhật production.

## Kiểm thử bắt buộc trước khi nghiệm thu
- Trên máy Windows thử nghiệm: sao lưu WebView2 User Data và kiểm kê dữ liệu chưa đồng bộ, rồi thử cài đè từ 1.3.27.
- Kiểm tra Properties → Details: File version 1.3.28; chữ ký EXE và NAH-UPDATE.ps1 cùng chứng chỉ nội bộ đã ghim.
- Đăng nhập cùng tài khoản trên Web v1.58.58 và Windows v1.3.28; cập nhật một công việc 35%→65%, đổi giai đoạn; lưu, tải lại trang và kiểm tra từ một phiên khác.
- Thử tải mẫu Danh mục trang thiết bị/vật tư, mẫu nhập chuẩn hóa Excel và CSV; kiểm tra nội dung tệp không trống và không báo “không áp dụng cho Desktop”.
- Rút mạng sau lần đồng bộ hoàn chỉnh: tra cứu hồ sơ, biểu mẫu, sổ tay ngoại tuyến. Thao tác ghi khi offline phải thông báo rõ chưa gửi máy chủ.
- Kết nối lại: kiểm tra chỉ dữ liệu có quyền mới được đồng bộ, không hồi quy tiến độ.
- Kiểm tra installer không đổi đường dẫn cài đặt/Taskbar và không xóa dữ liệu người dùng.
- So sánh lại ở Android: Android v1.1.15 còn sử dụng Web 1.58.56, tiếp tục HOLD cho tới khi triển khai nhánh Android tương ứng có chữ ký ổn định.

Chỉ công nhận phát hành chính thức sau khi kết quả nghiệm thu trên máy thật được ghi nhận và cơ chế tin cậy/chữ ký phân phối được phê duyệt.
