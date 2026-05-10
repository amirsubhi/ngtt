'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

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
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token') ?? '';
    setToken(t);
    if (!t) { router.push('/login'); return; }

    api.get<{ balance: number; transactions: Transaction[] }>('/api/users/me/flux', t)
      .then(d => { setBalance(d.balance); setTransactions(d.transactions); })
      .catch(() => {});

    api.get<{ items: StoreItem[] }>('/api/flux/store', t)
      .then(d => setItems(d.items))
      .catch(() => {});
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

  const btnCls = 'rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-8">
      {/* Balance */}
      <div className="rounded-lg border border-current/10 p-6 text-center">
        <p className="text-sm opacity-50 uppercase tracking-wide mb-1">{t('balance')}</p>
        <p className="text-4xl font-bold">
          {balance !== null ? Number(balance).toFixed(2) : '—'} <span className="text-xl opacity-50">FLX</span>
        </p>
      </div>

      {success && <p className="text-sm text-green-500">{success}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Store */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('store')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{t('history')}</h2>
          <div className="space-y-1">
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
