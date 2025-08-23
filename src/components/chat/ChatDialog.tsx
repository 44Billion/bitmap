import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MapPin, Activity, Shield, User as UserIcon, Edit2, X, Swords, Flower, ChevronDown } from 'lucide-react';
import { useChatSession } from '@/hooks/useChatSession';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { isLikelySpam, truncateNickname } from '@/lib/utils';

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
  const [hideSpam, setHideSpam] = useState(true); // Default to hiding spam
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { session, sendMessage: sendChatMessage, isLoading, updateNickname } = useChatSession(geohash);
  const { user, metadata } = useCurrentUser();
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

  // Handle scroll events
  const handleScroll = useCallback(() => {
    checkIsAtBottom();
  }, [checkIsAtBottom]);

  // Add scroll event listener to viewport
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const handleViewportScroll = () => {
          checkIsAtBottom();
        };

        viewport.addEventListener('scroll', handleViewportScroll, { passive: true });

        // Initial check
        checkIsAtBottom();

        return () => {
          viewport.removeEventListener('scroll', handleViewportScroll);
        };
      }
    }
  }, [checkIsAtBottom, isOpen]);

  // Auto-scroll to bottom when messages change, but only if user is already at bottom
  useEffect(() => {
    if (chatMessages.length > 0) {
      const wasAtBottom = checkIsAtBottom();
      if (wasAtBottom && scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          (viewport as HTMLElement).scrollTop = (viewport as HTMLElement).scrollHeight;
        }
      } else if (!wasAtBottom) {
        // Show scroll button if new messages arrive and user is not at bottom
        setShowScrollButton(true);
      }
    }
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
    if (session && !user) {
      setNewNickname(session.nickname);
      setIsEditingNickname(true);
    }
  };

  const handleSaveNickname = () => {
    if (newNickname.trim() && session && !user) {
      updateNickname(newNickname.trim());
      setIsEditingNickname(false);
    }
  };

  const handleCancelEditNickname = () => {
    setIsEditingNickname(false);
    setNewNickname('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[600px] bg-black border border-green-500/30 flex flex-col pb-0 overflow-hidden">
        <DialogHeader className="border-b border-green-500/20 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-green-400 font-mono">
              <Activity className="h-5 w-5" />
              BITCHAT SESSION
              <Badge variant="outline" className="text-[10px] border-cyan-500/50 text-cyan-400">
                {geohash}
              </Badge>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Spam filter toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHideSpam(!hideSpam)}
                className={`h-6 w-6 p-0 ${
                  hideSpam
                    ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                    : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                }`}
                title={hideSpam ? "Spam filtering: ON (click to disable)" : "Spam filtering: OFF (click to enable)"}
              >
                {hideSpam ? (
                  <Flower className="h-3 w-3" />
                ) : (
                  <Swords className="h-3 w-3" />
                )}
                <span className="sr-only">
                  {hideSpam ? "Spam filtering enabled" : "Spam filtering disabled"}
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
          <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>Geohash: {geohash}</span>
            </div>
            <div className="flex items-center gap-1">
              {user ? (
                <>
                  <Shield className="h-3 w-3 text-blue-400" />
                  <span className="text-blue-300">Logged in as {metadata?.name || 'user'}</span>
                </>
              ) : isEditingNickname ? (
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
                    className="h-5 w-5 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 p-0"
                  >
                    ✓
                  </Button>
                  <Button
                    onClick={handleCancelEditNickname}
                    size="sm"
                    className="h-5 w-5 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 p-0"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <>
                  <UserIcon className="h-3 w-3 text-orange-400" />
                  <button
                    onClick={handleStartEditNickname}
                    className="text-orange-300 hover:text-orange-200 transition-colors flex items-center gap-1"
                  >
                    {session ? `Ephemeral: ${session.nickname}` : 'Connecting...'}
                    <Edit2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages area - Terminal style */}
          <ScrollArea className="flex-1 px-4 py-2 font-mono text-xs relative" ref={scrollRef} onScroll={handleScroll}>
            <div className="space-y-1">
              {isMessagesLoading ? (
                <div className="text-green-500 py-2 w-full">
                  <span className="animate-pulse">[CONNECTING] </span>
                  <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere">Establishing secure channel...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-gray-500 py-2 w-full">
                  <span className="text-green-500">[SYSTEM] </span>
                  <span className="whitespace-pre-wrap break-all overflow-wrap-anywhere">No messages in channel. Be the first to transmit.</span>
                </div>
              ) : (() => {
                const filteredMessages = chatMessages.filter(msg => !hideSpam || !isLikelySpam(msg));
                const spamMessagesCount = chatMessages.filter(msg => isLikelySpam(msg)).length;

                return (
                  <>
                    {/* Show spam filter status message */}
                    {hideSpam && spamMessagesCount > 0 && (
                      <div className="text-gray-500/50 py-1 w-full text-xs">
                        <span className="text-green-500/30">🌸 </span>
                        <span className="text-gray-500/40">
                          {spamMessagesCount} filtered
                        </span>
                      </div>
                    )}
                    {filteredMessages.map((msg) => {
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
                              &lt;{truncateNickname(session?.nickname || 'user')}&gt;
                            </span>
                          ) : (
                            <span className="text-green-400" title={authorNickname}>
                              &lt;{truncateNickname(authorNickname)}&gt;
                            </span>
                          )}
                          <span className="text-gray-300 whitespace-pre-wrap break-all overflow-wrap-anywhere">{msg.message}</span>
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
                className="absolute bottom-4 right-4 h-8 w-8 p-0 bg-green-500/90 hover:bg-green-500 border-green-500/50 text-green-900 shadow-lg rounded-sm transition-all duration-200 hover:scale-110 z-10"
                title="Scroll to bottom"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-green-500/20 p-4">
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
      </DialogContent>
    </Dialog>
  );
}