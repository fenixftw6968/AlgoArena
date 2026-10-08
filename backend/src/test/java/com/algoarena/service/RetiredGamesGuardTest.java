package com.algoarena.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Repository-wide regression guard: no application code, question bank, script, config or UI file may
 * reference a retired game. (Tests are excluded - they legitimately name retired slugs to prove they are rejected.)
 */
class RetiredGamesGuardTest {

    private static final Pattern RETIRED = Pattern.compile(
            "memory[-_ ]?challenge|memoryChallenge|brain[-_ ]?teaser|brainTeaser|mystery|mysteries|murder|"
                    + "reaction[-_ ]?rush|grid[-_ ]?puzzle|speed[-_ ]?match|who[-_ ]?(is[-_ ]?)?lying|lie[-_ ]?detector|"
                    + "spot[-_ ]?(the[-_ ]?)?fallac|pattern[-_ ]?(detective|pro)|solve[-_ ]?(the[-_ ]?)?crime|"
                    + "perfect_memory|pattern_games|fallacy_correct|lying_correct",
            Pattern.CASE_INSENSITIVE);

    /** The one intentional leftover: a legacy NOT NULL column kept so existing databases keep working. */
    private static final String LEGACY_ALLOWED_FILE = "backend/src/main/java/com/algoarena/entity/User.java";

    private static Path root() {
        Path here = Path.of("").toAbsolutePath();
        return java.nio.file.Files.exists(here.resolve("docker-compose.yml")) ? here : here.getParent();
    }

    private static List<Path> filesToScan() throws IOException {
        Path root = root();
        List<Path> files = new ArrayList<>();
        for (String dir : List.of("backend/src/main", "frontend/src", "scripts", ".github", ".vscode")) {
            Path base = root.resolve(dir);
            if (Files.exists(base)) {
                try (Stream<Path> walk = Files.walk(base)) {
                    walk.filter(Files::isRegularFile).forEach(files::add);
                }
            }
        }
        for (String f : List.of("docker-compose.yml", ".env.example", "backend/.env.example", "vercel.json",
                "frontend/index.html", "frontend/vercel.json", "frontend/package.json", "frontend/README.md")) {
            if (Files.exists(root.resolve(f))) {
                files.add(root.resolve(f));
            }
        }
        return files;
    }

    @Test
    void noFileReferencesARetiredGame() throws IOException {
        List<String> offenders = new ArrayList<>();
        for (Path file : filesToScan()) {
            String rel = root().relativize(file).toString().replace('\\', '/');
            String content;
            try {
                content = Files.readString(file, StandardCharsets.UTF_8);
            } catch (java.nio.charset.MalformedInputException e) {
                continue; // binary asset
            }
            var matcher = RETIRED.matcher(content);
            while (matcher.find()) {
                if (rel.equals(LEGACY_ALLOWED_FILE) && matcher.group().equalsIgnoreCase("mysteries")) {
                    continue;
                }
                offenders.add(rel + " -> '" + matcher.group() + "'");
                break;
            }
        }
        assertTrue(offenders.isEmpty(), "references to retired games found: " + offenders);
    }

    @Test
    void retiredGameFilesAndRoutesAreGone() {
        Path root = root();
        for (String gone : List.of(
                "backend/src/main/java/com/algoarena/controller/MysteryCaseController.java",
                "backend/src/main/java/com/algoarena/service/MysteryCaseService.java",
                "backend/src/main/java/com/algoarena/entity/MysteryCase.java",
                "backend/src/main/resources/questions/memory-challenge.json",
                "backend/src/main/resources/questions/brain-teaser-battle.json",
                "frontend/src/pages/Games/MemoryChallenge.jsx",
                "frontend/src/pages/Games/BrainTeaserBattle.jsx",
                "frontend/src/data/memoryChallengeQuestions.js",
                "frontend/src/data/brainTeaserQuestions.js",
                "frontend/src/data/mysteryCases.js")) {
            assertFalse(Files.exists(root.resolve(gone)), gone + " must stay deleted");
        }
    }

    @Test
    void theFrontendRegistryAndRoutesExposeExactlyTheFourGames() throws IOException {
        String registry = Files.readString(root().resolve("frontend/src/data/gameRegistry.js"), StandardCharsets.UTF_8);
        String app = Files.readString(root().resolve("frontend/src/App.jsx"), StandardCharsets.UTF_8);

        for (String slug : List.of("dsa-master-quiz", "logic-puzzle", "number-detective", "code-breaker")) {
            assertTrue(registry.contains("slug: '" + slug + "'"), slug + " in registry");
            assertTrue(app.contains("path=\"/games/" + slug + "\""), slug + " route");
        }
        assertEquals(4, Pattern.compile("slug: '").matcher(registry).results().count(), "registry must list exactly four games");
        assertEquals(4, Pattern.compile("path=\"/games/").matcher(app).results().count(), "exactly four game routes");
    }
}
