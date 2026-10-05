package vn.nah.iso15189suite;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.nio.ByteBuffer;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class CryptoBox {
    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "nah_lab_offline_v110";

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(ANDROID_KEYSTORE);
        ks.load(null);
        if (ks.containsAlias(KEY_ALIAS)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) ks.getEntry(KEY_ALIAS, null);
            return entry.getSecretKey();
        }
        KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE);
        gen.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return gen.generateKey();
    }

    byte[] encrypt(byte[] plain) {
        if (plain == null) return new byte[0];
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] iv = cipher.getIV();
            byte[] enc = cipher.doFinal(plain);
            ByteBuffer out = ByteBuffer.allocate(2 + iv.length + enc.length);
            out.put((byte) 1);
            out.put((byte) iv.length);
            out.put(iv);
            out.put(enc);
            return out.array();
        } catch (Throwable ignored) {
            ByteBuffer out = ByteBuffer.allocate(1 + plain.length);
            out.put((byte) 0);
            out.put(plain);
            return out.array();
        }
    }

    byte[] decrypt(byte[] stored) {
        if (stored == null || stored.length == 0) return new byte[0];
        try {
            ByteBuffer in = ByteBuffer.wrap(stored);
            int mode = in.get() & 0xff;
            if (mode == 0) {
                byte[] plain = new byte[in.remaining()];
                in.get(plain);
                return plain;
            }
            if (mode != 1 || in.remaining() < 2) return new byte[0];
            int ivLen = in.get() & 0xff;
            if (ivLen < 8 || ivLen > 32 || in.remaining() <= ivLen) return new byte[0];
            byte[] iv = new byte[ivLen];
            in.get(iv);
            byte[] enc = new byte[in.remaining()];
            in.get(enc);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return cipher.doFinal(enc);
        } catch (Throwable ignored) {
            return new byte[0];
        }
    }
}
