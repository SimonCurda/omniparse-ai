'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Send, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import type { Artifact, ChatMessage } from '@/stores/app-store';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PIE_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#ef4444', '#71717a', '#06b6d4', '#f97316', '#8b5cf6'];

function getToken(): string | null {
  return localStorage.getItem('op_token');
}

/* Artifact Renderers */

function ArtifactTable({ data }: { data: Record<string, unknown> }) {
  const columns = (data.columns as string[]) || [];
  const rows = (data.rows as Record<string, unknown>[]) || [];
  return (
    <div className="mt-2 rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((c) => <th key={c} className="text-left px-3 py-2 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((c) => <td key={c} className="px-3 py-2">{String(row[c] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ArtifactBarChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const xKey = (data.xKey as string) || 'name';
  const yKeys = (data.yKeys as string[]) || ['value'];
  const colors = (data.colors as string[]) || ['#f59e0b'];
  return (
    <div className="mt-2 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i] || colors[0]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactLineChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const xKey = (data.xKey as string) || 'name';
  const yKeys = (data.yKeys as string[]) || ['value'];
  const colors = (data.colors as string[]) || ['#f59e0b'];
  return (
    <div className="mt-2 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
          {yKeys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={colors[i] || colors[0]} fill={colors[i] || colors[0]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactPieChart({ data }: { data: Record<string, unknown> }) {
  const chartData = (data.data as Array<Record<string, unknown>>) || [];
  const nameKey = (data.nameKey as string) || 'name';
  const valueKey = (data.valueKey as string) || 'value';
  const colors = (data.colors as string[]) || PIE_COLORS;
  return (
    <div className="mt-2 h-64 flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey={valueKey} nameKey={nameKey} label={({ name, percent }) => name + ' ' + (percent * 100).toFixed(0) + '%'} labelLine={false}>
            {chartData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ArtifactSummary({ data }: { data: Record<string, unknown> }) {
  const metrics = (data.metrics as Array<{ label: string; value: string; description?: string }>) || [];
  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      {metrics.map((m, i) => (
        <div key={i} className="bg-background rounded-lg p-3 border border-border/50">
          <div className="text-xs text-muted-foreground">{m.label}</div>
          <div className="text-lg font-bold mt-1">{m.value}</div>
          {m.description && <div className="text-xs text-muted-foreground mt-1">{m.description}</div>}
        </div>
      ))}
    </div>
  );
}

function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-amber-500/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {artifact.title}
          <Badge variant="outline" className="text-xs">{artifact.type}</Badge>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {artifact.type === 'table' && <ArtifactTable data={artifact.data} />}
          {artifact.type === 'chart-bar' && <ArtifactBarChart data={artifact.data} />}
          {artifact.type === 'chart-line' && <ArtifactLineChart data={artifact.data} />}
          {artifact.type === 'chart-pie' && <ArtifactPieChart data={artifact.data} />}
          {artifact.type === 'summary' && <ArtifactSummary data={artifact.data} />}
        </div>
      )}
    </div>
  );
}

/* Chat Tab */

export function ChatTab() {
  const { chatHistory, addChatMessage, clearChat, chatLoading, setChatLoading } = useAppStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight, behavior: 'smooth' });
  }, [chatHistory]);

  const sendMessage = async () => {
    if (!input.trim() || chatLoading) return;
    const msg = input.trim();
    setInput('');
    setError('');
    addChatMessage({ role: 'user', content: msg });
    setChatLoading(true);

    const token = getToken();
    if (!token) {
      setError('Session expired. Please sign in again.');
      setChatLoading(false);
      addChatMessage({ role: 'assistant', content: 'Your session has expired. Please sign in again to continue.' });
      return;
    }

    try {
      const history: Array<{ role: string; content: string }> = chatHistory.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ message: msg, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'AI request failed');
        addChatMessage({ role: 'assistant', content: 'Sorry, something went wrong: ' + (data.error || 'Unknown error') });
      } else {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: data.reply || 'No response.',
          artifact: data.artifact || undefined,
        };
        addChatMessage(assistantMsg);
      }
    } catch {
      setError('Network error. Check your connection.');
      addChatMessage({ role: 'assistant', content: 'Network error. Please check your connection and try again.' });
    } finally {
      setChatLoading(false);
    }
  };

  const suggestions = [
    'Give me a summary',
    'Show vendor breakdown table',
    'Create a spending chart',
    'Show duplicate invoices',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AI Chat</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Ask about your invoices, request tables and charts.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearChat} disabled={chatHistory.length === 0}>
          <RefreshCw className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2" role="alert" aria-live="assertive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="flex-1 flex flex-col border-border/50 overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Bot className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">AI Invoice Assistant</p>
              <p className="text-sm mt-1 max-w-sm">Ask questions about your invoices. Request tables, charts, or summaries and the AI will generate interactive artifacts.</p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {suggestions.map((q) => (
                  <Button key={q} variant="outline" size="sm" className="text-xs" onClick={() => setInput(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={"flex gap-3 " + (msg.role === 'user' ? 'justify-end' : '')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-4 w-4 text-amber-500" />
                </div>
              )}
              <div className="max-w-[80%]">
                <div className={"rounded-2xl px-4 py-2.5 text-sm leading-relaxed " + (msg.role === 'user' ? 'bg-amber-500 text-white rounded-br-md' : 'bg-muted rounded-bl-md')}>
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-line">{msg.content}</span>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-foreground/5 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-amber-500/40 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:border-border/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.artifact && <ArtifactRenderer artifact={msg.artifact} />}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-amber-500" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <Input placeholder="Ask about your invoices..." value={input} onChange={(e) => setInput(e.target.value)} disabled={chatLoading} className="flex-1" />
            <Button type="submit" size="icon" disabled={!input.trim() || chatLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
