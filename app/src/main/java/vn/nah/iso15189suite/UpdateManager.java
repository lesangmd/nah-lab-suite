package vn.nah.iso15189suite;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import java.io.File;
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
    static final int CURRENT_VERSION_CODE = BuildConfig.VERSION_CODE;
    static final String CURRENT_VERSION = BuildConfig.VERSION_NAME;
    static final String MANIFEST_URL = "https://sachyhoc.com/wp-json/nah-iso15189/v1/app/update-manifest";
    static final int REQUEST_UNKNOWN_APPS = 1803;
    static final String RELEASE_CERT_SHA256 = "d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c";

    private final Activity activity;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private long downloadId = -1L;
    private volatile long lastAutoCheckAt = 0L;
    private Uri pendingInstallUri;
    private String expectedSha = "";
    private String expectedFilename = "";
    private int expectedVersionCode = 0;
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
        if (!userInitiated) {
            long now = android.os.SystemClock.elapsedRealtime();
            if (now - lastAutoCheckAt < 30 * 60_000L) return;
            lastAutoCheckAt = now;
        }
        executor.execute(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(MANIFEST_URL).openConnection();
                c.setConnectTimeout(12_000);
                c.setReadTimeout(18_000);
                c.setRequestProperty("Accept", "application/json");
                c.setRequestProperty("User-Agent", "NAHISOAndroid/" + CURRENT_VERSION);
                int code = c.getResponseCode();
                if (code != 200) throw new IllegalStateException("HTTP " + code);
                byte[] body;
                try (InputStream in = c.getInputStream()) { body = readAll(in, 2 * 1024 * 1024); }
                JSONObject root = new JSONObject(new String(body, java.nio.charset.StandardCharsets.UTF_8));
                JSONObject android = root.optJSONObject("platforms") == null ? null : root.optJSONObject("platforms").optJSONObject("android");
                if (android == null || !android.optBoolean("available", false)
                        || !android.optBoolean("releaseReady", false)) {
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
                boolean mandatory = android.optBoolean("mandatory", false)
                        || CURRENT_VERSION_CODE < android.optInt("minimumSupportedVersionCode", 0);
                String signer = android.optString("signerCertificateSha256", "")
                        .replace(":", "").replaceAll("\\s+", "").toLowerCase(Locale.ROOT);
                if (!isSafeUpdateUrl(url) || !sha.matches("^[a-f0-9]{64}$"))
                    throw new IllegalStateException("Invalid update metadata");
                if (!RELEASE_CERT_SHA256.equals(signer)) {
                    if (userInitiated) toast("Không xác minh được chứng chỉ ký của bản cập nhật. Vui lòng liên hệ quản trị hệ thống.");
                    return;
                }
                activity.runOnUiThread(() -> {
                    AlertDialog.Builder dialog = new AlertDialog.Builder(activity)
                            .setTitle(mandatory ? "Bạn cần cập nhật ứng dụng" : "Có phiên bản NAH LabSuite mới")
                            .setMessage((mandatory ? "Đã có phiên bản mới hơn với dữ liệu, chức năng và các sửa lỗi mới. "
                                    + "Bạn cần cập nhật để tiếp tục sử dụng." : "Đã có phiên bản mới.")
                                    + "\n\nAndroid v" + version + (notes.isEmpty() ? "" : "\n\n" + notes))
                            .setPositiveButton("Tải và cài đặt", (d,w) -> download(url, sha, version, remoteCode));
                    if (!mandatory) dialog.setNegativeButton("Để sau", null);
                    AlertDialog popup = dialog.create();
                    popup.setCancelable(!mandatory);
                    popup.setCanceledOnTouchOutside(!mandatory);
                    popup.show();
                });
            } catch (Throwable e) {
                if (userInitiated) toast("Chưa thể kiểm tra cập nhật. Vui lòng thử lại khi có kết nối mạng.");
            }
        });
    }

    private void download(String url, String sha, String version, int versionCode) {
        try {
            expectedSha = sha;
            expectedVersionCode = versionCode;
            expectedFilename = "NAH-LAB-SUITE-Android-v" + version + ".apk";
            File existing = new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), expectedFilename);
            if (existing.exists() && !existing.delete()) throw new IllegalStateException("stale apk");
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle("NAH LAB SUITE Android v" + version);
            req.setDescription("Đang tải bản cập nhật");
            req.setMimeType("application/vnd.android.package-archive");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, expectedFilename);
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
                verifyApkPackageAndSigner();
                activity.runOnUiThread(() -> install(uri));
            } catch (Throwable e) {
                toast("Không thể xác minh gói cập nhật.");
            }
        });
    }

    private void verifyApkPackageAndSigner() throws Exception {
        File f = new File(activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), expectedFilename);
        if (!f.isFile() || f.length() < 1024) throw new SecurityException("APK not present");
        PackageManager pm = activity.getPackageManager();
        PackageInfo info = pm.getPackageArchiveInfo(f.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (info == null || !activity.getPackageName().equals(info.packageName))
            throw new SecurityException("Package ID mismatch");
        long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
        if (code != expectedVersionCode || code <= CURRENT_VERSION_CODE)
            throw new SecurityException("Version downgrade or mismatched version");
        SigningInfo signing = info.signingInfo;
        if (signing == null) throw new SecurityException("Unsigned APK");
        Signature[] signers = signing.getApkContentsSigners();
        if (signers == null || signers.length != 1) throw new SecurityException("Unexpected signer count");
        String signerHash = hex(MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray()));
        if (!RELEASE_CERT_SHA256.equals(signerHash))
            throw new SecurityException("Release signing certificate mismatch");
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

