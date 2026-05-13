'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';

interface StoreItem {
  id: number;
  name: string;
  description: string | null;
  cost: number;
  type: string;
  value: number;
}

interface Transaction {
  id: number;
  amount: number;
  type: 'earn' | 'spend';
  source: string;
  description: string | null;
  created_at: string;
}

export default function BonusPage() {
  const t = useTranslations('flux');
  const router = useRouter();
  const [token, setToken] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Gift state
  const [giftUsername, setGiftUsername] = useState('');
  const [giftAmount, setGiftAmount] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [giftError, setGiftError] = useState('');
  const [giftSuccess, setGiftSuccess] = useState('');
  const [gifting, setGifting] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token') ?? '';
    setToken(t);
    if (!t) { router.push('/login'); return; }

    Promise.all([
      api.get<{ balance: number; transactions: Transaction[] }>('/api/users/me/flux', t)
        .then(d => { setBalance(d.balance); setTransactions(d.transactions); }),
      api.get<{ items: StoreItem[] }>('/api/flux/store', t)
        .then(d => setItems(d.items)),
    ]).catch(() => {}).finally(() => setLoadingData(false));
  }, [router]);

  async function purchase(item: StoreItem) {
    setError('');
    setSuccess('');
    setPurchasing(true);
    try {
      const res = await api.post<{ balance: number }>(`/api/flux/purchase/${item.id}`, {}, token);
      setBalance(res.balance);
      setConfirming(null);
      setSuccess(t('purchase_success', { name: item.name }));
      // Refresh transaction list
      const d = await api.get<{ balance: number; transactions: Transaction[] }>('/api/users/me/flux', token);
      setTransactions(d.transactions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('purchase_error'));
    } finally {
      setPurchasing(false);
    }
  }

  async function handleGift(e: React.FormEvent) {
    e.preventDefault();
    setGiftError('');
    setGiftSuccess('');
    const amount = parseInt(giftAmount, 10);
    if (!amount || amount < 1) { setGiftError('Enter a valid amount'); return; }
    setGifting(true);
    try {
      await api.post('/api/flux/gift', { username: giftUsername, amount, note: giftNote || undefined }, token);
      setBalance(prev => prev !== null ? prev - amount : prev);
      setGiftSuccess(`Sent ${amount} FLX to ${giftUsername}`);
      setGiftUsername(''); setGiftAmount(''); setGiftNote('');
      const d = await api.get<{ balance: number; transactions: Transaction[] }>('/api/users/me/flux', token);
      setBalance(d.balance); setTransactions(d.transactions);
    } catch (err) {
      setGiftError(err instanceof ApiError ? err.message : 'Failed to send gift');
    } finally {
      setGifting(false);
    }
  }

  const btnCls = 'rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
  const inputCls = 'w-full rounded border border-current/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-current/30';

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-8">
      {/* Balance */}
      <div className="rounded-lg border border-current/10 p-6 text-center">
        <p className="text-xs uppercase tracking-widest opacity-60 mb-1">{t('balance')}</p>
        {loadingData ? (
          <div className="flex justify-center mt-2"><Skeleton height="h-10" width="w-40" /></div>
        ) : (
          <p className="text-4xl font-bold">
            {balance !== null ? Number(balance).toFixed(2) : '0.00'} <span className="text-xl opacity-50">FLX</span>
          </p>
        )}
      </div>

      {success && <p className="text-sm text-green-500">{success}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Store */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('store')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loadingData && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-current/10 p-4 space-y-3">
              <Skeleton height="h-4" width="w-32" />
              <Skeleton height="h-3" width="w-full" />
              <div className="flex justify-between items-center pt-1">
                <Skeleton height="h-4" width="w-16" />
                <Skeleton height="h-8" width="w-20" />
              </div>
            </div>
          ))}
          {!loadingData && items.length === 0 && (
            <div className="col-span-2">
              <EmptyState icon="🛒" title={t('store')} description="No items available in the store yet." />
            </div>
          )}
          {items.map(item => (
            <div key={item.id} className="rounded-lg border border-current/10 p-4 space-y-3">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                {item.description && <p className="text-sm opacity-60 mt-1">{item.description}</p>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-accent)]">{item.cost} FLX</span>
                <button
                  onClick={() => { setConfirming(item); setError(''); setSuccess(''); }}
                  disabled={balance !== null && balance < item.cost}
                  className={btnCls}
                >
                  {t('buy')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg border border-current/20 bg-[var(--color-bg)] p-6 space-y-4 max-w-sm w-full">
            <h3 className="font-semibold">{t('confirm_title')}</h3>
            <p className="text-sm opacity-70">{t('confirm_body', { name: confirming.name, cost: confirming.cost })}</p>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setConfirming(null)} className="flex-1 rounded border border-current/20 px-4 py-2 text-sm hover:border-current/40">
                {t('cancel')}
              </button>
              <button onClick={() => purchase(confirming)} disabled={purchasing} className={`flex-1 ${btnCls}`}>
                {purchasing ? t('purchasing') : t('confirm_buy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gift FLX */}
      <div className="rounded-lg border border-current/10 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Gift FLX</h2>
        <form onSubmit={handleGift} className="space-y-3">
          <input type="text" value={giftUsername} onChange={e => setGiftUsername(e.target.value)}
            placeholder="Username" required className={inputCls} />
          <input type="number" value={giftAmount} onChange={e => setGiftAmount(e.target.value)}
            placeholder="Amount (FLX)" required min={1} className={inputCls} />
          <input type="text" value={giftNote} onChange={e => setGiftNote(e.target.value)}
            placeholder="Note (optional)" maxLength={200} className={inputCls} />
          {giftError && <p className="text-sm text-red-500">{giftError}</p>}
          {giftSuccess && <p className="text-sm text-green-500">{giftSuccess}</p>}
          <button type="submit" disabled={gifting} className={btnCls}>
            {gifting ? 'Sending…' : 'Send Gift'}
          </button>
        </form>
      </div>

      {/* Transaction history */}
      {!loadingData && transactions.length === 0 && (
        <EmptyState icon="📋" title={t('history')} description="Your FLX transaction history will appear here." action={{ label: 'Browse torrents', href: '/browse' }} />
      )}
      {(loadingData || transactions.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('history')}</h2>
          <div className="space-y-1">
            {loadingData && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-current/5">
                <Skeleton height="h-3" width="w-40" />
                <Skeleton height="h-3" width="w-20" />
              </div>
            ))}
            {transactions.map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-sm py-2 border-b border-current/5">
                <div>
                  <span className="capitalize">{tx.source}</span>
                  {tx.description && <span className="opacity-50 ml-2 text-xs">{tx.description}</span>}
                </div>
                <span className={tx.type === 'earn' ? 'text-green-500' : 'text-red-400'}>
                  {tx.type === 'earn' ? '+' : '-'}{tx.amount} FLX
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
