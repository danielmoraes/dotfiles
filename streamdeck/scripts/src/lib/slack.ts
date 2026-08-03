/** Slack `users.profile.set` payload for a status (empty clears it). */
export function slackStatusPayload(
  emoji: string,
  text: string,
): {
  profile: {
    status_text: string
    status_emoji: string
    status_expiration: number
  }
} {
  return {
    profile: {
      status_text: text,
      status_emoji: emoji,
      status_expiration: 0,
    },
  }
}
