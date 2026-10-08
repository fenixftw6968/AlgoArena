package com.algoarena.competition;

import com.algoarena.competition.config.CompetitionConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;

import static org.junit.jupiter.api.Assertions.*;

/** With competition.enabled unset/false the feature must be completely absent: no controller, no ticker, no beans. */
class CompetitionFeatureFlagTest {

    @Test
    void everyCompetitionBeanIsGatedByTheFeatureFlag() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));   // also matches @Service/@RestController/@Configuration
        var candidates = scanner.findCandidateComponents("com.algoarena.competition");

        assertFalse(candidates.isEmpty());
        for (var def : candidates) {
            Class<?> type = Class.forName(def.getBeanClassName());
            if (type == CompetitionConfig.class || type.getName().contains("$") || type.getName().contains(".support.")) {
                continue; // the Clock bean is harmless and ConditionalOnMissingBean
            }
            ConditionalOnProperty gate = type.getAnnotation(ConditionalOnProperty.class);
            assertNotNull(gate, type.getSimpleName() + " must be @ConditionalOnProperty(competition.enabled)");
            assertEquals("competition", gate.prefix(), type.getSimpleName());
            assertArrayEquals(new String[]{"enabled"}, gate.name(), type.getSimpleName());
            assertEquals("true", gate.havingValue(), type.getSimpleName());
            assertFalse(gate.matchIfMissing(), type.getSimpleName() + " must be OFF by default");
        }
    }
}
