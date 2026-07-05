let cachedBaseUrl: string | null = null;

export const getBaseUrl = async () => {
  if (cachedBaseUrl) return cachedBaseUrl;
  try {
    const res = await fetch('/api/port');
    const data = await res.json();
    cachedBaseUrl = `http://localhost:${data.port}`;
    return cachedBaseUrl;
  } catch {
    cachedBaseUrl = 'http://localhost:8000';
    return cachedBaseUrl;
  }
};

export const clearBaseUrlCache = () => { cachedBaseUrl = null; };

export const api = {
  ingestText: async (text: string) => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/ingest/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Failed to ingest text: ${await res.text()}`);
    return res.json();
  },
  ingestFile: async (file: File) => {
    const baseUrl = await getBaseUrl();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${baseUrl}/ingest/file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error(`Failed to ingest file: ${await res.text()}`);
    return res.json();
  },
  getGraph: async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/graph/visualize`);
    if (!res.ok) throw new Error(`Failed to get graph: ${await res.text()}`);
    return res.json();
  },
  generateTitle: async (text: string) => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { title: text.slice(0, 35) + (text.length > 35 ? '...' : '') };
    return res.json();
  },
  reset: async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/reset`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to reset: ${await res.text()}`);
    return res.json();
  },
  health: async () => {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/health`);
    return res.json();
  },
  getSessions: async () => {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
  },
  getSession: async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`);
    if (!res.ok) return null;
    return res.json();
  },
  saveSession: async (id: string, name: string, messages: any[]) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, messages }),
    });
    if (!res.ok) throw new Error('Failed to save session');
    return res.json();
  },
  deleteSessionApi: async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
  },
};
