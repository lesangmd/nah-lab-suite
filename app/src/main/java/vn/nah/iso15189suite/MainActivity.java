package vn.nah.iso15189suite;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int STORAGE_PERMISSION_REQUEST = 1002;
    private static final String APP_HOST = "sachyhoc.com";
    private static final long FOREGROUND_SYNC_MS = 5L * 60L * 1000L;
    private static final long INITIAL_DEEP_SYNC_DELAY_MS = 60L * 1000L;
    private static final long POST_UI_CORE_DELAY_MS = 8L * 1000L;
    private static final long FOREGROUND_SYNC_START_DELAY_MS = 15L * 1000L;
    private static final long UPDATE_CHECK_DELAY_MS = 45L * 1000L;

    private FrameLayout webContainer;
    private LinearLayout offlinePanel;
    private TextView offlineTitle;
    private TextView offlineDetail;
    private Button retryButton;
    private Button browserButton;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingUrl;
    private String pendingDownloadUrl;
    private String pendingDownloadUserAgent;
    private String pendingDownloadContentDisposition;
    private String pendingDownloadMimeType;
    private OfflineStore offlineStore;
    private UpdateManager updateManager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean coreSyncInFlight = false;
    private boolean deepSyncInFlight = false;
    private boolean firstUiRendered = false;
    private boolean backgroundWorkStarted = false;
    private int earlySyncProbe = 0;
    private String lastObservedCookie = "";

    private final Runnable foregroundSync = new Runnable() {
        @Override public void run() {
            requestSilentCore(false);
            handler.postDelayed(this, FOREGROUND_SYNC_MS);
        }
    };

    private final Runnable loginCookieProbe = new Runnable() {
        @Override public void run() {
            if (!firstUiRendered || earlySyncProbe >= 60) return;
            earlySyncProbe++;
            String cookie = currentCookie();
            if (cookie != null && !cookie.equals(lastObservedCookie)) {
                lastObservedCookie = cookie;
                handler.postDelayed(() -> requestSilentCore(false), 1500L);
                handler.postDelayed(() -> requestDeepHydration(false), INITIAL_DEEP_SYNC_DELAY_MS);
            }
            handler.postDelayed(this, 1500L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        offlineStore = new OfflineStore(this);

        webContainer = findViewById(R.id.web_container);
        offlinePanel = findViewById(R.id.offline_panel);
        offlineTitle = findViewById(R.id.offline_title);
        offlineDetail = findViewById(R.id.offline_detail);
        retryButton = findViewById(R.id.retry_button);
        browserButton = findViewById(R.id.browser_button);

        retryButton.setOnClickListener(v -> startWebView(pendingUrl));
        browserButton.setOnClickListener(v -> openExternal(
                pendingUrl != null ? pendingUrl : getString(R.string.app_url)));

        applyImmersiveMode();
        // Let the Activity draw its first native frame before WebView/database work.
        // This shortens the Android system splash phase perceptibly.
        webContainer.post(() -> handleIntent(getIntent()));
    }

    private void handleIntent(Intent intent) {
        Uri data = intent != null ? intent.getData() : null;
        String target = (data != null && isInternalUrl(data.toString()))
                ? data.toString()
                : getString(R.string.app_url);
        startWebView(target);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void startWebView(String url) {
        pendingUrl = (url == null || url.trim().isEmpty())
                ? getString(R.string.app_url)
                : url;
        browserButton.setVisibility(View.GONE);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && WebView.getCurrentWebViewPackage() == null) {
                showFallback(
                        getString(R.string.webview_missing_title),
                        getString(R.string.webview_missing_message));
                return;
            }
            destroyWebView();
            webView = new WebView(this);
            webView.setLayoutParams(new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
            webContainer.addView(webView);
            configureWebView();
            showWebView();
            loadInitialDocument();
        } catch (Throwable t) {
            destroyWebView();
            String detail = "Không thể khởi tạo thành phần WebView.";
            try {
                PackageInfo p = WebView.getCurrentWebViewPackage();
                if (p != null) detail += " Phiên bản WebView: " + p.versionName;
            } catch (Throwable ignored) { }
            showFallback(getString(R.string.webview_missing_title), detail);
        }
    }

    private void loadInitialDocument() {
        final String target = pendingUrl;
        if (!HydrationManager.APP_URL.equals(HydrationManager.canonicalShellUrl(target))) {
            webView.loadUrl(target);
            return;
        }

        // Read/decrypt the persistent shell off the UI thread. This keeps the
        // Activity responsive while Android is dismissing the system splash.
        new Thread(() -> {
            OfflineStore.CacheEntry cached = null;
            try { cached = offlineStore.getShell(HydrationManager.APP_URL); }
            catch (Throwable ignored) { }
            final OfflineStore.CacheEntry shell = cached;
            String initialHtml = null;
            try {
                String saved = shell == null || shell.body == null ? null : new String(shell.body, StandardCharsets.UTF_8);
                initialHtml = FactoryShell.isCurrent(saved) ? saved : FactoryShell.read(this);
            } catch (Throwable ignored) { }
            final String bundledOrCachedHtml = initialHtml;
            runOnUiThread(() -> {
                if (webView == null) return;
                try {
                    if (bundledOrCachedHtml != null) {
                        String html = bundledOrCachedHtml;
                        webView.loadDataWithBaseURL(
                                HydrationManager.APP_URL,
                                html,
                                "text/html",
                                "UTF-8",
                                HydrationManager.APP_URL);
                    } else {
                        webView.loadUrl(target);
                    }
                } catch (Throwable ignored) {
                    if (webView != null) webView.loadUrl(target);
                }
            });
        }, "nah-initial-shell").start();
    }

    private void startBackgroundWorkAfterUi() {
        if (backgroundWorkStarted) return;
        backgroundWorkStarted = true;

        new Thread(() -> {
            try { offlineStore.ensureShellContract("android-v1.1.6-web-v1.58.12"); }
            catch (Throwable ignored) { }
        }, "nah-shell-contract").start();

        OfflineSyncJobService.schedule(this);
        updateManager = new UpdateManager(this);
        handler.postDelayed(loginCookieProbe, 1800L);
        handler.postDelayed(() -> requestSilentCore(false), POST_UI_CORE_DELAY_MS);
        handler.postDelayed(foregroundSync, FOREGROUND_SYNC_START_DELAY_MS);
        handler.postDelayed(() -> requestDeepHydration(false), INITIAL_DEEP_SYNC_DELAY_MS);
        handler.postDelayed(() -> {
            if (updateManager != null) updateManager.check(false);
        }, UPDATE_CHECK_DELAY_MS);
    }

    private void revealLoginImmediatelyWhenLoggedOut(WebView view) {
        if (view == null) return;
        String cookie = currentCookie();
        if (cookie != null && !cookie.trim().isEmpty()) return;
        String js = "(function(){var s=document.getElementById('splashView'),l=document.getElementById('loginView'),a=document.getElementById('appView');"
                + "if(s)s.style.display='none';if(l)l.hidden=false;if(a)a.hidden=true;})();";
        try { view.evaluateJavascript(js, null); } catch (Throwable ignored) { }
    }

    private void configureWebView() {
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
        String ua = s.getUserAgentString();
        s.setUserAgentString((ua == null ? "" : ua) + " NAHISOAndroid/1.1.6");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        webView.setBackgroundColor(Color.rgb(243, 251, 247));
        webView.setWebViewClient(new NahWebViewClient());
        webView.setWebChromeClient(new NahWebChromeClient());
        webView.setDownloadListener(new NahDownloadListener());
    }

    private void showWebView() {
        offlinePanel.setVisibility(View.GONE);
        webContainer.setVisibility(View.VISIBLE);
    }

    private void showOffline() {
        offlineTitle.setText(R.string.offline_title);
        offlineDetail.setText(R.string.offline_message);
        retryButton.setVisibility(View.VISIBLE);
        browserButton.setVisibility(View.GONE);
        webContainer.setVisibility(View.GONE);
        offlinePanel.setVisibility(View.VISIBLE);
    }

    private void showFallback(String title, String detail) {
        offlineTitle.setText(title);
        offlineDetail.setText(detail);
        retryButton.setVisibility(View.VISIBLE);
        browserButton.setVisibility(View.VISIBLE);
        webContainer.setVisibility(View.GONE);
        offlinePanel.setVisibility(View.VISIBLE);
    }

    private void destroyWebView() {
        if (webView == null) return;
        try { webView.stopLoading(); } catch (Throwable ignored) { }
        try { webContainer.removeView(webView); } catch (Throwable ignored) { }
        try { webView.destroy(); } catch (Throwable ignored) { }
        webView = null;
    }

    private boolean isInternalUrl(String url) {
        try {
            URI u = new URI(url);
            String scheme = u.getScheme();
            String host = u.getHost();
            return "https".equalsIgnoreCase(scheme)
                    && host != null
                    && (APP_HOST.equalsIgnoreCase(host)
                    || ("www." + APP_HOST).equalsIgnoreCase(host));
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(
                    this,
                    "Không tìm thấy trình duyệt để mở hệ thống.",
                    Toast.LENGTH_SHORT
            ).show();
        }
    }

    private boolean networkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            Network n = cm.getActiveNetwork();
            if (n == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(n);
            return caps != null
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Throwable ignored) {
            return false;
        }
    }

    private String currentCookie() {
        try {
            String cookie = CookieManager.getInstance().getCookie(HydrationManager.APP_URL);
            return cookie == null ? "" : cookie;
        } catch (Throwable ignored) {
            return "";
        }
    }

    private void requestSilentCore(boolean refreshShell) {
        if (coreSyncInFlight || !networkAvailable()) return;
        if (!refreshShell && offlineStore.lastSyncMs() > 0L
                && !"1".equals(offlineStore.getMeta("shell_refresh_pending"))
                && System.currentTimeMillis() - offlineStore.lastSyncMs() < HydrationManager.CORE_MIN_REFRESH_MS) return;
        String cookie = currentCookie();
        if (cookie == null || cookie.trim().isEmpty()) return;
        String ua = webView != null ? webView.getSettings().getUserAgentString() : HydrationManager.UA_MARKER;
        coreSyncInFlight = true;
        HydrationManager.syncCore(
                this,
                offlineStore,
                cookie,
                ua,
                refreshShell,
                (success, status) -> runOnUiThread(() -> {
                    coreSyncInFlight = false;
                    if ((status == 401 || status == 403) && offlineStore.lastSyncMs() > 0) {
                        offlineStore.revokeValidationKeepVault();
                    }
                }));
    }

    private void requestDeepHydration(boolean force) {
        if (deepSyncInFlight || coreSyncInFlight || !networkAvailable()) return;
        if (!force && offlineStore.lastDeepSyncMs() > 0L
                && System.currentTimeMillis() - offlineStore.lastDeepSyncMs() < HydrationManager.DEEP_REFRESH_MS) return;
        String cookie = currentCookie();
        if (cookie == null || cookie.trim().isEmpty()) return;
        String ua = webView != null ? webView.getSettings().getUserAgentString() : HydrationManager.UA_MARKER;
        deepSyncInFlight = true;
        HydrationManager.syncDeep(
                this,
                offlineStore,
                cookie,
                ua,
                force,
                (success, status) -> runOnUiThread(() -> {
                    deepSyncInFlight = false;
                    if ((status == 401 || status == 403) && offlineStore.lastSyncMs() > 0) {
                        offlineStore.revokeValidationKeepVault();
                    }
                }));
    }

    private WebResourceResponse cachedJson(String body) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-NAH-Offline-Cache", "1");
        return new WebResourceResponse(
                "application/json",
                "UTF-8",
                200,
                "OK",
                headers,
                new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private WebResourceResponse cachedShell(OfflineStore.CacheEntry entry) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-NAH-Offline-Cache", "1");
        String mime = entry.mime == null ? "application/octet-stream" : entry.mime;
        String encoding = entry.encoding;
        if (encoding == null && (mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") || mime.contains("svg"))) {
            encoding = "UTF-8";
        }
        return new WebResourceResponse(
                mime,
                encoding,
                200,
                "OK",
                headers,
                new ByteArrayInputStream(entry.body));
    }

    private void injectLogoutCacheHook(WebView view) {
        if (view == null) return;
        String js = "(function(){if(window.__nahAndroidOfflineHook)return;window.__nahAndroidOfflineHook=1;document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('[data-account=\\\"logout\\\"]'):null;if(b){fetch('/nah-lab-iso/__android_offline_lock__',{cache:'no-store'}).catch(function(){});}},true);})();";
        try { view.evaluateJavascript(js, null); } catch (Throwable ignored) { }
    }

    private class NahWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            if (url.startsWith("nahlab-update://check")) {
                if (updateManager != null) updateManager.check(true);
                return true;
            }
            if (isInternalUrl(url)) return false;
            openExternal(url);
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            try {
                String url = request.getUrl().toString();
                String method = request.getMethod() == null ? "GET" : request.getMethod().toUpperCase();
                if ("GET".equals(method)) {
                    WebResourceResponse bundled = FactoryShell.asset(MainActivity.this, url);
                    if (bundled != null) return bundled;
                }

                if (url.contains("/nah-lab-iso/__android_offline_lock__")) {
                    offlineStore.revokeValidationKeepVault();
                    return new WebResourceResponse("text/plain", "UTF-8", 204, "No Content", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
                }

                if ((url.endsWith("/auth/logout") || url.endsWith("/desktop/auth/logout")) && !"GET".equals(method)) {
                    offlineStore.revokeValidationKeepVault();
                    return null;
                }

                if ("GET".equals(method) && url.startsWith(HydrationManager.REST_BASE)) {
                    String key = HydrationManager.normalizeRestKey(url);
                    if (key != null
                            && !key.startsWith("auth/")
                            && !key.startsWith("desktop/mirror/full")
                            && !key.startsWith("desktop/content/")
                            && offlineStore.offlineEligible()) {
                        String body = offlineStore.getEndpoint(key);
                        if (body != null) return cachedJson(body);
                    }
                }

                if ("GET".equals(method)) {
                    String canonical = HydrationManager.canonicalShellUrl(url);
                    OfflineStore.CacheEntry entry = offlineStore.getShell(canonical);
                    if (entry != null) {
                        if (HydrationManager.APP_URL.equals(canonical)
                                && !FactoryShell.isCurrent(new String(entry.body, StandardCharsets.UTF_8))) {
                            return new WebResourceResponse("text/html", "UTF-8",
                                    new ByteArrayInputStream(FactoryShell.read(MainActivity.this).getBytes(StandardCharsets.UTF_8)));
                        }
                        return cachedShell(entry);
                    }
                }
            } catch (Throwable ignored) { }
            return null;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            showWebView();
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            revealLoginImmediatelyWhenLoggedOut(view);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            CookieManager.getInstance().flush();
            try { view.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT); } catch (Throwable ignored) { }
            injectLogoutCacheHook(view);
            firstUiRendered = true;
            startBackgroundWorkAfterUi();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            if (offlineStore.hasShell(HydrationManager.APP_URL)) {
                view.postDelayed(() -> view.loadUrl(HydrationManager.APP_URL), 120L);
            } else {
                showOffline();
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                if (offlineStore.hasShell(HydrationManager.APP_URL)) view.loadUrl(HydrationManager.APP_URL);
                else showOffline();
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            if (view != null) view.stopLoading();
            showFallback(
                    getString(R.string.webview_missing_title),
                    "Kết nối bảo mật SSL không hợp lệ nên ứng dụng đã dừng tải trang.");
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            destroyWebView();
            showFallback(
                    getString(R.string.webview_missing_title),
                    getString(R.string.webview_failed_message));
            return true;
        }
    }

    private class NahWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(
                    Intent.EXTRA_ALLOW_MULTIPLE,
                    params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            if (params != null) {
                String[] accept = params.getAcceptTypes();
                if (accept != null && accept.length > 0) {
                    java.util.ArrayList<String> cleaned = new java.util.ArrayList<>();
                    for (String a : accept) if (a != null && !a.trim().isEmpty()) cleaned.add(a.trim());
                    if (cleaned.size() == 1) intent.setType(cleaned.get(0));
                    else if (cleaned.size() > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, cleaned.toArray(new String[0]));
                }
            }
            try {
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;
            } catch (ActivityNotFoundException e) {
                filePathCallback.onReceiveValue(null);
                filePathCallback = null;
                return false;
            }
        }
    }

    private class NahDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                pendingDownloadUrl = url;
                pendingDownloadUserAgent = userAgent;
                pendingDownloadContentDisposition = contentDisposition;
                pendingDownloadMimeType = mimetype;
                requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST);
                return;
            }
            enqueueDownload(url, userAgent, contentDisposition, mimetype);
        }
    }

    private void enqueueDownload(String url, String userAgent, String contentDisposition, String mimetype) {
        try {
            String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle(filename);
            req.setDescription("NAH LAB SUITE");
            req.setMimeType(mimetype);
            req.addRequestHeader(
                    "User-Agent",
                    userAgent == null ? webView.getSettings().getUserAgentString() : userAgent);
            String cookie = CookieManager.getInstance().getCookie(url);
            if (cookie != null && !cookie.isEmpty()) req.addRequestHeader("Cookie", cookie);
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(req);
            Toast.makeText(this, "Đang tải tệp xuống thư mục Download.", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Không thể tải tệp. Vui lòng thử lại.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (updateManager != null) updateManager.onActivityResult(requestCode);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == STORAGE_PERMISSION_REQUEST) {
            if (grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED
                    && pendingDownloadUrl != null) {
                enqueueDownload(
                        pendingDownloadUrl,
                        pendingDownloadUserAgent,
                        pendingDownloadContentDisposition,
                        pendingDownloadMimeType);
            } else {
                Toast.makeText(
                        this,
                        "Ứng dụng cần quyền lưu tệp để tải xuống trên phiên bản Android này.",
                        Toast.LENGTH_LONG).show();
            }
            pendingDownloadUrl = null;
            pendingDownloadUserAgent = null;
            pendingDownloadContentDisposition = null;
            pendingDownloadMimeType = null;
        }
    }

    private void applyImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
        if (firstUiRendered) {
            handler.postDelayed(() -> requestSilentCore(false), 5_000L);
            handler.postDelayed(() -> requestDeepHydration(false), INITIAL_DEEP_SYNC_DELAY_MS);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersiveMode();
    }

    @Override
    protected void onPause() {
        try { CookieManager.getInstance().flush(); } catch (Throwable ignored) { }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (updateManager != null) updateManager.close();
        destroyWebView();
        try { offlineStore.close(); } catch (Throwable ignored) { }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null
                && webView.getVisibility() == View.VISIBLE
                && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(R.string.exit_title)
                .setMessage(R.string.exit_message)
                .setNegativeButton(R.string.cancel, null)
                .setPositiveButton(R.string.exit, (dialog, which) -> finish())
                .show();
    }
}

