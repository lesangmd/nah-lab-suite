NAH LabSuite Windows Native v1.3.21 — Sửa nhận diện phiên bản và bảo vệ bản cài đặt ổn định

Cơ sở: mã nguồn Windows Native v1.3.20 đã được đối chiếu bản biên dịch SHA256 và bộ tài nguyên giao diện WebApp v1.58.44.
- Sửa phiên bản thực trong User-Agent: NAHISONative/1.3.21 NAHLABDesktop/1.3.21.
- Sửa FileVersion, ProductVersion, manifest assemblyIdentity thành 1.3.21.
- Đăng nhập: Windows v1.3.21 và Web v1.58.44 ở tài nguyên ngoại tuyến; ở trực tuyến, nhãn lấy phiên bản Web từ trang đang tải và phiên bản Windows từ User-Agent Native.
- Giữ nguyên cấu trúc Win32/WebView2, nhóm Taskbar theo đường dẫn EXE, bộ cài, thư mục dữ liệu người dùng và toàn bộ logic mạng.
- Giữ danh mục Biểu mẫu & Hồ sơ, đồng bộ, danh mục tham khảo và hộp thoại cập nhật từ Web v1.58.44.
- KHÔNG kích hoạt cập nhật bắt buộc từ máy chủ trước khi nghiệm thu trên Windows thực tế.
- Cập nhật: đóng chương trình rồi chạy INSTALL-OR-UPDATE.cmd trong thư mục giải nén.
- Không xóa WebView2 user-data, không cài PWA đè Native.
