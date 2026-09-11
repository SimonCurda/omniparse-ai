'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail, Plus, Trash2, Loader2, RefreshCw, Ban, CheckCircle2, Clock,
  AlertCircle, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface EmailInbox {
  id: string;
  label: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  username: string;
  scanMode: string;
  trustedSenders: string[] | null;
  active: boolean;
  lastSeenUID: number;
  lastScannedAt: string | null;
  lastScanError: string | null;
  createdAt: string;
}

interface BlocklistEntry {
  id: string;
  address: string;
  reason: string | null;
  createdAt: string;
}

const PROVIDER_PRESETS: Record<string, { host: string; port: number; docs: string }> = {
  gmail: { host: 'imap.gmail.com', port: 993, docs: 'https://support.google.com/accounts/answer/185833' },
  outlook: { host: 'outlook.office365.com', port: 993, docs: 'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-8361e398-8774-4e9b-b0c5-6ccae4d2b994' },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, docs: 'https://help.yahoo.com/kb/SLN15241.html' },
  icloud: { host: 'imap.mail.me.com', port: 993, docs: 'https://support.apple.com/en-us/HT202304' },
  zoho: { host: 'imap.zoho.com', port: 993, docs: 'https://www.zoho.com/mail/help/imap-access.html' },
  other: { host: '', port: 993, docs: '' },
};

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function EmailInboxSettings() {
  const [inboxes, setInboxes] = useState<EmailInbox[]>([]);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);

  // Add form state
  const [provider, setProvider] = useState('gmail');
  const [label, setLabel] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState(993);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [scanMode, setScanMode] = useState('manual');

  const loadInboxes = useCallback(async () => {
    const token = localStorage.getItem('op_token');
    if (!token) return;
    setLoading(true);
    try {
      const [inboxRes, blockRes] = await Promise.all([
        fetch('/api/email-inboxes', { headers: { Authorization: 'Bearer ' + token } }),
        fetch('/api/email-blocklist', { headers: { Authorization: 'Bearer ' + token } }),
      ]);
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setInboxes(data.inboxes || []);
      }
      if (blockRes.ok) {
        setBlocklist(await blockRes.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInboxes();
  }, [loadInboxes]);

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const preset = PROVIDER_PRESETS[value];
    if (preset) {
      setImapHost(preset.host);
      setImapPort(preset.port);
    }
  };

  const handleTest = async () => {
    if (!imapHost || !username || !password) {
      toast.error('Fill in host, username, and password first');
      return;
    }
    setTesting(true);
    try {
      const token = localStorage.getItem('op_token');
      const res = await fetch('/api/email-inboxes', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: label || emailAddress || 'Test',
          emailAddress,
          imapHost,
          imapPort: Number(imapPort),
          username,
          password,
          scanMode,
          testOnly: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Connection successful!');
      } else {
        toast.error(data.error || 'Connection failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!label || !emailAddress || !imapHost || !username || !password) {
      toast.error('Fill in all required fields');
      return;
    }
    setTesting(true);
    try {
      const token = localStorage.getItem('op_token');
      const res = await fetch('/api/email-inboxes', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          emailAddress,
          imapHost,
          imapPort: Number(imapPort),
          username,
          password,
          scanMode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Inbox added');
        setShowAddForm(false);
        setLabel(''); setEmailAddress(''); setUsername(''); setPassword('');
        loadInboxes();
      } else {
        toast.error(data.error || 'Failed to add inbox');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this inbox? Pending reviews from this inbox will also be deleted.')) return;
    const token = localStorage.getItem('op_token');
    try {
      const res = await fetch(`/api/email-inboxes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        toast.success('Inbox removed');
        loadInboxes();
      } else {
        toast.error('Failed to remove');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleScan = async (id: string) => {
    setScanning(id);
    const token = localStorage.getItem('op_token');
    try {
      const res = await fetch(`/api/email-inboxes/${id}/scan`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      if (res.ok) {
        const r = data;
        let msg = `Scanned: ${r.scanned} | Pending: ${r.pending} | Skipped: ${r.skipped}`;
        if (r.blocked > 0) msg += ` | Blocked: ${r.blocked}`;
        if (r.remaining > 0) msg += ` | ${r.remaining} remaining`;
        if (r.paused === 'pending_full') msg = `Pending queue full — clear pending items before scanning more`;
        if (r.paused === 'time_limit') msg = `Time limit reached — click Scan again to continue`;
        if (r.error) msg = `Error: ${r.error}`;
        toast.success(msg);
        loadInboxes();
      } else {
        toast.error(data.error || 'Scan failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setScanning(null);
    }
  };

  const handleToggleActive = async (inbox: EmailInbox) => {
    const token = localStorage.getItem('op_token');
    try {
      const res = await fetch('/api/email-inboxes', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inbox.id, active: !inbox.active }),
      });
      if (res.ok) {
        loadInboxes();
      }
    } catch {
      // silent
    }
  };

  const handleRemoveBlock = async (id: string) => {
    const token = localStorage.getItem('op_token');
    await fetch(`/api/email-blocklist?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    setBlocklist(blocklist.filter((b) => b.id !== id));
  };

  return (
    <>
      {/* Email Inboxes Card */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-500" />
            Email Inboxes
          </CardTitle>
          <CardDescription>
            Connect your inbox to automatically import invoices via IMAP. Every email goes to Pending Review first — nothing auto-imports to your Invoices list until you approve it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inboxes.length === 0 ? (
            <div className="text-center py-6 rounded-lg border border-dashed">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No email inboxes connected yet.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowAddForm(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Inbox
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {inboxes.map((inbox) => (
                  <div key={inbox.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{inbox.label}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {inbox.scanMode === 'trusted' ? 'Trusted senders' : 'Manual approval'}
                          </Badge>
                          {!inbox.active && (
                            <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                              Paused
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{inbox.emailAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {inbox.imapHost}:{inbox.imapPort} · Last scanned: {fmtTime(inbox.lastScannedAt)}
                        </p>
                        {inbox.lastScanError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {inbox.lastScanError.slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleScan(inbox.id)}
                          disabled={scanning === inbox.id || !inbox.active}
                          className="h-7 text-xs"
                        >
                          {scanning === inbox.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Scan Now
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(inbox.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Switch
                        checked={inbox.active}
                        onCheckedChange={() => handleToggleActive(inbox)}
                        className="scale-75"
                      />
                      <span className="text-xs text-muted-foreground">
                        {inbox.active ? 'Active (included in scan loop)' : 'Paused'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-4 w-4 mr-1" /> Add Another Inbox
              </Button>
            </>
          )}

          {/* Add Inbox Form */}
          {showAddForm && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold">Connect a new inbox</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Provider</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gmail">Gmail</SelectItem>
                      <SelectItem value="outlook">Outlook / Office 365</SelectItem>
                      <SelectItem value="yahoo">Yahoo</SelectItem>
                      <SelectItem value="icloud">iCloud</SelectItem>
                      <SelectItem value="zoho">Zoho</SelectItem>
                      <SelectItem value="other">Other (custom)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label (your nickname)</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Work invoices" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email Address</Label>
                  <Input value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} placeholder="you@company.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IMAP Username (usually email)</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@company.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IMAP Host</Label>
                  <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.gmail.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IMAP Port</Label>
                  <Input type="number" value={imapPort} onChange={(e) => setImapPort(Number(e.target.value))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">App Password (NOT your email password)</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="App-specific password" className="h-9 text-sm" />
                  {provider !== 'other' && PROVIDER_PRESETS[provider]?.docs && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Need help? <a href={PROVIDER_PRESETS[provider].docs} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">How to get an app password →</a>
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Scan Mode</Label>
                  <Select value={scanMode} onValueChange={setScanMode}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual approval (safest — every email goes to Pending)</SelectItem>
                      <SelectItem value="trusted">Trusted senders auto-import (others go to Pending)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Test Connection
                </Button>
                <Button size="sm" onClick={handleSave} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Save Inbox
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Auto-scan setup info */}
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Want automatic scanning?</p>
            <p>
              Set up a free cron trigger at{' '}
              <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">cron-job.org</a>
              {' '}pointing at:
            </p>
            <code className="block mt-1 p-2 bg-muted rounded text-[10px] break-all">
              {typeof window !== 'undefined' ? window.location.origin : 'https://your-app.vercel.app'}/api/email-inboxes/auto-scan?key=YOUR_CRON_SECRET
            </code>
            <p className="mt-2">Set <code className="bg-muted px-1 rounded">CRON_SECRET</code> in your Vercel env vars. Schedule every 10 minutes.</p>
          </div>
        </CardContent>
      </Card>

      {/* Blocklist Card */}
      {blocklist.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Blocked Senders
            </CardTitle>
            <CardDescription>
              Emails from these senders are auto-skipped during scanning. {blocklist.length} blocked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {blocklist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.address}</p>
                    {entry.reason && <p className="text-xs text-muted-foreground truncate">{entry.reason}</p>}
                    <p className="text-[10px] text-muted-foreground">Blocked {fmtTime(entry.createdAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveBlock(entry.id)}
                    className="h-7 text-xs"
                  >
                    Unblock
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
