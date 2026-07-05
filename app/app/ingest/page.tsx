'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function IngestPage() {
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);

  const showStatus = (msg: string, type: 'success' | 'error') => {
    setStatus(msg);
    setStatusType(type);
    setTimeout(() => { setStatus(null); setStatusType(null); }, 4000);
  };

  const ingestText = async () => {
    const text = textInput.trim();
    if (!text || ingesting) return;
    setIngesting(true);
    setStatus(null);
    try {
      const res = await api.ingestText(text);
      setTextInput('');
      showStatus(res.message || 'Text ingested successfully.', 'success');
    } catch (e: any) {
      showStatus(`Ingest failed: ${e.message}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const uploadFile = async () => {
    if (!file || ingesting) return;
    setIngesting(true);
    setStatus(null);
    try {
      const res = await api.ingestFile(file);
      setFile(null);
      showStatus(res.message || `File "${file.name}" uploaded.`, 'success');
    } catch (e: any) {
      showStatus(`Upload failed: ${e.message}`, 'error');
    } finally {
      setIngesting(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm('This will permanently delete ALL knowledge graph data. Are you sure?')) return;
    setResetting(true);
    setStatus(null);
    try {
      await api.reset();
      showStatus('Knowledge graph wiped clean. All local state cleared.', 'success');
    } catch (e: any) {
      showStatus(`Reset failed: ${e.message}`, 'error');
    } finally {
      setResetting(false);
    }
  };

  const isProcessing = ingesting || resetting;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Text Ingestion */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-1">Ingest Text</h2>
          <p className="text-sm text-text-muted mb-4">Paste or type content to add to the knowledge graph.</p>
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Paste your text here..."
            className="w-full h-32 bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none transition-colors"
            disabled={isProcessing}
          />
          <button
            onClick={ingestText}
            disabled={isProcessing || !textInput.trim()}
            className="mt-3 px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            {ingesting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : 'Ingest Text'}
          </button>
          {ingesting && <p className="text-xs text-text-muted mt-2">Extracting graph nodes... this may take a moment for larger texts.</p>}
        </section>

        {/* File Upload */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-1">Ingest File</h2>
          <p className="text-sm text-text-muted mb-4">Upload .txt, .pdf, .docx, or .md files.</p>
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center gap-3 px-4 py-3 bg-bg-tertiary border border-border-primary border-dashed rounded-xl cursor-pointer hover:border-accent/50 transition-colors">
              <input type="file" accept=".txt,.pdf,.doc,.docx,.md" onChange={handleFileChange} className="sr-only" disabled={isProcessing} />
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-sm text-text-primary">{file ? file.name : 'Choose a file'}</p>
                <p className="text-xs text-text-muted">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'or drag and drop'}</p>
              </div>
            </label>
            {file && (
              <button
                onClick={uploadFile}
                disabled={isProcessing}
                className="px-5 py-3 bg-accent-green hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors"
              >
                {ingesting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : 'Upload'}
              </button>
            )}
            {ingesting && <p className="text-xs text-text-muted mt-2">Extracting graph nodes... this may take a moment for larger files.</p>}
          </div>
        </section>

        {/* Status Messages */}
        {status && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium ${
            statusType === 'success' ? 'bg-accent-green/10 text-accent-green border border-accent-green/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {status}
          </div>
        )}

        {/* Danger Zone */}
        <section className="border border-red-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">⚠️</span>
            <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
          </div>
          <p className="text-sm text-text-muted">Irreversibly wipe the entire knowledge graph and all ingested data.</p>
          <button
            onClick={resetAll}
            disabled={resetting}
            className="px-5 py-2.5 bg-danger hover:bg-danger-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            {resetting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Wiping...
              </span>
            ) : 'Delete All Knowledge Graph Data'}
          </button>
        </section>
      </div>
    </div>
  );
}
