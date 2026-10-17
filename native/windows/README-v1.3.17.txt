BỆNH VIỆN HỮU NGHỊ ĐA KHOA NGHỆ AN - GIAI ĐOẠN 2
HỆ THỐNG QUẢN LÝ CHẤT LƯỢNG XÉT NGHIỆM
Windows Native v1.3.17 / ứng dụng web v1.58.29

SỬA LỖI TASKBAR
- Khai báo chính xác cấu trúc dữ liệu PROPVARIANT 24 byte cho Windows x64 khi ghi và kiểm tra AppUserModelID.
- Duy trì định danh NAH.LAB.SUITE ổn định trong cửa sổ, tiến trình và lối tắt.
- Sửa lối tắt Windows Native đang ghim trỏ đến EXE cũ. Không tự sửa/xóa lối tắt của ứng dụng web/PWA.
- Bổ sung KIEM-TRA-TASKBAR.cmd để xác định các biểu tượng ghim không tương thích.
- Nếu Explorer vẫn dùng biểu tượng web cũ, cần bỏ ghim lối tắt cũ một lần; mở bản Windows từ menu Bắt đầu rồi ghim lại.

VIỆT HÓA GIAO DIỆN
- Các nhãn tên hệ thống, mô tả, hướng dẫn cài đặt, thông báo và tên bệnh viện dùng tiếng Việt.
- Thay cụm “NAH” trong nội dung hiển thị bằng “Bệnh viện Hữu nghị Đa khoa Nghệ An - Giai đoạn 2” hoặc tên chức năng thích hợp.
- Giữ tên chuẩn ISO, QĐ 2429, Windows, Android, PDF, DOCX, Google Drive và tên kỹ thuật cần thiết.
- Không tự sửa thông tin người bệnh/hồ sơ, mã API, cấu trúc dữ liệu, tên tệp kỹ thuật hoặc nội dung trả về từ máy chủ.

CÀI ĐẶT
1. Thoát ứng dụng hiện tại.
2. Giải nén, chạy INSTALL-OR-UPDATE.cmd.
3. Mở từ lối tắt trong menu Bắt đầu; kiểm tra icon đã ghim.
4. Nếu biểu tượng vẫn tách nhóm, chạy KIEM-TRA-TASKBAR.cmd và xem taskbar-check.txt.
5. Đối chiếu các phân hệ và nhật ký cập nhật với bản web.

Dữ liệu WebView2, IndexedDB và cơ chế đồng bộ nền được giữ nguyên. Không xóa dữ liệu offline.
Chưa nghiệm thu trên Windows Explorer 10/11 thực tế; sửa định danh không đảm bảo gộp được lối tắt PWA khác ứng dụng Windows Native.
