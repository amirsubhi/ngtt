'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { sanitizeHtml } from '@/lib/sanitize';

interface ShoutMsg {
  id: number;
  user_id: number | null;
  username: string;
  group_color: string;
  content: string;
  created_at: string;
  is_system: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function ShoutContent({ html }: { html: string }) {
  return (
    <span
      className="opacity-80"
      style={{ wordBreak: 'break-word' }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

export function Shoutbox() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ShoutMsg[]>([]);
  const [input, setInput] = useState('');
  const [banned, setBanned] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || socketRef.current) return;

    const socket = io(`${API_URL}/ws`, { auth: { token } });
    socketRef.current = socket;

    socket.on('history', (hist: ShoutMsg[]) => setMessages(hist));
    socket.on('message', (msg: ShoutMsg) => setMessages(prev => [...prev, msg].slice(-200)));
    socket.on('error', (msg: string) => { if (msg.includes('banned')) setBanned(true); });
    socket.on('disconnect', () => { socketRef.current = null; });
  }, []);

  useEffect(() => {
    if (open) connect();
    return () => {
      if (!open && socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [open, connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('message', input.trim());
    setInput('');
  }

  function insertTag(tag: string) {
    setInput(prev => `${prev}[${tag}][/${tag}]`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 rounded-full text-white px-4 py-2 text-sm font-medium shadow-lg hover:opacity-90 z-40"
        style={{ backgroundColor: 'var(--accent)' }}>
        Shoutbox
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-4 w-80 border border-current/20 rounded-t-lg shadow-xl z-40 flex flex-col" style={{ height: '360px', backgroundColor: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-current/10">
        <span className="text-sm font-medium">Shoutbox</span>
        <button onClick={() => setOpen(false)} className="text-xs opacity-50 hover:opacity-80">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
        {messages.map(msg => (
          <div key={msg.id} className={msg.is_system ? 'opacity-60 italic text-center' : ''}>
            {!msg.is_system && (
              <span className="font-medium mr-1" style={{ color: msg.group_color }}>{msg.username}</span>
            )}
            <ShoutContent html={msg.content} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {banned ? (
        <p className="text-xs text-red-500 text-center py-2 border-t border-current/10">You are banned from the shoutbox</p>
      ) : (
        <div className="border-t border-current/10 p-2 space-y-1">
          <div className="flex gap-1">
            {(['b', 'i', 'url'] as const).map(tag => (
              <button key={tag} onClick={() => insertTag(tag)}
                className="text-xs border border-current/20 rounded px-1.5 py-0.5 hover:bg-current/10 font-mono">
                [{tag}]
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Say something…" maxLength={500}
              className="flex-1 text-xs rounded border border-current/20 bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-current/30" />
            <button onClick={send}
              className="rounded text-white text-xs px-2 py-1 hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)' }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
