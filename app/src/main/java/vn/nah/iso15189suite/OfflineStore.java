package vn.nah.iso15189suite;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;

final class OfflineStore extends SQLiteOpenHelper {
    static final long OFFLINE_SESSION_MAX_MS = 30L * 24L * 60L * 60L * 1000L;
    private static final String DB_NAME = "nah_lab_offline_v110.db";
    private static final int DB_VERSION = 1;
    private final CryptoBox crypto = new CryptoBox();

    static final class CacheEntry {
        final byte[] body;
        final String mime;
        final String encoding;
        final long updatedAt;
        CacheEntry(byte[] body, String mime, String encoding, long updatedAt) {
            this.body = body;
            this.mime = mime;
            this.encoding = encoding;
            this.updatedAt = updatedAt;
        }
    }

    OfflineStore(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE endpoint_cache (cache_key TEXT PRIMARY KEY, body BLOB NOT NULL, updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE shell_cache (url TEXT PRIMARY KEY, mime TEXT, encoding TEXT, body BLOB NOT NULL, updated_at INTEGER NOT NULL)");
        db.execSQL("CREATE TABLE meta (meta_key TEXT PRIMARY KEY, meta_value TEXT)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS endpoint_cache");
        db.execSQL("DROP TABLE IF EXISTS shell_cache");
        db.execSQL("DROP TABLE IF EXISTS meta");
        onCreate(db);
    }

    synchronized void replaceEndpointCache(JSONObject cache) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("endpoint_cache", null, null);
            java.util.Iterator<String> keys = cache.keys();
            long now = System.currentTimeMillis();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = cache.opt(key);
                if (value == null) continue;
                String json = value instanceof String ? JSONObject.quote((String) value) : String.valueOf(value);
                ContentValues cv = new ContentValues();
                cv.put("cache_key", key);
                cv.put("body", crypto.encrypt(json.getBytes(StandardCharsets.UTF_8)));
                cv.put("updated_at", now);
                db.insertWithOnConflict("endpoint_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }


    synchronized void mergeEndpointCache(JSONObject cache) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            java.util.Iterator<String> keys = cache.keys();
            long now = System.currentTimeMillis();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = cache.opt(key);
                if (value == null) continue;
                String json = value instanceof String ? JSONObject.quote((String) value) : String.valueOf(value);
                ContentValues cv = new ContentValues();
                cv.put("cache_key", key);
                cv.put("body", crypto.encrypt(json.getBytes(StandardCharsets.UTF_8)));
                cv.put("updated_at", now);
                db.insertWithOnConflict("endpoint_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized void putEndpoint(String key, String json) {
        if (key == null || json == null) return;
        ContentValues cv = new ContentValues();
        cv.put("cache_key", key);
        cv.put("body", crypto.encrypt(json.getBytes(StandardCharsets.UTF_8)));
        cv.put("updated_at", System.currentTimeMillis());
        getWritableDatabase().insertWithOnConflict("endpoint_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    synchronized String getEndpoint(String key) {
        try (Cursor c = getReadableDatabase().query(
                "endpoint_cache",
                new String[]{"body"},
                "cache_key=?",
                new String[]{key},
                null, null, null,
                "1")) {
            if (!c.moveToFirst()) return null;
            byte[] clear = crypto.decrypt(c.getBlob(0));
            if (clear.length == 0) return null;
            return new String(clear, StandardCharsets.UTF_8);
        } catch (Throwable ignored) {
            return null;
        }
    }

    synchronized void putShell(String url, String mime, String encoding, byte[] body) {
        if (url == null || body == null || body.length == 0) return;
        ContentValues cv = new ContentValues();
        cv.put("url", url);
        cv.put("mime", mime == null ? "application/octet-stream" : mime);
        cv.put("encoding", encoding);
        cv.put("body", crypto.encrypt(body));
        cv.put("updated_at", System.currentTimeMillis());
        getWritableDatabase().insertWithOnConflict("shell_cache", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    synchronized CacheEntry getShell(String url) {
        try (Cursor c = getReadableDatabase().query(
                "shell_cache",
                new String[]{"mime", "encoding", "body", "updated_at"},
                "url=?",
                new String[]{url},
                null, null, null,
                "1")) {
            if (!c.moveToFirst()) return null;
            byte[] clear = crypto.decrypt(c.getBlob(2));
            if (clear.length == 0) return null;
            return new CacheEntry(clear, c.getString(0), c.getString(1), c.getLong(3));
        } catch (Throwable ignored) {
            return null;
        }
    }

    synchronized boolean hasShell(String url) {
        try (Cursor c = getReadableDatabase().rawQuery(
                "SELECT 1 FROM shell_cache WHERE url=? LIMIT 1",
                new String[]{url})) {
            return c.moveToFirst();
        } catch (Throwable ignored) {
            return false;
        }
    }

    synchronized void setMeta(String key, String value) {
        ContentValues cv = new ContentValues();
        cv.put("meta_key", key);
        cv.put("meta_value", value);
        getWritableDatabase().insertWithOnConflict("meta", null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    synchronized String getMeta(String key) {
        try (Cursor c = getReadableDatabase().query(
                "meta",
                new String[]{"meta_value"},
                "meta_key=?",
                new String[]{key},
                null, null, null,
                "1")) {
            return c.moveToFirst() ? c.getString(0) : null;
        } catch (Throwable ignored) {
            return null;
        }
    }

    synchronized long getMetaLong(String key, long fallback) {
        try {
            String v = getMeta(key);
            return v == null ? fallback : Long.parseLong(v);
        } catch (Throwable ignored) {
            return fallback;
        }
    }

    synchronized void setLastValidatedNow() {
        setMeta("last_validated_ms", String.valueOf(System.currentTimeMillis()));
    }

    synchronized boolean offlineEligible() {
        long t = getMetaLong("last_validated_ms", 0L);
        return t > 0L && System.currentTimeMillis() - t <= OFFLINE_SESSION_MAX_MS;
    }

    synchronized long lastSyncMs() {
        return getMetaLong("last_sync_ms", 0L);
    }

    synchronized long lastShellSyncMs() {
        return getMetaLong("last_shell_sync_ms", 0L);
    }

    synchronized long lastDeepSyncMs() {
        return getMetaLong("last_deep_sync_ms", 0L);
    }

    synchronized long lastContentSyncMs() {
        return getMetaLong("last_content_sync_ms", 0L);
    }

    synchronized void ensureShellContract(String contract) {
        if (contract == null || contract.isEmpty()) return;
        String current = getMeta("shell_contract");
        if (contract.equals(current)) return;
        // v1.1.6: do not delete the last-known-good WebApp shell on a routine
        // native-version change. The existing shell is the instant-start fallback;
        // a fresh shell is fetched only after the first UI is already visible.
        setMeta("shell_contract", contract);
        setMeta("shell_refresh_pending", "1");
    }

    synchronized void invalidateShellCache() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("shell_cache", null, null);
            db.delete("meta", "meta_key=?", new String[]{"last_shell_sync_ms"});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized void revokeValidationKeepVault() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("meta", "meta_key IN (?,?)", new String[]{"last_validated_ms", "active_session_ref"});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    synchronized void clearUserData() {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("endpoint_cache", null, null);
            db.delete("meta", "meta_key IN (?,?,?,?,?,?)", new String[]{"last_validated_ms", "last_sync_ms", "last_deep_sync_ms", "last_content_sync_ms", "user_ref", "snapshot_version"});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }
}

