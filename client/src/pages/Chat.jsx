import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  fetchConversations,
  fetchMessages,
  sendMessageREST,
} from '../api/conversations';
import {
  MessageSquare,
  Send,
  User,
  Clock,
  CheckCheck,
  Check,
  Smile,
  Search,
  ChevronLeft,
} from 'lucide-react';

export default function Chat() {
  const { user } = useAuth();
  const { socket, connected, refreshUnreadMessages } = useSocket();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(
    searchParams.get('conv') || ''
  );
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // 1. Fetch conversations list
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoadingConv(true);
        const data = await fetchConversations();
        if (!isMounted) return;
        setConversations(data || []);

        const queryConv = searchParams.get('conv');
        if (queryConv) {
          setActiveConversationId(queryConv);
        } else if (data && data.length > 0) {
          setActiveConversationId((prev) => prev || data[0]._id);
        }
      } catch (err) {
        toast.error('Failed to load conversations');
      } finally {
        if (isMounted) setLoadingConv(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // 2. Fetch messages for active conversation
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      setLoadingMessages(true);
      const data = await fetchMessages(convId);
      setMessages(data.messages || []);
      setTimeout(() => scrollToBottom(false), 50);

      // Tell socket we joined this conversation
      if (socket && connected) {
        socket.emit('join_conversation', { conversationId: convId });
      }

      if (refreshUnreadMessages) {
        refreshUnreadMessages();
      }
    } catch (err) {
      toast.error('Failed to load message history');
    } finally {
      setLoadingMessages(false);
    }
  }, [socket, connected, refreshUnreadMessages]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  // 3. Socket event listeners for real-time messages & typing
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }) => {
      if (conversationId === activeConversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom(true), 50);

        // Mark read
        socket.emit('mark_read', { conversationId });
      }

      // Update conversations list snippet & unread count
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId);
        if (!exists) {
          fetchConversations().then((data) => setConversations(data || []));
          return prev;
        }
        return prev.map((c) => {
          if (c._id === conversationId) {
            return {
              ...c,
              lastMessage: {
                text: message.text,
                sender: message.sender?._id || message.sender,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
              unreadCount:
                conversationId === activeConversationId
                  ? 0
                  : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        });
      });
    };

    const handleTyping = ({ conversationId, userId, isTyping }) => {
      if (conversationId === activeConversationId && userId !== user?._id) {
        setPartnerTyping(isTyping);
      }
    };

    const handleMessageRead = ({ conversationId, userId }) => {
      if (conversationId === activeConversationId && userId !== user?._id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.readBy?.includes(userId)) {
              return { ...m, readBy: [...(m.readBy || []), userId] };
            }
            return m;
          })
        );
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('message_read', handleMessageRead);
    };
  }, [socket, activeConversationId, user?._id]);

  // Send message handler (WebSocket with REST fallback)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const clean = messageText.trim();
    if (!clean || !activeConversationId) return;

    setMessageText('');

    if (socket && connected) {
      socket.emit(
        'send_message',
        { conversationId: activeConversationId, text: clean },
        (res) => {
          if (res?.error) {
            toast.error(res.error);
          }
        }
      );
      // Emit stop typing
      socket.emit('typing', { conversationId: activeConversationId, isTyping: false });
    } else {
      // REST fallback
      try {
        const savedMessage = await sendMessageREST(activeConversationId, clean);
        setMessages((prev) => [...prev, savedMessage]);
        setTimeout(() => scrollToBottom(true), 50);
      } catch (err) {
        toast.error('Failed to send message via REST fallback');
      }
    }
  };

  const handleInputChange = (e) => {
    setMessageText(e.target.value);

    if (socket && connected && activeConversationId) {
      socket.emit('typing', { conversationId: activeConversationId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing', { conversationId: activeConversationId, isTyping: false });
      }, 1500);
    }
  };

  const activeConversation = conversations.find((c) => c._id === activeConversationId);
  const activePartner = activeConversation?.participants?.find(
    (p) => p._id?.toString() !== user?._id?.toString()
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-5rem)]">
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl h-full flex overflow-hidden shadow-2xl backdrop-blur-sm">
        {/* Left Sidebar: Conversations List */}
        <div
          className={`${
            activeConversationId ? 'hidden sm:flex' : 'flex'
          } w-full sm:w-80 md:w-96 border-r border-slate-800 flex-col bg-slate-950/40`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Messages
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {loadingConv ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading chats...</div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active conversations. Start chatting from your matches or session proposals!
              </div>
            ) : (
              conversations.map((conv) => {
                const partner = conv.participants?.find(
                  (p) => p._id?.toString() !== user?._id?.toString()
                );
                const isActive = conv._id === activeConversationId;

                return (
                  <button
                    key={conv._id}
                    onClick={() => {
                      setActiveConversationId(conv._id);
                      setSearchParams({ conv: conv._id });
                    }}
                    className={`w-full p-4 flex items-start gap-3 text-left transition-colors ${
                      isActive
                        ? 'bg-indigo-600/15 border-l-2 border-indigo-500'
                        : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-sm text-white shrink-0 mt-0.5 shadow-sm">
                      {partner?.name?.charAt(0) || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-200 truncate">
                          {partner?.name || 'Partner'}
                        </span>
                        {conv.lastMessage?.createdAt && (
                          <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate mt-1">
                        {conv.lastMessage?.text || 'No messages yet'}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-2">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Panel: Active Message Thread */}
        <div
          className={`${
            activeConversationId ? 'flex' : 'hidden sm:flex'
          } flex-1 flex-col bg-slate-900/40`}
        >
          {activeConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setActiveConversationId('');
                      setSearchParams({});
                    }}
                    className="sm:hidden p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                    title="Back to conversations"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {activePartner?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{activePartner?.name}</h3>
                    <p className="text-[11px] text-slate-400">
                      {partnerTyping ? (
                        <span className="text-indigo-400 font-semibold animate-pulse">
                          typing...
                        </span>
                      ) : (
                        `Timezone: ${activePartner?.timezone || 'UTC'}`
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="py-20 text-center text-xs text-slate-500">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-xs text-slate-500">
                    No messages in this chat yet. Say hi and agree on a skill swap!
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe =
                      (msg.sender?._id || msg.sender)?.toString() === user?._id?.toString();
                    const isRead = msg.readBy?.length > 1;

                    return (
                      <div
                        key={msg._id || i}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                            isMe
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-none'
                              : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>

                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono px-1">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMe && (
                            <span title={isRead ? 'Read' : 'Delivered'}>
                              {isRead ? (
                                <CheckCheck className="w-3 h-3 text-indigo-400" />
                              ) : (
                                <Check className="w-3 h-3 text-slate-500" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Box */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={handleInputChange}
                    placeholder={`Message ${activePartner?.name || 'partner'}...`}
                    maxLength={1000}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="p-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-semibold text-slate-300">Select a conversation</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Pick a conversation from the left to start real-time chat with your skill exchange partner.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
