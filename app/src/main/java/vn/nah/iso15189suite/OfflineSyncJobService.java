package vn.nah.iso15189suite;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.webkit.CookieManager;

public class OfflineSyncJobService extends JobService {
    private static final int JOB_ID = 15189110;

    static void schedule(Context context) {
        try {
            JobScheduler js = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
            if (js == null) return;
            for (JobInfo pending : js.getAllPendingJobs()) {
                if (pending.getId() == JOB_ID) return;
            }
            JobInfo job = new JobInfo.Builder(
                    JOB_ID,
                    new ComponentName(context, OfflineSyncJobService.class))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(15L * 60L * 1000L)
                    .build();
            js.schedule(job);
        } catch (Throwable ignored) { }
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        OfflineStore store = new OfflineStore(this);
        String cookie;
        try { cookie = CookieManager.getInstance().getCookie(HydrationManager.APP_URL); }
        catch (Throwable ignored) { cookie = null; }
        if (cookie == null || cookie.trim().isEmpty()) {
            jobFinished(params, false);
            return false;
        }
        final String syncCookie = cookie;
        HydrationManager.syncCore(
                this,
                store,
                syncCookie,
                HydrationManager.UA_MARKER,
                false,
                (success, status) -> {
                    if (status == 401 || status == 403) {
                        store.revokeValidationKeepVault();
                        jobFinished(params, false);
                        return;
                    }
                    if (success && (store.lastDeepSyncMs() == 0L
                            || System.currentTimeMillis() - store.lastDeepSyncMs() >= HydrationManager.DEEP_REFRESH_MS)) {
                        HydrationManager.syncDeep(
                                this,
                                store,
                                syncCookie,
                                HydrationManager.UA_MARKER,
                                false,
                                (deepSuccess, deepStatus) -> {
                                    if (deepStatus == 401 || deepStatus == 403) store.revokeValidationKeepVault();
                                    jobFinished(params, false);
                                });
                    } else {
                        jobFinished(params, false);
                    }
                });
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
