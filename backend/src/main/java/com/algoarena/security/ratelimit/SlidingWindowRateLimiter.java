package com.algoarena.security.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small, dependency-free, thread-safe sliding-window event counter keyed by an arbitrary string.
 *
 * <p>Single-instance by design: state lives in this JVM. Running several backend instances would give
 * each instance its own counters (an attacker's effective allowance multiplies by the instance count);
 * that is the point at which a shared store (e.g. Redis) becomes necessary. Memory is bounded:
 * expired entries are purged opportunistically and by {@link #purgeExpired()}, and if the table is
 * still over {@code maxKeys} a slice of entries is dropped so a key-flooding attacker cannot exhaust memory.
 */
public final class SlidingWindowRateLimiter {

    private static final class Bucket {
        final Deque<Long> events = new ArrayDeque<>();
        long windowMillis;
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int maxKeys;

    public SlidingWindowRateLimiter(Clock clock, int maxKeys) {
        this.clock = clock;
        this.maxKeys = Math.max(100, maxKeys);
    }

    /** Number of events recorded for {@code key} within the last {@code window}. */
    public int count(String key, Duration window) {
        Bucket bucket = buckets.get(key);
        if (bucket == null) {
            return 0;
        }
        synchronized (bucket) {
            prune(bucket, window.toMillis());
            return bucket.events.size();
        }
    }

    /** Records one event for {@code key}. */
    public void record(String key, Duration window) {
        if (buckets.size() >= maxKeys && !buckets.containsKey(key)) {
            makeRoom();
        }
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket());
        synchronized (bucket) {
            bucket.windowMillis = Math.max(bucket.windowMillis, window.toMillis());
            prune(bucket, window.toMillis());
            bucket.events.addLast(clock.millis());
        }
    }

    /**
     * Atomically checks and records: returns true (and counts the event) if fewer than {@code limit}
     * events happened within {@code window}; otherwise returns false and records nothing.
     */
    public boolean tryAcquire(String key, int limit, Duration window) {
        if (buckets.size() >= maxKeys && !buckets.containsKey(key)) {
            makeRoom();
        }
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket());
        synchronized (bucket) {
            bucket.windowMillis = Math.max(bucket.windowMillis, window.toMillis());
            prune(bucket, window.toMillis());
            if (bucket.events.size() >= limit) {
                return false;
            }
            bucket.events.addLast(clock.millis());
            return true;
        }
    }

    /** Seconds until the oldest counted event leaves the window (>= 1), i.e. a safe Retry-After value. */
    public long secondsUntilAvailable(String key, Duration window) {
        Bucket bucket = buckets.get(key);
        if (bucket == null) {
            return 1;
        }
        synchronized (bucket) {
            prune(bucket, window.toMillis());
            Long oldest = bucket.events.peekFirst();
            if (oldest == null) {
                return 1;
            }
            long remaining = oldest + window.toMillis() - clock.millis();
            return Math.max(1, (remaining + 999) / 1000);
        }
    }

    public void reset(String key) {
        buckets.remove(key);
    }

    public int trackedKeys() {
        return buckets.size();
    }

    /** Drops every bucket whose events have all expired. Called periodically. */
    public void purgeExpired() {
        long now = clock.millis();
        Iterator<Map.Entry<String, Bucket>> it = buckets.entrySet().iterator();
        while (it.hasNext()) {
            Bucket bucket = it.next().getValue();
            synchronized (bucket) {
                prune(bucket, bucket.windowMillis, now);
                if (bucket.events.isEmpty()) {
                    it.remove();
                }
            }
        }
    }

    private void makeRoom() {
        purgeExpired();
        if (buckets.size() >= maxKeys) {
            // Still full of live entries: drop ~10% so new keys can always be tracked (best effort).
            int toDrop = Math.max(1, maxKeys / 10);
            Iterator<String> it = buckets.keySet().iterator();
            while (it.hasNext() && toDrop-- > 0) {
                it.next();
                it.remove();
            }
        }
    }

    private void prune(Bucket bucket, long windowMillis) {
        prune(bucket, windowMillis, clock.millis());
    }

    private static void prune(Bucket bucket, long windowMillis, long now) {
        long cutoff = now - windowMillis;
        while (!bucket.events.isEmpty() && bucket.events.peekFirst() <= cutoff) {
            bucket.events.pollFirst();
        }
    }
}
