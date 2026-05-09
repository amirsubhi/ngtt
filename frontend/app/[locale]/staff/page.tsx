'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface DashSummary {
  pending_torrents: number; open_tickets: number; active_hnr: number;
  pending_reports: number; new_users_today: number; online_users: number;
}

export default function StaffDashboard() {
  const [data, setData] = useState<DashSummary | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token') ?? '';
    api.get<DashSummary>('/api/staff/dashboard', token).then(setData).catch(() => {});
  }, []);

  const cards = data ? [
    { label: 'Pending Torrents', value: data.pending_torrents, href: '/staff/torrents', warn: data.pending_torrents > 0 },
    { label: 'Open Tickets',     value: data.open_tickets,     href: '/staff/helpdesk', warn: data.open_tickets > 0 },
    { label: 'Active H&Rs',      value: data.active_hnr,       href: '/staff/hnr',     warn: data.active_hnr > 0 },
    { label: 'Pending Reports',  value: data.pending_reports,  href: '/staff/reports', warn: data.pending_reports > 0 },
    { label: 'New Users Today',  value: data.new_users_today,  href: '/staff/users',   warn: false },
    { label: 'Online Now',       value: data.online_users,     href: '/staff/users',   warn: false },
  ] : [];

  const staffLinks = [
    { href: '/staff/torrents', label: 'Torrent Queue' },
    { href: '/staff/users',    label: 'User Management' },
    { href: '/staff/helpdesk', label: 'Helpdesk' },
    { href: '/staff/reports',  label: 'Reports' },
    { href: '/staff/dmca',     label: 'DMCA' },
    { href: '/staff/hnr',      label: 'H&R Management' },
    { href: '/staff/logs',     label: 'Audit Log' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">
      <h1 className="text-2xl font-bold">Staff Dashboard</h1>

      {!data ? (
        <p className="opacity-40">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cards.map(c => (
            <Link key={c.label} href={c.href}
              className="border border-current/10 rounded-lg p-4 hover:bg-current/5 transition-colors space-y-1">
              <div className={`text-3xl font-bold ${c.warn ? 'text-[var(--color-accent)]' : ''}`}>{c.value}</div>
              <div className="text-sm opacity-60">{c.label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {staffLinks.map(l => (
          <Link key={l.href} href={l.href}
            className="border border-current/10 rounded px-3 py-2 text-sm text-center hover:bg-current/5">
            {l.label}
          </Link>
        ))}
        <Link href="/admin/settings"
          className="border border-[var(--color-accent)]/30 rounded px-3 py-2 text-sm text-center hover:bg-current/5">
          Admin Settings
        </Link>
      </div>
    </div>
  );
}
