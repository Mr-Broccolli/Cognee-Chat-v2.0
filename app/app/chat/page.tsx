'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { api, getBaseUrl } from '@/lib/api';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  sources?: string[];
}

function ChatContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { scrollToBottom(); }, [messages, streamingText]);

  useEffect(() => {
    const load = async () => {
      setInitialLoading(true);
      if (!sessionId) {
        const newId = crypto.randomUUID();
        setCurrentSessionId(newId);
        setMessages([]);
        setInitialLoading(false);
        return;
      }
      const session = await api.getSession(sessionId);
      if (session) {
        setCurrentSessionId(session.id);
        setMessages(session.messages || []);
      } else {
        setCurrentSessionId(sessionId);
        setMessages([]);
      }
      setInitialLoading(false);
    };
    load();
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveSession = useCallback(async (msgs: Message[], sid: string, firstUserText?: string) => {
    if (msgs.length === 0) return;
    const name = firstUserText
      ? firstUserText.slice(0, 40) + (firstUserText.length > 40 ? '...' : '')
      : 'Chat';
    try {
      await api.saveSession(sid, name, msgs);
    } catch { /* silent */ }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setStreamingText('');
    const sid = currentSessionId || crypto.randomUUID();
    if (!currentSessionId) setCurrentSessionId(sid);

    const userMsg: Message = { id: crypto.randomUUID(), text, isUser: true };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const baseUrl = await getBaseUrl();
      const res = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Chat error: ${await res.text()}`);

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.token) {
                  fullText += data.token;
                  setStreamingText(fullText);
                }
                if (data.answer) {
                  fullText = data.answer;
                  setStreamingText(fullText);
                  break;
                }
              } catch { /* skip non-JSON SSE lines */ }
            }
          }
        }

        const botMsg: Message = {
          id: crypto.randomUUID(),
          text: fullText,
          isUser: false,
        };
        const finalMsgs = [...newMsgs, botMsg];
        setMessages(finalMsgs);
        setStreamingText('');
        saveSession(finalMsgs, sid, text);
      } else {
        const data = await res.json();
        const botMsg: Message = {
          id: crypto.randomUUID(),
          text: data.answer,
          isUser: false,
          sources: data.sources,
        };
        const finalMsgs = [...newMsgs, botMsg];
        setMessages(finalMsgs);
        saveSession(finalMsgs, sid, text);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const errMsg: Message = { id: crypto.randomUUID(), text: `Error: ${e.message}`, isUser: false };
      const finalMsgs = [...newMsgs, errMsg];
      setMessages(finalMsgs);
      saveSession(finalMsgs, sid, text);
    } finally {
      setLoading(false);
      setStreamingText('');
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, loading, currentSessionId, messages, saveSession]);

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Loading session...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full min-h-0">
        {messages.length === 0 && !streamingText && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-text-primary">Cognee Chat</h2>
              <p className="text-text-muted text-sm">Ask anything about your ingested knowledge graph.</p>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl rounded-2xl px-5 py-3 ${
              msg.isUser
                ? 'bg-accent text-white rounded-br-md'
                : 'bg-bg-tertiary text-text-primary rounded-bl-md border border-border-primary'
            }`}>
              {msg.isUser ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <p className="text-xs text-text-muted mt-2 border-t border-border-primary pt-2">
                  Sources: {msg.sources.join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-2xl bg-bg-tertiary text-text-primary rounded-2xl rounded-bl-md border border-border-primary px-5 py-3">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {streamingText}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {loading && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-primary rounded-2xl rounded-bl-md px-5 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-border-primary bg-bg-secondary">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Enter to send, Shift+Enter for newline)"
            className="flex-1 resize-none bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
            rows={2}
            disabled={loading}
          />
          {loading ? (
            <button
              onClick={stopGeneration}
              className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-5 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-text-muted text-sm">Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}
