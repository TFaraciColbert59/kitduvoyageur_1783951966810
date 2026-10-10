/**
 * LKDV Feed V1 - Content Feedback Filter
 *
 * Enforces user feedback and moderation constraints:
 * 1. Hard filters: Posts explicitly hidden (`hide`) or reported (`report`)
 *    and authors blocked or reported are immediately eliminated.
 * 2. Soft penalties: Posts or authors marked with `less_like_this` are flagged
 *    so the scoring engine applies the negative feedback penalty (-0.35).
 */

import type { FeedCandidateItem } from '../types/feed.types';

export interface UserFeedbackContext {
  hiddenPostIds?: Set<string> | string[];
  blockedAuthorIds?: Set<string> | string[];
  reportedPostIds?: Set<string> | string[];
  hiddenCarnetIds?: Set<string> | string[];
  reportedCarnetIds?: Set<string> | string[];
  lessLikeThisPostIds?: Set<string> | string[];
  lessLikeThisAuthorIds?: Set<string> | string[];
  lessLikeThisCarnetIds?: Set<string> | string[];
}

/**
 * Normalizes feedback IDs into fast-lookup Sets.
 */
function toSet(input?: Set<string> | string[]): Set<string> {
  if (!input) return new Set();
  if (input instanceof Set) return input;
  return new Set(input);
}

/**
 * Filters candidates based on user feedback.
 * Pure function: returns a new filtered list with updated feedback signals.
 */
export function applyFeedbackFilter(
  candidates: FeedCandidateItem[],
  feedbackContext: UserFeedbackContext = {}
): FeedCandidateItem[] {
  const hiddenPosts = toSet(feedbackContext.hiddenPostIds);
  const blockedAuthors = toSet(feedbackContext.blockedAuthorIds);
  const reportedPosts = toSet(feedbackContext.reportedPostIds);
  const hiddenCarnets = toSet(feedbackContext.hiddenCarnetIds);
  const reportedCarnets = toSet(feedbackContext.reportedCarnetIds);
  const lessLikeThisPosts = toSet(feedbackContext.lessLikeThisPostIds);
  const lessLikeThisAuthors = toSet(feedbackContext.lessLikeThisAuthorIds);
  const lessLikeThisCarnets = toSet(feedbackContext.lessLikeThisCarnetIds);

  const filtered: FeedCandidateItem[] = [];

  for (const candidate of candidates) {
    const linkedCarnetId = candidate.linkedCarnetId || candidate.linkedCarnet?.id;

    // 1. Hard exclusions
    const isPostHidden = hiddenPosts.has(candidate.id) || candidate.signals.feedback.isPostHidden;
    const isPostReported = reportedPosts.has(candidate.id);
    const isAuthorBlocked = blockedAuthors.has(candidate.authorId) || candidate.signals.feedback.isAuthorBlocked;
    const isCarnetHiddenOrReported = Boolean(
      linkedCarnetId && (hiddenCarnets.has(linkedCarnetId) || reportedCarnets.has(linkedCarnetId))
    );

    if (isPostHidden || isPostReported || isAuthorBlocked || isCarnetHiddenOrReported) {
      continue;
    }

    // 2. Soft penalty evaluation
    const hasLessLikeThis =
      candidate.signals.feedback.hasLessLikeThisFeedback ||
      lessLikeThisPosts.has(candidate.id) ||
      lessLikeThisAuthors.has(candidate.authorId) ||
      Boolean(linkedCarnetId && lessLikeThisCarnets.has(linkedCarnetId));

    if (hasLessLikeThis !== candidate.signals.feedback.hasLessLikeThisFeedback) {
      filtered.push({
        ...candidate,
        signals: {
          ...candidate.signals,
          feedback: {
            ...candidate.signals.feedback,
            hasLessLikeThisFeedback: hasLessLikeThis,
          },
        },
      });
    } else {
      filtered.push(candidate);
    }
  }

  return filtered;
}
