package com.algoarena.competition.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class CompetitionConfig {

    /**
     * The single time source of the competition domain. Everything time-dependent (deadlines, countdown, end,
     * submission acceptance) reads this clock, so tests can move time deterministically.
     */
    @Bean
    @ConditionalOnMissingBean(Clock.class)
    public Clock competitionClock() {
        return Clock.systemUTC();
    }
}
