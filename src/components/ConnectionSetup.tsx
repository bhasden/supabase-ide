import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database, Plus, Loader2, AlertCircle } from 'lucide-react';
import { deriveConnectionName } from '../lib/clients';

interface ConnectionSetupProps {
  onConnect: (name: string, url: string, apiKey: string) => void;
}

export default function ConnectionSetup({ onConnect }: ConnectionSetupProps) {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = () => {
    if (!name && url) {
      setName(deriveConnectionName(url));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !apiKey.trim()) return;

    setTesting(true);
    setError(null);

    const client = createClient(url.trim(), apiKey.trim());
    Promise.resolve(client.from('_test_connection_probe').select('*').limit(1))
      .then(() => {
        onConnect(name.trim() || deriveConnectionName(url), url.trim(), apiKey.trim());
      })
      .catch(() => {
        onConnect(name.trim() || deriveConnectionName(url), url.trim(), apiKey.trim());
      })
      .finally(() => setTesting(false));
  };

  const isValid = url.trim().startsWith('https://') && apiKey.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-5 ring-1 ring-slate-700">
            <Database size={28} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100 mb-1">Connect to Supabase</h1>
          <p className="text-sm text-slate-500">Add a database to start exploring</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Anon / Public Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="eyJhbGci..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Display name <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || testing}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium text-sm rounded-lg px-4 py-2.5 transition-colors"
          >
            {testing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {testing ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
