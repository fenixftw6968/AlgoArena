package com.algoarena.service;

import com.algoarena.dto.FriendDto;
import com.algoarena.entity.Friendship;
import com.algoarena.entity.User;
import com.algoarena.exception.BadRequestException;
import com.algoarena.exception.ResourceNotFoundException;
import com.algoarena.repository.FriendshipRepository;
import com.algoarena.repository.UserRepository;
import com.algoarena.util.RankUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<FriendDto> getFriends(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<FriendDto> results = new ArrayList<>();

        // Accepted friends
        List<Friendship> accepted = friendshipRepository.findByUserAndStatus(user, Friendship.Status.ACCEPTED);
        for (Friendship f : accepted) {
            User friendUser = f.getUser().getId().equals(userId) ? f.getFriend() : f.getUser();
            int r = friendUser.getCompetitiveRating() != null ? friendUser.getCompetitiveRating() : 500;
            results.add(FriendDto.builder()
                    .id(f.getId())
                    .userId(friendUser.getId())
                    .username(friendUser.getUsername())
                    .level(friendUser.getLevel())
                    .competitiveRating(r)
                    .competitiveRank(RankUtil.getRankName(r))
                    .status("ACCEPTED")
                    .isOnline(true)
                    .connectedAt(f.getUpdatedAt())
                    .build());
        }

        // Incoming pending requests
        List<Friendship> incoming = friendshipRepository.findIncomingPendingRequests(user);
        for (Friendship f : incoming) {
            User requester = f.getUser();
            int r = requester.getCompetitiveRating() != null ? requester.getCompetitiveRating() : 500;
            results.add(FriendDto.builder()
                    .id(f.getId())
                    .userId(requester.getId())
                    .username(requester.getUsername())
                    .level(requester.getLevel())
                    .competitiveRating(r)
                    .competitiveRank(RankUtil.getRankName(r))
                    .status("PENDING_INCOMING")
                    .isOnline(false)
                    .connectedAt(f.getCreatedAt())
                    .build());
        }

        // Outgoing pending requests
        List<Friendship> outgoing = friendshipRepository.findOutgoingPendingRequests(user);
        for (Friendship f : outgoing) {
            User addressee = f.getFriend();
            int r = addressee.getCompetitiveRating() != null ? addressee.getCompetitiveRating() : 500;
            results.add(FriendDto.builder()
                    .id(f.getId())
                    .userId(addressee.getId())
                    .username(addressee.getUsername())
                    .level(addressee.getLevel())
                    .competitiveRating(r)
                    .competitiveRank(RankUtil.getRankName(r))
                    .status("PENDING_OUTGOING")
                    .isOnline(false)
                    .connectedAt(f.getCreatedAt())
                    .build());
        }

        return results;
    }

    @Transactional
    public FriendDto sendFriendRequest(Long userId, String targetUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        User target = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new ResourceNotFoundException("User @" + targetUsername + " not found"));

        if (user.getId().equals(target.getId())) {
            throw new BadRequestException("You cannot add yourself as a friend");
        }

        Optional<Friendship> existing = friendshipRepository.findBetweenUsers(user, target);
        if (existing.isPresent()) {
            Friendship f = existing.get();
            if (f.getStatus() == Friendship.Status.ACCEPTED) {
                throw new BadRequestException("You are already friends with " + targetUsername);
            }
            if (f.getStatus() == Friendship.Status.PENDING) {
                throw new BadRequestException("A friend request is already pending with " + targetUsername);
            }
            // If declined/cancelled previously, re-open
            f.setUser(user);
            f.setFriend(target);
            f.setStatus(Friendship.Status.PENDING);
            f = friendshipRepository.save(f);
            int r = target.getCompetitiveRating() != null ? target.getCompetitiveRating() : 500;
            return FriendDto.builder()
                    .id(f.getId())
                    .userId(target.getId())
                    .username(target.getUsername())
                    .level(target.getLevel())
                    .competitiveRating(r)
                    .competitiveRank(RankUtil.getRankName(r))
                    .status("PENDING_OUTGOING")
                    .isOnline(false)
                    .connectedAt(f.getCreatedAt())
                    .build();
        }

        Friendship friendship = Friendship.builder()
                .user(user)
                .friend(target)
                .status(Friendship.Status.PENDING)
                .build();

        friendship = friendshipRepository.save(friendship);
        int r = target.getCompetitiveRating() != null ? target.getCompetitiveRating() : 500;
        return FriendDto.builder()
                .id(friendship.getId())
                .userId(target.getId())
                .username(target.getUsername())
                .level(target.getLevel())
                .competitiveRating(r)
                .competitiveRank(RankUtil.getRankName(r))
                .status("PENDING_OUTGOING")
                .isOnline(false)
                .connectedAt(friendship.getCreatedAt())
                .build();
    }

    @Transactional
    public void respondToRequest(Long userId, Long friendshipId, boolean accept) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend request not found"));

        if (!friendship.getFriend().getId().equals(userId)) {
            throw new BadRequestException("You are not authorized to respond to this request");
        }

        if (accept) {
            friendship.setStatus(Friendship.Status.ACCEPTED);
            friendshipRepository.save(friendship);
        } else {
            friendshipRepository.delete(friendship);
        }
    }

    @Transactional(readOnly = true)
    public List<FriendDto> getRecommendedUsers(Long userId, int limit) {
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        List<User> allUsers = userRepository.findAllOrderByCompetitiveRatingDesc();
        List<FriendDto> recommendations = new ArrayList<>();

        int userRating = currentUser.getCompetitiveRating() != null ? currentUser.getCompetitiveRating() : 500;

        for (User other : allUsers) {
            if (other.getId().equals(userId)) continue;

            // Check if friendship or pending request already exists
            boolean alreadyConnected = friendshipRepository.findBetweenUsers(currentUser, other).isPresent();
            if (alreadyConnected) continue;

            int otherRating = other.getCompetitiveRating() != null ? other.getCompetitiveRating() : 500;

            recommendations.add(FriendDto.builder()
                    .userId(other.getId())
                    .username(other.getUsername())
                    .level(other.getLevel())
                    .competitiveRating(otherRating)
                    .competitiveRank(RankUtil.getRankName(otherRating))
                    .status("NONE")
                    .isOnline(Math.abs(otherRating - userRating) < 250)
                    .build());

            if (recommendations.size() >= limit) break;
        }

        return recommendations;
    }

    @Transactional
    public void removeFriend(Long userId, Long friendshipId) {
        Friendship friendship = friendshipRepository.findById(friendshipId)
                .orElseThrow(() -> new ResourceNotFoundException("Friend relationship not found"));

        if (!friendship.getUser().getId().equals(userId) && !friendship.getFriend().getId().equals(userId)) {
            throw new BadRequestException("Unauthorized to remove this friend");
        }

        friendshipRepository.delete(friendship);
    }
}
