import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Send, MapPin, Activity, User as UserIcon, Edit2, X, Swords, Flower, ChevronDown, UserRoundCheck, Ban, UserCheck } from 'lucide-react';
import { useChatSession } from '@/hooks/useChatSession';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserNickname } from '@/hooks/useUserNickname';
import { useToast } from '@/hooks/useToast';
import { filterMessages, isLikelySpam, truncateNickname } from '@/lib/utils';
import { getPubkeySuffix } from '@/lib/getPubkeySuffix';
import { getPubkeyColor } from '@/lib/getPubkeyColor';
import { highlightMentions } from '@/lib/highlightMentions';
import { useSpamFilter } from '@/contexts/SpamFilterContext';

import type { EphemeralEventMessage } from '@/hooks/useChatSession';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  geohash: string;
}

export function ChatDialog({ isOpen, onClose, geohash }: ChatDialogProps) {
  const [message, setMessage] = useState('');
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const { spamFilterEnabled, toggleSpamFilter, blockedUsers, blockUser, unblockUser, isUserBlocked } = useSpamFilter();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    pubkey?: string;
    nickname?: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousMessageCountRef = useRef(0);
  const { session, sendMessage: sendChatMessage, isLoading, updateNickname } = useChatSession(geohash);
  const { user } = useCurrentUser();
  const { resetToDefault } = useUserNickname();
  const { toast } = useToast();

  // Use React Query to get chat messages
  const { data: chatMessages = [], isLoading: isMessagesLoading } = useQuery<EphemeralEventMessage[]>({
    queryKey: ['chat-messages', geohash],
    queryFn: () => {
      // This will be populated by the useChatSession effect
      return [];
    },
    enabled: !!geohash && isOpen,
  });

  // Check if user is at bottom of scroll
  const checkIsAtBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const { scrollTop, scrollHeight, clientHeight } = viewport as HTMLElement;
        const threshold = 50; // pixels from bottom
        const isBottom = scrollHeight - scrollTop - clientHeight <= threshold;
        setIsAtBottom(isBottom);
        return isBottom;
      }
    }
    return true;
  }, []);



  // Simple scroll tracking: open dialog = start tracking, close dialog = stop tracking
  useEffect(() => {
    if (!isOpen) return;

    // Reset previous message count when dialog opens
    previousMessageCountRef.current = 0;

    const handleScroll = () => {
      checkIsAtBottom();
      setShowScrollButton(false);
    };

    // Add scroll listener to the entire document when dialog is open
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    // Initial check
    checkIsAtBottom();

    return () => {
      // Clean up any pending scroll timeout when dialog closes
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      // Remove scroll listener when dialog closes
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isOpen, checkIsAtBottom]);

  // Auto-scroll to bottom when messages change, but only if user is already at bottom
  useEffect(() => {
    if (chatMessages.length === 0) return;

    const wasAtBottom = checkIsAtBottom();
    const newMessageCount = chatMessages.length - previousMessageCountRef.current;

    // Update the previous message count
    previousMessageCountRef.current = chatMessages.length;

    if (wasAtBottom && scrollRef.current) {
      // Clear any pending scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Use a timeout to batch rapid messages and ensure DOM is fully updated
      scrollTimeoutRef.current = setTimeout(() => {
        if (scrollRef.current) {
          const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
          if (viewport) {
            (viewport as HTMLElement).scrollTop = (viewport as HTMLElement).scrollHeight;
          }
        }
      }, newMessageCount > 1 ? 100 : 0); // Longer delay for multiple messages
    } else if (!wasAtBottom) {
      // Show scroll button if new messages arrive and user is not at bottom
      setShowScrollButton(true);
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [chatMessages, checkIsAtBottom]);

  // Hide scroll button when user manually scrolls to bottom
  useEffect(() => {
    if (isAtBottom) {
      setShowScrollButton(false);
    }
  }, [isAtBottom]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        (viewport as HTMLElement).scrollTop = (viewport as HTMLElement).scrollHeight;
        setShowScrollButton(false);
        setIsAtBottom(true);
      }
    }
  }, []);

  // Handle nickname editing
  const handleStartEditNickname = () => {
    if (session) {
      setNewNickname(session.nickname);
      setIsEditingNickname(true);
    }
  };

  const handleSaveNickname = () => {
    if (newNickname.trim() && session) {
      updateNickname(newNickname.trim());
      setIsEditingNickname(false);
    }
  };

  const handleCancelEditNickname = () => {
    setIsEditingNickname(false);
    setNewNickname('');
  };

  const handleResetToDefault = () => {
    if (user) {
      resetToDefault();
      setIsEditingNickname(false);
      setNewNickname('');
    }
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!message.trim() || !session || isLoading) return;

    try {
      const success = await sendChatMessage(message.trim());
      if (success) {
        setMessage('');
      } else {
        toast({
          title: "Failed to send message",
          description: "Please try again",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle username click to add mention
  const handleUsernameClick = (nickname: string, pubkey: string) => {
    const mentionText = `@${nickname}#${getPubkeySuffix(pubkey)} `;
    setMessage(prev => prev + mentionText);

    // Focus the input field after adding mention
    setTimeout(() => {
      const inputElement = document.querySelector('input[placeholder*="Type your message"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
      }
    }, 0);
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, nickname: string, pubkey: string) => {
    e.preventDefault();

    // Get chat dialog container to calculate relative position
    const dialogContent = e.currentTarget.closest('[role="dialog"]');
    if (dialogContent) {
      const rect = dialogContent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate menu dimensions (estimate)
      const menuWidth = 160;
      const menuHeight = 40;

      // Adjust position to keep menu within dialog bounds
      const adjustedX = Math.min(x, rect.width - menuWidth - 10);
      const adjustedY = Math.min(y, rect.height - menuHeight - 10);

      setContextMenu({
        visible: true,
        x: Math.max(10, adjustedX), // Ensure minimum distance from left edge
        y: Math.max(10, adjustedY), // Ensure minimum distance from top edge
        pubkey,
        nickname,
      });
    } else {
      // Fallback to viewport coordinates if container not found
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        pubkey,
        nickname,
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleBlockUser = () => {
    if (contextMenu.pubkey) {
      blockUser(contextMenu.pubkey);
      closeContextMenu();
    }
  };

  const handleUnblockUser = () => {
    if (contextMenu.pubkey) {
      unblockUser(contextMenu.pubkey);
      closeContextMenu();
    }
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu.visible) {
      const handleClickOutside = (e: MouseEvent) => {
        // Check if click is outside the context menu
        const contextMenuElement = document.querySelector('.absolute.z-50.bg-black.border-green-500\\/30');
        if (contextMenuElement && !contextMenuElement.contains(e.target as Node)) {
          closeContextMenu();
        }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-full sm:h-[600px] bg-black border border-green-500/30 flex flex-col p-4 pb-0 sm:p-6 sm:pb-0 overflow-hidden">
        <DialogHeader className="border-b border-green-500/20 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-400 font-mono text-md sm:text-xl">
              <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
              BITCHAT SESSION
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Spam filter toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSpamFilter}
                className={`h-6 w-6 p-0 ${
                  spamFilterEnabled
                    ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                }`}
                title={spamFilterEnabled ? "Spam filtering: ON (click to disable)" : "Spam filtering: OFF (click to enable)"}
              >
                {spamFilterEnabled ? (
                  <Flower className="h-3 w-3" />
                ) : (
                  <Swords className="h-3 w-3" />
                )}
                <span className="sr-only">
                  {spamFilterEnabled ? "Spam filtering enabled" : "Spam filtering disabled"}
                </span>
              </Button>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/20 rounded-sm"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-cyan-400 font-mono">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="hidden sm:flex">Geohash: {geohash}</span>
              <span className="sm:hidden">{geohash}</span>
            </div>
            <div className="flex items-center gap-1">
              {isEditingNickname ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSaveNickname();
                      if (e.key === 'Escape') handleCancelEditNickname();
                    }}
                    placeholder="New nickname..."
                    className="h-6 text-xs bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono w-32"
                    autoFocus
                  />
                  <Button
                    onClick={handleSaveNickname}
                    size="sm"
                    className="h-6 w-6 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 p-0"
                  >
                    ✓
                  </Button>
                  {user && (
                    <Button
                      onClick={handleResetToDefault}
                      size="sm"
                      className="h-6 w-6 bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-400 p-0"
                      title="Reset to default name"
                    >
                      ↺
                    </Button>
                  )}
                  <Button
                    onClick={handleCancelEditNickname}
                    size="sm"
                    className="h-6 w-6 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 p-0"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <>
                  {user ? (
                    <UserRoundCheck className="h-3 w-3 text-blue-400" />
                  ) : (
                    <UserIcon className="h-3 w-3 text-yellow-400" />
                  )}
                  <button
                    onClick={handleStartEditNickname}
                    className={`${user ? 'text-blue-300 hover:text-blue-200' : 'text-yellow-300 hover:text-yellow-200'} transition-colors flex items-center gap-1`}
                  >
                    {session ? session.nickname : 'Connecting...'}
                    <Edit2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages area - Terminal style */}
          <ScrollArea className="flex-1 pb-2 font-mono text-xs relative" ref={scrollRef}>
            <div className="space-y-1">
              {isMessagesLoading ? (
                <div className="text-green-500 py-2 w-full">
                  <span className="animate-pulse">[CONNECTING] </span>
                  <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere">Establishing connection to channel...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-gray-500 py-2 w-full">
                  <span className="text-green-500">[SYSTEM] </span>
                  <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere">No messages in channel. Be the first to transmit.</span>
                </div>
              ) : (() => {
                // Apply unified filtering (spam + deduplication + blocked users)
                const displayMessages = spamFilterEnabled ? filterMessages(chatMessages, blockedUsers) : chatMessages;

                // Calculate counts for status display
                const totalRemoved = chatMessages.length - displayMessages.length;
                const spamCount = chatMessages.filter(msg => isLikelySpam(msg, blockedUsers)).length;
                const blockedCount = chatMessages.filter(msg => blockedUsers.includes(msg.event.pubkey)).length;
                const duplicateCount = totalRemoved - spamCount - blockedCount;

                return (
                  <>
                    {/* Show filtering status messages */}
                    {totalRemoved > 0 && (
                      <div className="text-gray-500/50 py-1 w-full text-xs">
                        {(() => {
                          const items: Array<{ icon: string; color: string; text: string }> = [];

                          if (spamCount > 0) items.push({ icon: '🌸', color: 'text-green-500/30', text: `${spamCount} spam` });
                          if (blockedCount > 0) items.push({ icon: '🚫', color: 'text-red-500/30', text: `${blockedCount} blocked` });
                          if (duplicateCount > 0) items.push({ icon: '🌸', color: 'text-blue-500/30', text: `${duplicateCount} duplicates` });

                          if (items.length === 0) return null;

                          const firstItem = items[0];
                          const remainingItems = items.slice(1);

                          return (
                            <>
                              <span className={firstItem.color}>{firstItem.icon} </span>
                              <span className="text-gray-500/40">
                                {firstItem.text}
                                {remainingItems.length > 0 && `, ${remainingItems.map(item => item.text).join(', ')}`}
                                {items.length > 1 && ' removed'}
                                {items.length === 1 && (firstItem.text.includes('spam') ? ' filtered' : (firstItem.text.includes('blocked') ? '' : ' removed'))}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {displayMessages.map((msg) => {
                      const isOwn = user?.pubkey === msg.event.pubkey;
                      const authorNickname = msg.nickname || 'anonymous';
                      const timestamp = new Date(msg.event.created_at * 1000).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div key={msg.event.id} className="leading-relaxed w-full">
                          <span className="text-gray-500">[{timestamp}] </span>
                          {isOwn ? (
                            <span className="text-cyan-400" title={session?.nickname || 'user'}>
                              &lt;{truncateNickname(session?.nickname || 'user')}<span className="text-[0.85em]" style={{ color: getPubkeyColor(msg.event.pubkey) }}>#{getPubkeySuffix(msg.event.pubkey)}</span>&gt;
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              {isUserBlocked(msg.event.pubkey) && (
                                <Ban className="h-3 w-3 text-red-400" />
                              )}
                              <button
                                onClick={() => handleUsernameClick(authorNickname, msg.event.pubkey)}
                                onContextMenu={(e) => handleContextMenu(e, authorNickname, msg.event.pubkey)}
                                className="text-green-400 hover:text-green-300 transition-colors cursor-pointer border-none bg-transparent p-0 m-0 font-mono"
                                title={authorNickname}
                              >
                                &lt;{truncateNickname(authorNickname)}<span className="text-[0.85em]" style={{ color: getPubkeyColor(msg.event.pubkey) }}>#{getPubkeySuffix(msg.event.pubkey)}</span>&gt;
                              </button>
                            </div>
                          )}
                          <span className="text-gray-300 whitespace-pre-wrap break-all overflow-wrap-anywhere">
                            {highlightMentions(msg.message, displayMessages, user?.pubkey)}
                          </span>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
              <Button
                onClick={scrollToBottom}
                size="sm"
                className="absolute bottom-4 right-0 sm:right-4 h-8 w-8 p-0 bg-green-500/90 hover:bg-green-500 border-green-500/50 text-green-900 shadow-lg rounded-sm transition-all duration-200 hover:scale-110 z-10"
                title="Scroll to bottom"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-green-500/20 py-4">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={session ? (user ? "Type your message..." : `Chatting as ${truncateNickname(session.nickname)}...`) : "Connecting..."}
                disabled={!session || isLoading}
                className="bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || !session || isLoading}
                size="sm"
                className="h-10 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu.visible && contextMenu.pubkey && (
          <div
            className="absolute z-50 bg-black border border-green-500/30 rounded-md shadow-lg py-1 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            {isUserBlocked(contextMenu.pubkey) ? (
              <button
                onClick={handleUnblockUser}
                className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-green-500/10 transition-colors flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Unblock User
              </button>
            ) : (
              <button
                onClick={handleBlockUser}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
              >
                <Ban className="h-4 w-4" />
                Block User
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}