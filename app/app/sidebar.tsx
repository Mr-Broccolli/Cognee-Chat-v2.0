'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface ChatSession {
  id: string;
  name: string;
  messages: any[];
}

const navItems = [
  { path: '/chat', label: 'Chat', icon: '💬' },
  { path: '/ingest', label: 'Ingest', icon: '📥' },
  { path: '/graph', label: 'Graph', icon: '🔗' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(() => setConnected(true)).catch(() => setConnected(false));
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [pathname, refreshSessions]);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await api.getGraph();
        setNodeCount(data.nodes?.length ?? 0);
        setEdgeCount(data.edges?.length ?? 0);
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  const newChat = async () => {
    const data = await api.getSessions();
    setSessions(data);
    router.push('/chat');
  };

  const selectSession = (id: string) => {
    setMenuOpenId(null);
    router.push(`/chat?id=${id}`);
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setMenuOpenId(null);
  };

  const commitRename = async () => {
    if (!editingId || !editName.trim()) { setEditingId(null); return; }
    const s = sessions.find(s => s.id === editingId);
    if (s) {
      try {
        await api.saveSession(editingId, editName.trim(), s.messages);
        setSessions(prev => prev.map(s => s.id === editingId ? { ...s, name: editName.trim() } : s));
      } catch { /* silent */ }
    }
    setEditingId(null);
  };

  const deleteSession = async (id: string) => {
    setMenuOpenId(null);
    try {
      await api.deleteSessionApi(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (pathname.startsWith('/chat')) router.push('/chat');
    } catch { /* silent */ }
  };

  return (
    <aside className="w-64 bg-bg-secondary border-r border-border-primary flex flex-col shrink-0 h-full">
      <div className="p-5 border-b border-border-primary">
        <h2 className="text-lg font-semibold text-text-primary">Cognee Chat</h2>
        <p className="text-xs text-text-muted mt-0.5">Graph-RAG AI</p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-accent-green' : 'bg-accent-red'}`} />
          <span className="text-xs text-text-secondary">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <button
        onClick={newChat}
        className="mx-3 mt-3 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
      >
        + New Chat
      </button>

      <nav className="p-3 space-y-1 mt-2">
        {navItems.map(item => {
          const active = pathname === item.path || (item.path === '/chat' && (pathname === '/' || pathname.startsWith('/chat')));
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 border-t border-border-primary">
        <p className="text-xs text-text-muted uppercase tracking-wider px-1 pt-2 pb-1">Sessions</p>
        {sessions.length === 0 ? (
          <p className="text-xs text-text-muted px-2 py-3 text-center">No sessions yet</p>
        ) : (
          sessions.map(s => (
            <div key={s.id} className="relative group">
              {editingId === s.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                  className="w-full px-2 py-1.5 bg-bg-primary border border-accent rounded text-sm text-text-primary focus:outline-none"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => selectSession(s.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors truncate"
                >
                  <span className="truncate">{s.name}</span>
                  <span
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary text-base leading-none px-1"
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === s.id ? null : s.id); }}
                  >
                    ⋮
                  </span>
                </button>
              )}
              {menuOpenId === s.id && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-bg-secondary border border-border-primary rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={() => startRename(s.id, s.name)}
                    className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-bg-tertiary transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-border-primary">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Graph Stats</h4>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-text-muted text-xs">Nodes</p>
            <p className="text-text-primary font-semibold">{nodeCount}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs">Edges</p>
            <p className="text-text-primary font-semibold">{edgeCount}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
