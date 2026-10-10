package vn.nah.iso15189suite;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class UpdateManager {
    static final int CURRENT_VERSION_CODE = 11005;
    static final String CURRENT_VERSION = "1.1.6";
    static final String MANIFEST_URL = "https://sachyhoc.com/wp-json/nah-iso15189/v1/app/update-manifest";
    static final int REQUEST_UNKNOWN_APPS = 1803;

    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private long downloadId = -1L;
    private Uri pendingInstallUri;
    private String expectedSha = "";
    private boolean receiverRegistered = false;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
            long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
            if (id != downloadId) return;
            DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            Uri uri = dm.getUriForDownloadedFile(id);
            if (uri == null) {
                Toast.makeText(activity, "Không thể mở gói cập nhật đã tải.", Toast.LENGTH_LONG).show();
                return;
            }
            verifyAndInstall(uri);
        }
    };

    UpdateManager(Activity activity) {
        this.activity = activity;
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) activity.registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED);
        else activity.registerReceiver(receiver, f);
        receiverRegistered = true;
    }

    void close() {
        if (receiverRegistered) {
            try { activity.unregisterReceiver(receiver); } catch (Throwable ignored) { }
            receiverRegistered = false;
        }
        executor.shutdownNow();
    }

    void check(boolean userInitiated) {
        executor.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(MANIFEST_URL).openConnection();
                c.setConnectTimeout(12_000);
                c.setReadTimeout(18_000);
                c.setRequestProperty("Accept", "application/json");
                c.setRequestProperty("User-Agent", "NAHISOAndroid/1.1.6");
                int code = c.getResponseCode();
                if (code != 200) throw new IllegalStateException("HTTP " + code);
                byte[] body;
                try (InputStream in = c.getInputStream()) { body = readAll(in, 2 * 1024 * 1024); }
                JSONObject root = new JSONObject(new String(body, java.nio.charset.StandardCharsets.UTF_8));
                JSONObject android = root.optJSONObject("platforms") == null ? null : root.optJSONObject("platforms").optJSONObject("android");
                if (android == null || !android.optBoolean("available", false)) {
                    if (userInitiated) toast("Chưa có gói cập nhật Android mới trên kênh ổn định.");
                    return;
                }
                int remoteCode = android.optInt("versionCode", 0);
                if (remoteCode <= CURRENT_VERSION_CODE) {
                    if (userInitiated) toast("Ứng dụng Android đang ở phiên bản mới nhất.");
                    return;
                }
                String version = android.optString("version", "");
                String url = android.optString("downloadUrl", "");
                String sha = android.optString("sha256", "").toLowerCase(Locale.ROOT);
                String notes = android.optString("releaseNotes", "");
                if (!isSafeUpdateUrl(url) || !sha.matches("^[a-f0-9]{64}$")) throw new IllegalStateException("Invalid update metadata");
                activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
                        .setTitle("Có phiên bản NAH LAB SUITE mới")
                        .setMessage("Android v" + version + (notes.isEmpty() ? "" : "\n\n" + notes))
                        .setNegativeButton("Để sau", null)
                        .setPositiveButton("Tải và cài đặt", (d,w) -> download(url, sha, version))
                        .show());
            } catch (Throwable e) {
                if (userInitiated) toast("Chưa thể kiểm tra cập nhật. Vui lòng thử lại khi có kết nối mạng.");
            }
        });
    }

    private void download(String url, String sha, String version) {
        try {
            expectedSha = sha;
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("NAH LAB SUITE Android v" + version);
            req.setDescription("Đang tải bản cập nhật");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, "NAH-LAB-SUITE-Android-v" + version + ".apk");
            DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
            downloadId = dm.enqueue(req);
            toast("Đang tải bản cập nhật.");
        } catch (Throwable e) {
            toast("Không thể tải bản cập nhật.");
        }
    }

    private void verifyAndInstall(Uri uri) {
        executor.execute(() -> {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                try (InputStream in = activity.getContentResolver().openInputStream(uri)) {
                    if (in == null) throw new IllegalStateException("download missing");
                    byte[] buf = new byte[32 * 1024];
                    int n;
                    while ((n = in.read(buf)) >= 0) if (n > 0) md.update(buf, 0, n);
                }
                String got = hex(md.digest());
                if (!got.equalsIgnoreCase(expectedSha)) {
                    toast("Gói cập nhật không vượt qua kiểm tra toàn vẹn SHA-256.");
                    return;
                }
                activity.runOnUiThread(() -> install(uri));
            } catch (Throwable e) {
                toast("Không thể xác minh gói cập nhật.");
            }
        });
    }

    private void install(Uri uri) {
        pendingInstallUri = uri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()));
            activity.startActivityForResult(settings, REQUEST_UNKNOWN_APPS);
            return;
        }
        launchInstaller(uri);
    }

    void onActivityResult(int requestCode) {
        if (requestCode != REQUEST_UNKNOWN_APPS || pendingInstallUri == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls()) {
            launchInstaller(pendingInstallUri);
        }
    }

    private void launchInstaller(Uri uri) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { activity.startActivity(i); }
        catch (Throwable e) { toast("Không thể mở trình cài đặt Android."); }
    }

    private boolean isSafeUpdateUrl(String url) {
        try {
            URI u = new URI(url);
            String h = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
            return "https".equalsIgnoreCase(u.getScheme())
                    && ("sachyhoc.com".equals(h) || "www.sachyhoc.com".equals(h));
        } catch (Throwable e) { return false; }
    }

    private void toast(String s) {
        activity.runOnUiThread(() -> Toast.makeText(activity, s, Toast.LENGTH_LONG).show());
    }

    private static byte[] readAll(InputStream in, int max) throws Exception {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] b = new byte[16 * 1024]; int n;
        while ((n = in.read(b)) >= 0) {
            if (n == 0) continue;
            out.write(b, 0, n);
            if (out.size() > max) throw new IllegalStateException("too large");
        }
        return out.toByteArray();
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format(Locale.ROOT, "%02x", x & 0xff));
        return sb.toString();
    }
}

