import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ClientErrorRow {
  id: string;
  source: string;
  message: string;
  page_path: string | null;
  created_at: string;
}

interface ReconRunRow {
  id: string;
  checked_count: number;
  recovered_count: number;
  still_stuck_count: number;
  created_at: string;
}

export const OpsHealthPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [syncedEpisodesCount, setSyncedEpisodesCount] = useState<number>(0);
  const [syncedSeriesCount, setSyncedSeriesCount] = useState<number>(0);
  const [recentErrors, setRecentErrors] = useState<ClientErrorRow[]>([]);
  const [recentRuns, setRecentRuns] = useState<ReconRunRow[]>([]);

  const loadSnapshot = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [epRes, serRes, errRes, runRes] = await Promise.all([
        supabase.from('catalogue_episodes').select('guid', { count: 'exact', head: true }),
        supabase.from('catalogue_series').select('id', { count: 'exact', head: true }),
        supabase
          .from('client_error_logs')
          .select('id, source, message, page_path, created_at')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('payment_reconciliation_runs')
          .select('id, checked_count, recovered_count, still_stuck_count, created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      setSyncedEpisodesCount(epRes.count || 0);
      setSyncedSeriesCount(serRes.count || 0);
      setRecentErrors((errRes.data as ClientErrorRow[]) || []);
      setRecentRuns((runRes.data as ReconRunRow[]) || []);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load ops telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const handleSyncBunny = async () => {
    setSyncing(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('bunny-webhook', {
        body: { action: 'sync_all' },
      });
      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || 'Catalogue sync failed.');
      }
      setStatusMessage(
        `Synced ${data.totalSynced} Bunny episodes into Postgres across ${data.pagesScanned} page(s). playback-access will now serve them DB-first!`,
      );
      await loadSnapshot();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to sync Bunny catalogue.');
    } finally {
      setSyncing(false);
    }
  };

  const handleReconcilePayments = async () => {
    setReconciling(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('ops-monitor', {
        body: { action: 'reconcile_payments' },
      });
      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || 'Payment reconciliation failed.');
      }
      setStatusMessage(
        `Payment reconciliation complete: checked ${data.checkedCount}, auto-recovered ${data.recoveredCount}, still stuck ${data.stillStuckCount}.`,
      );
      await loadSnapshot();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Payment reconciliation failed.');
    } finally {
      setReconciling(false);
    }
  };

  const handleHealthCheck = async () => {
    setCheckingHealth(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('ops-monitor', {
        body: { action: 'health_check' },
      });
      if (error) {
        throw new Error(data?.error || error.message || 'Health check failed.');
      }
      setStatusMessage(
        `Live Health Check: Catalogue HTTP ${data?.catalogueStatus} (${data?.catalogueMs}ms) · Client errors last hour: ${data?.recentErrorsLastHour ?? 0}.`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Health check failed.');
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Activity size={20} className="text-emerald-400" />
            <span>System Ops, Catalogue Sync &amp; Payment Reconciliation</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Backfill your Bunny library into Postgres, verify live uptime, recover missed payment webhooks, and inspect frontend crash logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSnapshot()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-200 transition cursor-pointer"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-200">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Postgres Catalogue Mirror</span>
            <Database size={16} className="text-sky-400" />
          </div>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-black text-white">{syncedEpisodesCount.toLocaleString()}</p>
              <p className="text-[11px] text-zinc-400">Synced Episodes</p>
            </div>
            <div>
              <p className="text-2xl font-black text-sky-400">{syncedSeriesCount.toLocaleString()}</p>
              <p className="text-[11px] text-zinc-400">Series</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSyncBunny()}
            disabled={syncing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-extrabold text-xs py-2.5 transition disabled:opacity-50 cursor-pointer"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            <span>{syncing ? 'Syncing Bunny Library...' : 'Sync Bunny Catalogue -> Postgres'}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Payment Reconciliation</span>
            <ShieldCheck size={16} className="text-amber-400" />
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Scans pending/submitted transactions (5m–24h old), verifies Paystack status live, and auto-activates missed passes.
          </p>
          <button
            type="button"
            onClick={() => void handleReconcilePayments()}
            disabled={reconciling}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs py-2.5 transition disabled:opacity-50 cursor-pointer"
          >
            {reconciling ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            <span>{reconciling ? 'Reconciling...' : 'Run Payment Reconciliation Now'}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Live Edge Health</span>
            <Activity size={16} className="text-emerald-400" />
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Tests <code className="text-emerald-300">/api/catalogue</code> CDN availability, Postgres connectivity, and client crash rate.
          </p>
          <button
            type="button"
            onClick={() => void handleHealthCheck()}
            disabled={checkingHealth}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs py-2.5 transition disabled:opacity-50 cursor-pointer"
          >
            {checkingHealth ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            <span>{checkingHealth ? 'Checking...' : 'Run Live Health Check'}</span>
          </button>
        </div>
      </div>

      {/* Recent Reconciliation Runs + Client Error Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-white">Recent Reconciliation Sweeps</h3>
          {loading ? (
            <p className="text-xs text-zinc-400">Loading...</p>
          ) : recentRuns.length === 0 ? (
            <p className="text-xs text-zinc-500">No reconciliation sweeps recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-300">Checked: <strong className="text-white">{run.checked_count}</strong></span>
                    <span className="text-emerald-400">Recovered: <strong>{run.recovered_count}</strong></span>
                    <span className={run.still_stuck_count > 0 ? 'text-amber-400' : 'text-zinc-400'}>
                      Stuck: <strong>{run.still_stuck_count}</strong>
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{new Date(run.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span>Recent Frontend Crash Logs</span>
          </h3>
          {loading ? (
            <p className="text-xs text-zinc-400">Loading...</p>
          ) : recentErrors.length === 0 ? (
            <p className="text-xs text-emerald-400">Zero client crashes recorded.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {recentErrors.map((err) => (
                <div key={err.id} className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-red-300">{err.source}</span>
                    <span className="text-[10px] text-zinc-500">{new Date(err.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-white break-words">{err.message}</p>
                  {err.page_path && <p className="text-[10px] text-zinc-400">Path: {err.page_path}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpsHealthPanel;
