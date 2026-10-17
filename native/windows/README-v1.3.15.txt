NAH LAB SUITE Windows Native v1.3.15 / Web v1.58.29

Corrections:
- Windows Taskbar icon is composed over an opaque WHITE tile in multi-resolution ICO. WebApp/Android logo PNG files and UI artwork remain untouched.
- Normal API JSON requests, including dashboard, records, roadmap, dataset manifest and mirror, now use the existing WordPress desktop/transport endpoint (CORS-simple text/plain POST). Authorization, capabilities and CSRF are still enforced server-side.
- Never display "offline cache missing" for a live HTTP error; preserve original HTTP status and message. On genuine network failure use authenticated mirror if present, otherwise clear connectivity error.
- Multipart uploads remain direct with native token/CSRF in FormData as supported by backend, retaining $_FILES.
- UI still opens directly after sign-in; silent full mirror hydration continues in the small strip.
- Taskbar process/window/shortcut AppID logic unchanged from v1.3.14.
- No backend, Android, or actual WebApp source modifications.

Requires server backend with desktop/transport (present in WebApp v1.58.29). Build/testing and QA in package. Test with actual WordPress account + Windows Explorer/WebView2 before broad production rollout.
