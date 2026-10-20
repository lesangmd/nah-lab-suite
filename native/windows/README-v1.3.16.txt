NAH LAB SUITE Windows Native v1.3.16 / WebApp v1.58.29

Cập nhật: Đóng NAH LAB SUITE, giải nén gói ZIP, chạy INSTALL-OR-UPDATE.cmd.
Không gỡ bản cũ hoặc xóa hồ sơ WebView2/IndexedDB.

KHẮC PHỤC:
- Không còn xóa DOM của phân hệ khi timer trạng thái tải hoạt động trễ.
- Lịch sử thao tác bảo vệ các yêu cầu bất đồng bộ trước chuyển phân hệ, lọc liên tiếp và thao tác xem thêm.
- Mặc định tải 200 sự kiện gần nhất; có thể bấm “Xem thêm sự kiện” để lấy tới 1000 sự kiện (giới hạn API hiện hành).
- Mở nhanh Lịch sử thao tác, Thư viện ISO và Tiến độ tài liệu ISO từ snapshot được xác thực theo tài khoản; tải dữ liệu mới nhất từ máy chủ ngay sau đó.
- Sửa khóa cache của lịch sử: full mirror lưu activity?limit=1000, Desktop phải lọc từ khóa này.
- Tiến độ tài liệu ISO không còn bỏ qua bước làm mới máy chủ chỉ vì đã có bộ nhớ cache từ lần mở trước.
- Hạn chế dữ liệu trả về muộn ghi đè vào phân hệ mới khi người dùng chuyển menu.

KHÔNG THAY ĐỔI:
- Server WebApp v1.58.29, logo WebApp, icon Windows nền đặc, AppUserModelID, trình cài đặt Installer Hotfix 1.
- REST API/CSRF/phân quyền WordPress, cơ chế snapshot đầy đủ theo tài khoản, đăng nhập vào thẳng giao diện và đồng bộ nền.

KIỂM THỬ THỰC TẾ CẦN THỰC HIỆN:
1. Đăng nhập, mở Lịch sử thao tác và chuyển ngay sang Thư viện ISO; không xuất hiện lỗi null.innerHTML.
2. Chuyển nhanh giữa ba phân hệ nhiều lần, thử lọc nhật ký liên tiếp.
3. Mở Lịch sử thao tác ban đầu (200 sự kiện); Xem thêm (tối đa 1000); xuất PDF/DOCX trên bộ lọc đã chọn.
4. Đối chiếu dữ liệu màn hình sau khi làm mới với WebApp online, đặc biệt nội dung mới thêm.
5. Chờ full mirror hoàn tất, đóng/mở lại ứng dụng, thử chế độ mất mạng rồi kết nối lại.
6. Kiểm tra icon/taskbar và chạy INSTALL-OR-UPDATE.cmd trên Windows 10/11 thực tế.

Đã kiểm tra bằng mô phỏng JavaScript và biên dịch PE32+ x64; chưa đo độ trễ thực tế trên máy chủ WordPress hoặc kiểm thử WebView2/Explorer Windows trên thiết bị thật.
Ứng dụng chưa được ký Authenticode.
