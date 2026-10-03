package com.algoarena.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.algoarena.dto.MysterySolveRequest;
import com.algoarena.dto.MysterySolveResponseDto;
import com.algoarena.entity.MysteryCase;
import com.algoarena.entity.User;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.MysteryCaseRepository;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MysteryCaseService {

    private final MysteryCaseRepository mysteryCaseRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<MysteryCase> getAllCases() {
        return mysteryCaseRepository.findAll();
    }

    @Transactional(readOnly = true)
    public MysteryCase getCaseById(Long id) {
        return mysteryCaseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mystery case not found with id: " + id));
    }

    @Transactional
    public MysterySolveResponseDto solveCase(Long userId, Long caseId, MysterySolveRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        MysteryCase myCase = mysteryCaseRepository.findById(caseId)
                .orElseThrow(() -> new ResourceNotFoundException("Mystery case not found"));

        boolean correctCulprit = false;
        boolean correctMotive = false;
        int evidenceMatches = 0;

        try {
            JsonNode correctAnsNode = objectMapper.readTree(myCase.getCorrectAnswer());
            
            // Check culprit
            if (correctAnsNode.has("culprit")) {
                String culprit = correctAnsNode.get("culprit").asText();
                correctCulprit = culprit.equalsIgnoreCase(request.getCulprit().trim());
            }

            // Check motive
            if (correctAnsNode.has("motive")) {
                String motive = correctAnsNode.get("motive").asText();
                correctMotive = motive.equalsIgnoreCase(request.getMotive().trim());
            }

            // Check key evidence matches
            if (correctAnsNode.has("keyEvidence") && request.getKeyEvidence() != null) {
                JsonNode keyEvNode = correctAnsNode.get("keyEvidence");
                for (String ev : request.getKeyEvidence()) {
                    for (JsonNode correctEv : keyEvNode) {
                        if (correctEv.asText().equalsIgnoreCase(ev.trim())) {
                            evidenceMatches++;
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse correct answer for mystery case: {}", caseId, e);
        }

        // Calculate score: (correctCulprit ? 60 : 0) + (correctMotive ? 25 : 0) + (evidenceMatches * 5)
        int score = (correctCulprit ? 60 : 0) + (correctMotive ? 25 : 0) + (evidenceMatches * 5);
        boolean correct = correctCulprit && correctMotive;

        int xpEarned = 0;
        int coinsEarned = 0;

        if (correctCulprit) {
            xpEarned = myCase.getXpReward();
            coinsEarned = 75;
            userService.updateProgression(user, xpEarned, coinsEarned, true, false);
        }

        return MysterySolveResponseDto.builder()
                .correct(correct)
                .score(score)
                .correctCulprit(correctCulprit)
                .correctMotive(correctMotive)
                .evidenceMatches(evidenceMatches)
                .solution(myCase.getSolution())
                .user(userService.convertToDto(user))
                .build();
    }
}
