// ==============================================================================
// GUTech Internal LMS - Dedicated Classroom Chat Page
// Fulfills Feature 8: Real-time course group discussion channels
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  MessageSquare,
  Send,
  Trash2,
  Users,
  Sparkles,
  Smile,
  Paperclip
} from 'lucide-react';
import { Card, Button, Badge } from '../../components/ui/index.js';
import { Course, ChatMessage } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { formatRelativeTime } from '../../lib/utils.js';
import { LoadError } from '../../components/ui/index.js';
import { useToast, errorMessage } from '../../components/ui/Toast.js';

export const GlobalChatPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputBody, setInputBody] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const list = await api.getMyCourses();
        setCourses(list);
        if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      } catch (error) {
        setCoursesError(errorMessage(error, 'Your class channels could not be loaded.'));
      }
    };

    setCoursesError(null);
    fetchCourses();
  }, [reloadKey]);

  useEffect(() => {
    if (!selectedCourseId) return;

    const loadMessages = async () => {
      setMessagesError(null);
      try {
        const msgs = await api.getChatMessages(selectedCourseId);
        setMessages(msgs);
      } catch (error) {
        setMessages([]);
        setMessagesError(errorMessage(error, 'Messages could not be loaded.'));
      }
    };

    loadMessages();
  }, [selectedCourseId, reloadKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !inputBody.trim()) return;

    const text = inputBody.trim();
    setInputBody('');

    try {
      const sent = await api.sendChatMessage(selectedCourseId, text);
      setMessages(prev => [...prev, sent]);
    } catch (error) {
      // The message was NOT delivered: put the text back and say so instead of pretending it was sent.
      setInputBody(text);
      toast.error('Message not sent', errorMessage(error));
    }
  };

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  if (coursesError) {
    return <LoadError title="Class channels could not be loaded" message={coursesError} onRetry={() => setReloadKey(key => key + 1)} />;
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">Classroom Group Channels</h1>
        <p className="text-xs text-slate-500 mt-0.5">Direct peer-to-peer and instructor course messaging</p>
      </div>

      {messagesError && <LoadError title="Messages could not be loaded" message={messagesError} onRetry={() => setReloadKey(key => key + 1)} />}

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Left: Channels List */}
        <Card className="w-full md:w-72 p-3 flex flex-col gap-2 flex-shrink-0 overflow-y-auto">
          <p className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Class Channels</p>
          {courses.map(c => {
            const active = c.id === selectedCourseId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between ${
                  active
                    ? 'bg-navy-900 text-white font-bold shadow-md shadow-navy-900/10'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    active ? 'bg-gold-400 text-navy-950' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {c.code}
                  </span>
                  <p className="text-xs font-bold mt-1 line-clamp-1">{c.title}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </Card>

        {/* Right: Message Stream */}
        <Card className="flex-1 p-0 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200/70 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider flex items-center gap-2">
                <span>{selectedCourse?.code}: {selectedCourse?.title}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </h3>
              <p className="text-[10px] text-slate-400">Enrolled Students & Faculty Members</p>
            </div>
            <Badge variant="navy">Realtime Subscribed</Badge>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map(msg => {
              const isMine = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <img
                    src={msg.senderAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(msg.senderName)}`}
                    alt={msg.senderName}
                    className="w-8 h-8 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
                  />
                  <div
                    className={`max-w-[75%] rounded-2xl p-4 text-xs shadow-sm ${
                      isMine
                        ? 'bg-navy-900 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`font-bold ${isMine ? 'text-gold-400' : 'text-navy-900'}`}>
                        {msg.senderName}
                      </span>
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-extrabold ${
                          isMine ? 'bg-navy-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {msg.senderRole}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                    <span className={`block text-[9px] mt-2 text-right ${isMine ? 'text-slate-400' : 'text-slate-400'}`}>
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputBody}
              onChange={e => setInputBody(e.target.value)}
              placeholder={`Post message to ${selectedCourse?.code || 'course'}...`}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100"
            />
            <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
              Send
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
