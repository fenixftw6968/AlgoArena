package com.algoarena.service;

import com.algoarena.dto.LeaderboardEntryDto;
import com.algoarena.entity.User;
import com.algoarena.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<LeaderboardEntryDto> getLeaderboard(String sortBy) {
        List<User> sortedUsers;

        if ("streak".equalsIgnoreCase(sortBy)) {
            sortedUsers = userRepository.findAllOrderByStreakDesc();
        } else if ("games".equalsIgnoreCase(sortBy)) {
            sortedUsers = userRepository.findAllOrderByGamesCompletedDesc();
        } else if ("rating".equalsIgnoreCase(sortBy) || "competitive".equalsIgnoreCase(sortBy) || "ranked".equalsIgnoreCase(sortBy)) {
            sortedUsers = userRepository.findAllOrderByCompetitiveRatingDesc();
        } else {
            sortedUsers = userRepository.findAllOrderByXpDesc();
        }

        List<LeaderboardEntryDto> result = new ArrayList<>();
        int rank = 1;
        for (User user : sortedUsers) {
            int r = user.getCompetitiveRating() != null ? user.getCompetitiveRating() : 500;
            result.add(LeaderboardEntryDto.builder()
                    .rank(rank++)
                    .username(user.getUsername())
                    .level(user.getLevel())
                    .xp(user.getXp())
                    .streak(user.getCurrentStreak())
                    .competitiveRating(r)
                    .competitiveRank(com.algoarena.util.RankUtil.getRankName(r))
                    .matchesWon(user.getMatchesWon() != null ? user.getMatchesWon() : 0)
                    .matchesPlayed(user.getMatchesPlayed() != null ? user.getMatchesPlayed() : 0)
                    .build());
        }

        return result;
    }
}
