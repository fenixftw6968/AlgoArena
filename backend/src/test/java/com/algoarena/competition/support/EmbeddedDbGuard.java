package com.algoarena.competition.support;

import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.EnvironmentAware;
import org.springframework.core.env.Environment;

/**
 * SAFETY NET. These tests run with {@code ddl-auto=create} (Hibernate drops and recreates tables). That must be
 * impossible against any real database, so before a single bean - in particular the EntityManagerFactory - is
 * created, the context refuses to start unless the datasource is the throw-away embedded PostgreSQL.
 * (The application's own .env / environment would otherwise point at the configured Neon database.)
 */
public class EmbeddedDbGuard implements BeanFactoryPostProcessor, EnvironmentAware {

    private Environment environment;

    @Override
    public void setEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
        String url = environment.getProperty("spring.datasource.url");
        String expectedPrefix = "jdbc:postgresql://localhost:" + EmbeddedPgHolder.port() + "/";
        if (url == null || !url.startsWith(expectedPrefix)) {
            throw new IllegalStateException("REFUSING TO RUN: the test datasource is not the embedded PostgreSQL "
                    + "(this guard exists so a test can never create/drop tables in a real database).");
        }
    }
}
