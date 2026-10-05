package vn.nah.iso15189suite;

import android.content.Context;
import android.net.Uri;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class HydrationManager {
    static final String APP_URL = "https://sachyhoc.com/nah-lab-iso/";
    static final String REST_BASE = "https://sachyhoc.com/wp-json/nah-iso15189/v1/";
    static final String CORE_MIRROR_URL = REST_BASE + "desktop/mirror/full?scope=core";
    static final String DATASET_MANIFEST_URL = REST_BASE + "desktop/dataset/manifest";
    static final String FULL_MIRROR_URL = REST_BASE + "desktop/mirror/full";
    static final String CONTENT_URL = REST_BASE + "desktop/content/bundle";
    static final String MANIFEST_URL = REST_BASE + "desktop/content/manifest";
    static final String UA_MARKER = "NAHISOAndroid/1.1.5";

    static final long CORE_MIN_REFRESH_MS = 60L * 1000L;
    static final long DEEP_REFRESH_MS = 12L * 60L * 60L * 1000L;
    private static final long CONTENT_REFRESH_MS = 24L * 60L * 60L * 1000L;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final Pattern ASSET_PATTERN = Pattern.compile("(?:src|href)=[\\\"']([^\\\"']+)[\\\"']", Pattern.CASE_INSENSITIVE);
    private static final int MAX_RESOURCE_BYTES = 3 * 1024 * 1024;
    private static final int MAX_SHELL_TOTAL_BYTES = 18 * 1024 * 1024;

    interface Callback {
        void onFinished(boolean success, int httpStatus);
    }

    private static final class HttpResult {
        int status;
        String contentType;
        byte[] body;
        String finalUrl;
    }

    static void syncCore(Context context, OfflineStore store, String cookie, String baseUserAgent, boolean refreshShell, Callback callback) {
        EXECUTOR.execute(() -> {
            int status = 0;
            boolean success = false;
            try {
                final boolean shellRefreshDue = refreshShell
                        || !store.hasShell(APP_URL)
                        || System.currentTimeMillis() - store.lastShellSyncMs() > 24L * 60L * 60L * 1000L;
                if (cookie == null || cookie.trim().isEmpty()) {
                    if (callback != null) callback.onFinished(false, 401);
                    return;
                }

                String remoteDatasetVersion = "";
                String remoteUserRef = "";
                try {
                    HttpResult manifest = httpGet(DATASET_MANIFEST_URL, cookie, baseUserAgent, 20_000, 2 * 1024 * 1024);
                    if (manifest.status == 200 && manifest.body != null) {
                        JSONObject meta = new JSONObject(new String(manifest.body, StandardCharsets.UTF_8));
                        remoteDatasetVersion = meta.optString("datasetVersion", "");
                        remoteUserRef = meta.optString("userRef", "");
                        String cachedUser = store.getMeta("user_ref");
                        if (cachedUser != null && !cachedUser.isEmpty() && !remoteUserRef.isEmpty() && !cachedUser.equals(remoteUserRef)) {
                            store.clearUserData();
                        } else if (!refreshShell && !remoteDatasetVersion.isEmpty()
                                && remoteDatasetVersion.equals(store.getMeta("dataset_version"))
                                && store.getEndpoint("bootstrap") != null) {
                            store.setLastValidatedNow();
                            store.setMeta("last_sync_ms", String.valueOf(System.currentTimeMillis()));
                            if (callback != null) callback.onFinished(true, 200);
                            return;
                        }
                    }
                } catch (Throwable ignored) { }

                HttpResult mirror = httpGet(CORE_MIRROR_URL, cookie, baseUserAgent, 45_000, 64 * 1024 * 1024);
                status = mirror.status;
                if (mirror.status == 200 && mirror.body != null) {
                    JSONObject root = new JSONObject(new String(mirror.body, StandardCharsets.UTF_8));
                    JSONObject endpointCache = root.optJSONObject("endpointCache");
                    if (endpointCache != null && endpointCache.length() > 0) {
                        String incomingUser = root.optString("userRef", "");
                        String cachedUser = store.getMeta("user_ref");
                        if (cachedUser != null && !cachedUser.isEmpty() && !incomingUser.isEmpty() && !cachedUser.equals(incomingUser)) {
                            store.clearUserData();
                        }
                        store.mergeEndpointCache(endpointCache);
                        store.putEndpoint("__core_mirror_meta__", root.toString());
                        store.setMeta("snapshot_version", root.optString("version", ""));
                        store.setMeta("user_ref", incomingUser);
                        if (!remoteDatasetVersion.isEmpty()) store.setMeta("dataset_version", remoteDatasetVersion);
                        store.setMeta("last_sync_ms", String.valueOf(System.currentTimeMillis()));
                        store.setLastValidatedNow();
                        success = true;
                    }
                }

                if (success && System.currentTimeMillis() - store.lastContentSyncMs() > CONTENT_REFRESH_MS) {
                    refreshStaticContent(store, cookie, baseUserAgent);
                }
                // Shell refresh is deliberately last: it must never delay the first
                // visible UI or the compact core reconciliation.
                if (success && shellRefreshDue) {
                    try { refreshShell(store, cookie, baseUserAgent); } catch (Throwable ignored) { }
                }
            } catch (Throwable ignored) {
                success = false;
            }
            if (callback != null) callback.onFinished(success, status);
        });
    }

    static void syncDeep(Context context, OfflineStore store, String cookie, String baseUserAgent, boolean force, Callback callback) {
        EXECUTOR.execute(() -> {
            int status = 0;
            boolean success = false;
            try {
                if (!force && store.lastDeepSyncMs() > 0L && System.currentTimeMillis() - store.lastDeepSyncMs() < DEEP_REFRESH_MS) {
                    if (callback != null) callback.onFinished(true, 200);
                    return;
                }
                if (cookie == null || cookie.trim().isEmpty()) {
                    if (callback != null) callback.onFinished(false, 401);
                    return;
                }

                HttpResult mirror = httpGet(FULL_MIRROR_URL, cookie, baseUserAgent, 180_000, 96 * 1024 * 1024);
                status = mirror.status;
                if (mirror.status == 200 && mirror.body != null) {
                    JSONObject root = new JSONObject(new String(mirror.body, StandardCharsets.UTF_8));
                    JSONObject endpointCache = root.optJSONObject("endpointCache");
                    if (endpointCache != null && endpointCache.length() > 0) {
                        store.mergeEndpointCache(endpointCache);
                        store.putEndpoint("__full_mirror_meta__", root.toString());
                        store.setMeta("snapshot_version", root.optString("version", ""));
                        store.setMeta("user_ref", root.optString("userRef", ""));
                        long now = System.currentTimeMillis();
                        store.setMeta("last_sync_ms", String.valueOf(now));
                        store.setMeta("last_deep_sync_ms", String.valueOf(now));
                        store.setLastValidatedNow();
                        success = true;
                    }
                }
            } catch (Throwable ignored) {
                success = false;
            }
            if (callback != null) callback.onFinished(success, status);
        });
    }

    private static void refreshStaticContent(OfflineStore store, String cookie, String baseUserAgent) {
        boolean any = false;
        try {
            HttpResult content = httpGet(CONTENT_URL, cookie, baseUserAgent, 60_000, 64 * 1024 * 1024);
            if (content.status == 200 && content.body != null) {
                store.putEndpoint("__content_bundle__", new String(content.body, StandardCharsets.UTF_8));
                any = true;
            }
        } catch (Throwable ignored) { }
        try {
            HttpResult manifest = httpGet(MANIFEST_URL, cookie, baseUserAgent, 30_000, MAX_RESOURCE_BYTES + 1024);
            if (manifest.status == 200 && manifest.body != null) {
                store.putEndpoint("__content_manifest__", new String(manifest.body, StandardCharsets.UTF_8));
                any = true;
            }
        } catch (Throwable ignored) { }
        if (any) store.setMeta("last_content_sync_ms", String.valueOf(System.currentTimeMillis()));
    }

    private static void refreshShell(OfflineStore store, String cookie, String baseUserAgent) throws Exception {
        HttpResult shell = httpGet(APP_URL, cookie, baseUserAgent, 30_000, MAX_RESOURCE_BYTES + 1024);
        if (shell.status != 200 || shell.body == null || shell.body.length == 0) return;
        store.putShell(APP_URL, mimeOnly(shell.contentType, "text/html"), charsetOf(shell.contentType), shell.body);
        String html = new String(shell.body, StandardCharsets.UTF_8);
        Matcher m = ASSET_PATTERN.matcher(html);
        Set<String> urls = new HashSet<>();
        while (m.find() && urls.size() < 40) {
            String ref = m.group(1);
            if (ref == null || ref.startsWith("data:") || ref.startsWith("javascript:")) continue;
            try {
                URL abs = new URL(new URL(APP_URL), ref);
                if (!"https".equalsIgnoreCase(abs.getProtocol())) continue;
                if (!"sachyhoc.com".equalsIgnoreCase(abs.getHost()) && !"www.sachyhoc.com".equalsIgnoreCase(abs.getHost())) continue;
                String path = abs.getPath().toLowerCase(Locale.ROOT);
                if (!(path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".svg") || path.endsWith(".webmanifest") || path.endsWith("service-worker.js"))) continue;
                urls.add(abs.toString());
            } catch (Throwable ignored) { }
        }

        int total = shell.body.length;
        for (String url : urls) {
            if (total >= MAX_SHELL_TOTAL_BYTES) break;
            try {
                HttpResult r = httpGet(url, cookie, baseUserAgent, 30_000, MAX_RESOURCE_BYTES + 1024);
                if (r.status != 200 || r.body == null || r.body.length == 0 || r.body.length > MAX_RESOURCE_BYTES) continue;
                total += r.body.length;
                if (total > MAX_SHELL_TOTAL_BYTES) break;
                store.putShell(url, mimeOnly(r.contentType, guessMime(url)), charsetOf(r.contentType), r.body);
            } catch (Throwable ignored) { }
        }
        store.setMeta("last_shell_sync_ms", String.valueOf(System.currentTimeMillis()));
    }

    private static HttpResult httpGet(String url, String cookie, String baseUserAgent, int timeoutMs, int maxBytes) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(Math.min(timeoutMs, 20_000));
        c.setReadTimeout(timeoutMs);
        c.setRequestMethod("GET");
        c.setRequestProperty("Accept-Encoding", "identity");
        c.setRequestProperty("Accept", "application/json,text/html,application/javascript,text/css,image/*,*/*;q=0.8");
        c.setRequestProperty("Cache-Control", "no-cache");
        String ua = (baseUserAgent == null ? "" : baseUserAgent.trim());
        if (!ua.contains(UA_MARKER)) ua = ua + " " + UA_MARKER;
        c.setRequestProperty("User-Agent", ua.trim());
        if (cookie != null && !cookie.trim().isEmpty()) c.setRequestProperty("Cookie", cookie);
        c.connect();
        HttpResult r = new HttpResult();
        r.status = c.getResponseCode();
        r.contentType = c.getContentType();
        r.finalUrl = c.getURL().toString();
        InputStream in = r.status >= 400 ? c.getErrorStream() : c.getInputStream();
        if (in != null) {
            try (InputStream input = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16 * 1024];
                int n;
                while ((n = input.read(buf)) >= 0) {
                    if (n == 0) continue;
                    out.write(buf, 0, n);
                    if (out.size() > maxBytes) throw new IllegalStateException("Response too large");
                }
                r.body = out.toByteArray();
            }
        }
        c.disconnect();
        return r;
    }

    static String normalizeRestKey(String fullUrl) {
        if (fullUrl == null || !fullUrl.startsWith(REST_BASE)) return null;
        String rel = fullUrl.substring(REST_BASE.length());
        rel = rel.replaceAll("([?&])(?:_ts|ts)=\\d+(&|$)", "$1");
        rel = rel.replace("?&", "?");
        while (rel.endsWith("?") || rel.endsWith("&")) rel = rel.substring(0, rel.length() - 1);
        return rel;
    }

    static String canonicalShellUrl(String url) {
        if (url == null) return null;
        try {
            Uri u = Uri.parse(url);
            if (("sachyhoc.com".equalsIgnoreCase(u.getHost()) || "www.sachyhoc.com".equalsIgnoreCase(u.getHost()))
                    && "/nah-lab-iso/".equals(u.getPath())) return APP_URL;
            int hash = url.indexOf('#');
            return hash >= 0 ? url.substring(0, hash) : url;
        } catch (Throwable ignored) {
            return url;
        }
    }

    private static String mimeOnly(String contentType, String fallback) {
        if (contentType == null || contentType.trim().isEmpty()) return fallback;
        int p = contentType.indexOf(';');
        return (p >= 0 ? contentType.substring(0, p) : contentType).trim();
    }

    private static String charsetOf(String contentType) {
        if (contentType == null) return null;
        Matcher m = Pattern.compile("charset=([^; ]+)", Pattern.CASE_INSENSITIVE).matcher(contentType);
        return m.find() ? m.group(1).replace("\"", "").trim() : null;
    }

    private static String guessMime(String url) {
        String u = url.toLowerCase(Locale.ROOT);
        if (u.contains(".js")) return "application/javascript";
        if (u.contains(".css")) return "text/css";
        if (u.contains(".png")) return "image/png";
        if (u.contains(".jpg") || u.contains(".jpeg")) return "image/jpeg";
        if (u.contains(".svg")) return "image/svg+xml";
        if (u.contains(".webmanifest")) return "application/manifest+json";
        return "application/octet-stream";
    }
}
