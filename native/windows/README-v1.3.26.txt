NAH LAB SUITE Windows v1.3.26 / WebApp v1.58.55

- Tự kiểm tra bản phát hành đã duyệt khi khởi động và trong lúc sử dụng.
- Nút "Cập nhật tại chỗ" gọi NAH-UPDATE.cmd từ thư mục cài đặt cũ.
- Trình cập nhật kiểm SHA-256 ZIP, chữ ký Authenticode (với thumbprint ghim), và chờ đóng ứng dụng.
- Sao lưu EXE và offline trước khi thay; rollback nếu bản mới không xác minh thành công.
- Dữ liệu WebView2, hồ sơ chưa đồng bộ, tài khoản và đường dẫn Taskbar không bị xóa.
- Cần được ký Authenticode bằng đúng chứng chỉ cũ trước khi bật releaseReady; gói nguồn này chưa ký.
- Giữ v1.3.25 làm bản production tới khi được nghiệm thu.
