BỆNH VIỆN HỮU NGHỊ ĐA KHOA NGHỆ AN - GIAI ĐOẠN 2
Windows Native v1.3.19 · WebApp v1.58.30

Mục tiêu sửa riêng lỗi Taskbar tự tạo biểu tượng thứ hai:
- Loại bỏ định danh cửa sổ và bộ thuộc tính RelaunchCommand/RelaunchIconResource thiếu RelaunchDisplayNameResource.
- Chỉ dùng định danh tiến trình NAH.LAB.SUITE và cùng định danh trong shortcut Start Menu/Taskbar.
- Giữ nguyên đường dẫn cài đặt, icon gốc, bộ cài, WebApp và dữ liệu offline đã đồng bộ.
- Không tự ý xóa hoặc bỏ ghim shortcut cũ; nếu Windows vẫn tách nhóm, chạy KIEM-TRA-TASKBAR.cmd và gửi taskbar-check.txt.
- Bản vá mã nguồn/biên dịch; chưa kiểm thử hành vi nhóm biểu tượng trên Explorer Windows 10/11 thực tế.

Hướng dẫn: đóng ứng dụng, giải nén gói, chạy INSTALL-OR-UPDATE.cmd. Khởi động từ Start Menu và thử mở từ Taskbar.
