package vn.nah.iso15189suite;

import android.content.Context;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Public UI only. Account data stays in the encrypted, account-scoped vault. */
final class FactoryShell {
    static final String VERSION = "1.58.12";
    private static final String PREFIX = "https://sachyhoc.com/nah-lab-iso/native-shell-v1.58.12/assets/";
    private static final Pattern VERSION_PATTERN = Pattern.compile("[\\\"']?version[\\\"']?\\s*:\\s*[\\\"']([0-9]+\\.[0-9]+(?:\\.[0-9]+)?)[\\\"']");

    static boolean isCurrent(String html) {
        if (html == null || !html.contains("NAH_ISO15189")) return false;
        Matcher m = VERSION_PATTERN.matcher(html);
        if (!m.find()) return false;
        String[] actual = m.group(1).split("\\.");
        String[] minimum = VERSION.split("\\.");
        try {
            for (int i = 0; i < Math.max(actual.length, minimum.length); i++) {
                int a = i < actual.length ? Integer.parseInt(actual[i]) : 0;
                int b = i < minimum.length ? Integer.parseInt(minimum[i]) : 0;
                if (a != b) return a > b;
            }
            return true;
        } catch (NumberFormatException ignored) { return false; }
    }

    static String read(Context context) throws Exception {
        try (InputStream in = context.getAssets().open("offline/index.html")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] bytes = new byte[8192];
            int count;
            while ((count = in.read(bytes)) != -1) out.write(bytes, 0, count);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    static WebResourceResponse asset(Context context, String url) {
        if (url == null || !url.startsWith(PREFIX)) return null;
        String name = url.substring(PREFIX.length()).split("[?#]", 2)[0];
        if (!name.matches("[a-zA-Z0-9_.-]+") || name.contains("..")) return null;
        String mime = name.endsWith(".js") ? "application/javascript"
                : name.endsWith(".css") ? "text/css"
                : name.endsWith(".svg") ? "image/svg+xml"
                : name.endsWith(".png") ? "image/png"
                : name.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream";
        try {
            return new WebResourceResponse(mime, "UTF-8", context.getAssets().open("offline/assets/" + name));
        } catch (Exception ignored) { return null; }
    }
}
