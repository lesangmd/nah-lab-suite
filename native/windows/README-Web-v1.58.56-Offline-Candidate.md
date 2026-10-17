# NAH LabSuite Windows v1.3.27 – Web 1.58.56

GÓI KIỂM THỬ / EXE CHƯA KÝ AUTHENTICODE.

- Chương trình Native được biên dịch lại thành version 1.3.27 từ nguồn 1.3.26, chỉ điều chỉnh nhận diện phiên bản; đã đồng bộ nội dung offline lên Web 1.58.56.

- Không thay đổi định danh cửa sổ/Taskbar, hành vi đăng nhập hay kho dữ liệu WebView2.

- Cài thử bằng `INSTALL-OR-UPDATE.cmd` sau khi đóng ứng dụng và sao lưu dữ liệu chờ đồng bộ. Không gỡ bản cũ trước.

- Cơ chế nâng cấp TỰ ĐỘNG không được phép công bố gói EXE chưa có chữ ký Authenticode hợp lệ.

- Trước phát hành: ký EXE và trình cập nhật bằng cùng chứng chỉ dài hạn, đo SHA-256, thử cài đè, rollback, kiểm tra hàng đợi biểu mẫu.

- Máy chủ cần chạy WebApp 1.58.56 trước khi đồng bộ các API mới.
