import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, MapPin, Activity, Shield, User as UserIcon, Edit2 } from 'lucide-react';
import { useChatSession } from '@/hooks/useChatSession';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
      <DialogContent className="max-w-2xl h-[600px] bg-black border border-green-500/30 flex flex-col pb-0">
        <DialogHeader className="border-b border-green-500/20 pb-4">
          <DialogTitle className="flex items-center gap-2 text-green-400 font-mono">
            <Activity className="h-5 w-5" />
            BITCHAT SESSION
            <Badge variant="outline" className="text-[10px] border-cyan-500/50 text-cyan-400">
              {geohash}
            </Badge>
          </DialogTitle>
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
          <ScrollArea className="flex-1 px-4 py-2 font-mono text-xs" ref={scrollRef}>
            <div className="space-y-1">
              {isMessagesLoading ? (
                <div className="text-green-500 py-2">
                  <span className="animate-pulse">[CONNECTING] </span>
                  <span>Establishing secure channel...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-gray-500 py-2">
                  <span className="text-green-500">[SYSTEM] </span>
                  <span>No messages in channel. Be the first to transmit.</span>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isOwn = user?.pubkey === msg.event.pubkey;
                  const authorNickname = msg.nickname || 'anonymous';
                  const timestamp = new Date(msg.event.created_at * 1000).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={msg.event.id} className="leading-relaxed">
                      <span className="text-gray-500">[{timestamp}] </span>
                      {isOwn ? (
                        <span className="text-cyan-400">
                          &lt;{session?.nickname || 'user'}&gt;
                        </span>
                      ) : (
                        <span className="text-green-400">
                          &lt;{authorNickname}&gt;
                        </span>
                      )}
                      <span className="text-gray-300">{msg.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-green-500/20 p-4">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={session ? (user ? "Type your message..." : `Chatting as ${session.nickname}...`) : "Connecting..."}
                disabled={!session || isLoading}
                className="bg-black/50 border-green-500/30 text-green-400 placeholder:text-green-500/50 font-mono text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || !session || isLoading}
                size="sm"
                className="bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400"
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