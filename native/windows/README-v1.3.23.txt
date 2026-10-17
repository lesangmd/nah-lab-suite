NAH LabSuite Windows Native v1.3.23 · Web v1.58.50

- Biểu mẫu điện tử: lưu khi không có Internet, AES-256-GCM trong hồ sơ Windows người dùng.
- Dữ liệu được đồng bộ tự động khi mạng và API máy chủ hoạt động, đối chiếu revision.
- Trạng thái CHƯA ĐỒNG BỘ có nghĩa là máy chủ chưa nhận; không coi là phê duyệt.
- Khi có bản nháp chưa đồng bộ, ứng dụng không cho xóa phiên đăng nhập; đăng nhập lại cùng tài khoản nếu hết hạn.
- Trao đổi nhóm chỉ làm việc trực tuyến với cùng máy chủ WordPress; LAN cần truy cập được sachyhoc.com hoặc cấu hình VPN/reverse proxy thích hợp.
- Không xóa thư mục %LOCALAPPDATA%\NAH LAB SUITE\WebView2Data trước khi đồng bộ hết báo cáo.
- Cài đặt bằng INSTALL-OR-UPDATE.cmd trên Windows, không thay đổi Taskbar AppUserModelID.
- Đây là bản ứng viên kiểm thử: phải nghiệm thu cài đè, mất mạng khi lưu, phục hồi và xung đột 409 trên thiết bị thật.
