# NAH LabSuite Android v1.1.15 — Web 1.58.56

Đây là MÃ NGUỒN ỨNG VIÊN phát hành, chưa phải APK và không chứa khóa ký hoặc mật khẩu.

- Package: vn.nah.iso15189suite; versionCode 11015; versionName 1.1.15.

- Giao diện WebApp 1.58.56, 30 chuyên đề Sổ tay và danh mục 83 biểu mẫu.

- FactoryShell.java và offline/index.html cùng prefix native-shell-v1.58.56.

- Chạy `python3 tools/verify-source-release.py` trước khi build.

- Build/ký trên máy có JDK 17, Gradle 8.9, Android SDK 35; sử dụng khóa cũ của bản Android 1.1.12, không tạo khóa mới.

- Không phát hành nếu thiếu `apksigner verify`, chứng chỉ trùng baseline, thử `adb install -r`, và kiểm tra dữ liệu người dùng còn nguyên.

- Sau khi nghiệm thu mới đặt `releaseReady=true` và cập nhật SHA-256/URL bản ký trên WordPress.
