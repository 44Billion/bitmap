import React from 'react';
import { getPubkeySuffix } from './getPubkeySuffix';
import { getPubkeyColor } from './getPubkeyColor';
import { truncateNickname } from './utils';

interface MentionInfo {
  nickname: string;
  pubkey: string;
  color: string;
  mentionPattern: string;
}

/**
 * Detects and highlights mentions in chat messages
 * @param message The message content to process
 * @param allMessages Array of all messages to extract user info from
 * @param currentPubkey The pubkey of the current user (if available)
 * @returns React.ReactNode with highlighted mentions
 */
export function highlightMentions(
  message: string,
  allMessages: Array<{ event: { pubkey: string }; nickname?: string }>,
  currentPubkey?: string
): React.ReactNode {
  // Extract unique users from all messages
  const users = new Map<string, MentionInfo>();

  // Add current user if available
  if (currentPubkey) {
    const mentionPattern = `user#${getPubkeySuffix(currentPubkey)}`;
    users.set(currentPubkey, {
      nickname: 'user',
      pubkey: currentPubkey,
      color: getPubkeyColor(currentPubkey),
      mentionPattern,
    });
  }

  // Add all other users from messages
  allMessages.forEach(msg => {
    const pubkey = msg.event.pubkey;
    const nickname = msg.nickname || 'anonymous';
    const mentionPattern = `${truncateNickname(nickname)}#${getPubkeySuffix(pubkey)}`;

    if (!users.has(pubkey)) {
      users.set(pubkey, {
        nickname: truncateNickname(nickname),
        pubkey,
        color: getPubkeyColor(pubkey),
        mentionPattern,
      });
    }
  });

  // Convert to array and sort by mention pattern length (longest first) to avoid partial matches
  const mentionList = Array.from(users.values()).sort((a, b) =>
    b.mentionPattern.length - a.mentionPattern.length
  );

  // If no mentions found or message is empty, return original message
  if (mentionList.length === 0 || !message.trim()) {
    return message;
  }

  // Process the message to highlight mentions
  const result: React.ReactNode[] = [];
  let remainingText = message;

  // Sort mentions by length (longest first) to prioritize longer matches
  mentionList.sort((a, b) => b.mentionPattern.length - a.mentionPattern.length);

  while (remainingText.length > 0) {
    let foundMention: MentionInfo | null = null;
    let foundIndex = -1;

    // Find the earliest mention occurrence
    for (const mention of mentionList) {
      const index = remainingText.indexOf(mention.mentionPattern);
      if (index !== -1 && (foundIndex === -1 || index < foundIndex)) {
        foundMention = mention;
        foundIndex = index;
      }
    }

    if (foundMention && foundIndex !== -1) {
      // Add text before the mention
      if (foundIndex > 0) {
        result.push(remainingText.substring(0, foundIndex));
      }

      // Add the highlighted mention
      result.push(
        React.createElement('span',
          {
            key: `mention-${foundIndex}-${foundMention.pubkey}`,
            style: { color: foundMention.color },
            className: "font-medium"
          },
          foundMention.mentionPattern
        )
      );

      // Move past this mention
      remainingText = remainingText.substring(foundIndex + foundMention.mentionPattern.length);
    } else {
      // No more mentions found, add remaining text
      result.push(remainingText);
      break;
    }
  }

  return result;
}