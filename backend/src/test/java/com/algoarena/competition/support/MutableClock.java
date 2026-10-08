package com.algoarena.competition.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

/** A clock the tests move by hand, so countdowns, deadlines and the contest end are fully deterministic. */
public final class MutableClock extends Clock {

    private final AtomicLong millis = new AtomicLong(Instant.parse("2026-06-01T12:00:00Z").toEpochMilli());

    public void advance(Duration d) {
        millis.addAndGet(d.toMillis());
    }

    public void set(Instant instant) {
        millis.set(instant.toEpochMilli());
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }

    @Override
    public Instant instant() {
        return Instant.ofEpochMilli(millis.get());
    }

    @Override
    public long millis() {
        return millis.get();
    }
}
