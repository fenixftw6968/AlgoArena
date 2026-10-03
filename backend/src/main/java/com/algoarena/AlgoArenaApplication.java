package com.algoarena;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AlgoArenaApplication {
    public static void main(String[] args) {
        SpringApplication.run(AlgoArenaApplication.class, args);
    }
}
