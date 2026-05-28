import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addDocument, queryDocuments, serverTimestamp, subscribeQuery, updateDocument } from '@/integrations/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { CirclePlus, EllipsisVertical, Loader2, MessageSquare, Paperclip, Phone, Send, Smile, Video } from 'lucide-react';

type UserRow = { id: string; name?: string | null; email?: string | null; role?: string | null };

type ConversationDoc = {
  id: string;
  participants?: string[] | null;
  title?: string | null;
  subtitle?: string | null;
  recipient_role?: string | null;
  last_sender_id?: string | null;
  last_message_text?: string | null;
  updatedAt?: unknown;
};

type MessageDoc = {
  id: string;
  conversation_id?: string | null;
  sender_id?: string | null;
  text?: string | null;
  created_at?: unknown;
};

function parseUnknownDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object') {
    if ('toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      const date = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if ('seconds' in value && typeof (value as { seconds?: unknown }).seconds === 'number') {
      const parsed = new Date(((value as { seconds: number }).seconds) * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

function formatTimeLabel(value: unknown, locale: string): string {
  const date = parseUnknownDate(value);
  if (!date) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

function getInitials(value?: string | null): string {
  const parts = (value || '').trim().split(/\s+/g).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p.slice(0, 1).toUpperCase()).join('');
  return initials || 'U';
}

function normalizeRole(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isCpcRole(role: string): boolean {
  return ['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer', 'cpc'].includes(role);
}

function inferConversationRole(conversation: ConversationDoc): 'company' | 'cpc' | 'other' {
  const fromRole = normalizeRole(conversation.recipient_role);
  if (fromRole === 'company' || fromRole === 'empresa') return 'company';
  if (['admin', 'manager', 'coordinator', 'mediator', 'lawyer', 'psychologist', 'trainer', 'cpc'].includes(fromRole)) return 'cpc';
  const subtitle = normalizeRole(conversation.subtitle);
  if (subtitle.includes('empresa')) return 'company';
  if (subtitle.includes('cpc') || subtitle.includes('equipa')) return 'cpc';
  return 'other';
}

export default function MigrantMessagesPage() {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const { toast } = useToast();

  const role = normalizeRole(profile?.role);
  const isMigrant = role === 'migrant' || role === 'migrante' || role.length === 0;
  const [filter, setFilter] = useState<'all' | 'cpc' | 'company'>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationDoc[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageDoc[]>([]);

  const [compose, setCompose] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user?.uid || !isMigrant) return;
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeQuery<ConversationDoc>({
      collectionName: 'conversations',
      filters: [{ field: 'participants', operator: 'array-contains', value: user.uid }],
      onNext: (docs) => {
        const sorted = [...docs].sort((a, b) => {
          const ams = parseUnknownDate(a.updatedAt)?.getTime() || 0;
          const bms = parseUnknownDate(b.updatedAt)?.getTime() || 0;
          return bms - ams;
        });
        setConversations(sorted);
        setLoading(false);
        setActiveConversationId((prev) => {
          if (prev && sorted.some((d) => d.id === prev)) return prev;
          return sorted[0]?.id ?? null;
        });
      },
      onError: () => {
        setError(t.messagesPage.errors.loadConversations);
        setLoading(false);
      },
    });
    return () => unsubscribe();
  }, [isMigrant, t.messagesPage.errors.loadConversations, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !isMigrant) return;
    if (!activeConversationId) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLoading(false);
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);

    const unsubscribe = subscribeQuery<MessageDoc>({
      collectionName: 'conversation_messages',
      filters: [{ field: 'conversation_id', operator: '==', value: activeConversationId }],
      orderByField: { field: 'created_at', direction: 'asc' },
      onNext: (docs) => {
        setMessages(docs);
        setMessagesLoading(false);
      },
      onError: () => {
        setMessagesError(t.messagesPage.errors.loadMessages);
        setMessagesLoading(false);
      },
    });
    return () => unsubscribe();
  }, [activeConversationId, isMigrant, t.messagesPage.errors.loadMessages, user?.uid]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, activeConversationId]);

  const activeConversation = useMemo(
    () => (activeConversationId ? conversations.find((c) => c.id === activeConversationId) ?? null : null),
    [activeConversationId, conversations]
  );
  const filteredConversations = useMemo(() => {
    if (filter === 'all') return conversations;
    return conversations.filter((c) => inferConversationRole(c) === filter);
  }, [conversations, filter]);

  async function send() {
    if (!user?.uid || !isMigrant) return;
    if (!activeConversationId) return;
    const text = compose.trim();
    if (!text) return;

    setCompose('');
    try {
      await addDocument('conversation_messages', {
        conversation_id: activeConversationId,
        sender_id: user.uid,
        text,
        created_at: serverTimestamp(),
      });
      await updateDocument('conversations', activeConversationId, {
        last_message_text: text,
        last_sender_id: user.uid,
        updatedAt: serverTimestamp(),
      });
    } catch {
      toast({ title: t.common.errorTitle, description: t.messagesPage.errors.sendMessage, variant: 'destructive' });
      setCompose(text);
    }
  }

  async function createConversation() {
    if (!user?.uid || !isMigrant) return;
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: t.common.validationTitle, description: t.messagesPage.validation.emailValid, variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const users = await queryDocuments<UserRow>('users', [{ field: 'email', operator: '==', value: email }], undefined, 1);
      const target = users[0];
      if (!target?.id) {
        toast({ title: t.common.notFoundTitle, description: t.messagesPage.validation.noUserWithEmail, variant: 'destructive' });
        return;
      }
      if (target.id === user.uid) {
        toast({ title: t.common.validationTitle, description: t.messagesPage.validation.emailDifferent, variant: 'destructive' });
        return;
      }
      const targetRole = normalizeRole(target.role);
      if (!isCpcRole(targetRole)) {
        toast({ title: t.common.validationTitle, description: t.messagesPage.validation.targetMustBeCpc, variant: 'destructive' });
        return;
      }

      const existing = await queryDocuments<ConversationDoc>(
        'conversations',
        [{ field: 'participants', operator: 'array-contains', value: user.uid }],
        undefined,
        100
      );
      const match = existing.find((c) => (c.participants || []).includes(target.id) && (c.participants || []).length === 2);
      if (match?.id) {
        setActiveConversationId(match.id);
        setNewEmail('');
        setNewOpen(false);
        return;
      }

      const id = await addDocument('conversations', {
        participants: [user.uid, target.id],
        created_by: user.uid,
        created_by_role: 'migrant',
        type: 'support_request',
        title: target.name || target.email || t.messagesPage.conversationFallbackTitle,
        subtitle: 'Equipa CPC',
        recipient_role: targetRole || null,
        last_message_text: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveConversationId(id);
      setNewEmail('');
      setNewOpen(false);
      toast({ title: t.messagesPage.toast.conversationCreatedTitle, description: t.messagesPage.toast.conversationCreatedDesc });
    } catch {
      toast({ title: t.common.errorTitle, description: t.messagesPage.errors.createConversation, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  if (!user?.uid) {
    return <div className="cpc-card p-8 text-center text-sm text-muted-foreground">{t.messagesPage.auth.signInToAccess}</div>;
  }

  if (!isMigrant) {
    return <div className="cpc-card p-8 text-center text-sm text-muted-foreground">{t.messagesPage.auth.noPermission}</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cpc-card p-8 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="cpc-card overflow-hidden">
        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] min-h-[640px]">
          <div className="p-6">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight">{t.messagesPage.title}</h1>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                {t.messagesPage.newAction}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-3">
              {t.messagesPage.hintPrefix}{' '}
              <span className="font-medium">{t.messagesPage.hintPathLabel}</span>.
            </p>

            <div className="flex items-center gap-2 mt-4">
              <button type="button" className={`px-3 py-1.5 rounded-full text-xs ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setFilter('all')}>Todas</button>
              <button type="button" className={`px-3 py-1.5 rounded-full text-xs ${filter === 'cpc' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setFilter('cpc')}>Equipa CPC</button>
              <button type="button" className={`px-3 py-1.5 rounded-full text-xs ${filter === 'company' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => setFilter('company')}>Empresas</button>
            </div>

            <div className="mt-6 space-y-2">
              {filteredConversations.length === 0 ? (
                <div className="cpc-card p-6 text-center text-sm text-muted-foreground">
                  {t.messagesPage.emptyConversations}
                </div>
              ) : (
                filteredConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId;
                  const title = conversation.title || t.messagesPage.conversationFallbackTitle;
                  const subtitle = conversation.subtitle || '';
                  const last = conversation.last_message_text || t.messagesPage.noMessagesPreview;
                  const isUnread = !!conversation.last_sender_id && conversation.last_sender_id !== user.uid;
                  const locale = language === 'pt' ? 'pt-PT' : language === 'en' ? 'en-GB' : 'es-ES';
                  const timeLabel = formatTimeLabel(conversation.updatedAt, locale) || '';
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full text-left rounded-2xl px-4 py-4 transition-colors ${
                        isActive ? 'bg-primary/5 border-l-4 border-primary' : 'hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground">{getInitials(title)}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold truncate">{title}</p>
                            {timeLabel ? <span className="text-xs text-muted-foreground shrink-0">{timeLabel}</span> : null}
                          </div>
                          {subtitle ? <p className="text-sm text-primary truncate mt-0.5">{subtitle}</p> : null}
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground truncate mt-1">{last}</p>
                            {isUnread ? <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 mt-1" /> : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l bg-muted/20">
            {!activeConversation ? (
              <div className="p-10 text-center text-sm text-muted-foreground">{t.messagesPage.selectConversation}</div>
            ) : (
              <>
                <div className="p-6 bg-background border-b">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-muted-foreground">{getInitials(activeConversation.title)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{activeConversation.title || t.messagesPage.conversationFallbackTitle}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {t.messagesPage.onlineNow}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label={t.messagesPage.aria.videoCall}
                      >
                        <Video className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label={t.messagesPage.aria.call}
                      >
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        type="button"
                        className="h-10 w-10 rounded-xl border bg-background hover:bg-muted flex items-center justify-center"
                        aria-label={t.messagesPage.aria.moreOptions}
                      >
                        <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 overflow-auto">
                  <div className="flex items-center justify-center">
                    <span className="text-xs font-semibold tracking-widest text-muted-foreground bg-background px-4 py-2 rounded-full border">{t.messagesPage.today}</span>
                  </div>

                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messagesError ? (
                    <div className="cpc-card p-6 text-center text-sm text-muted-foreground">{messagesError}</div>
                  ) : messages.length === 0 ? (
                    <div className="cpc-card p-6 text-center text-sm text-muted-foreground">{t.messagesPage.noMessagesInConversation}</div>
                  ) : (
                    messages.map((m) => {
                      const mine = (m.sender_id || '') === user.uid;
                      const text = m.text || '';
                      return (
                        <div key={m.id} className={`flex items-start gap-3 max-w-2xl ${mine ? 'ml-auto justify-end' : ''}`}>
                          {mine ? null : (
                            <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-muted-foreground">
                                {getInitials(activeConversation.title)}
                              </span>
                            </div>
                          )}
                          <div
                            className={`rounded-3xl px-6 py-4 text-sm leading-relaxed ${
                              mine ? 'bg-primary text-primary-foreground' : 'bg-background border'
                            }`}
                          >
                            {text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <div className="p-6 bg-background border-t">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="h-11 w-11 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center"
                      aria-label={t.messagesPage.aria.add}
                    >
                      <CirclePlus className="h-5 w-5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      className="h-11 w-11 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center"
                      aria-label={t.messagesPage.aria.emoji}
                    >
                      <Smile className="h-5 w-5 text-muted-foreground" />
                    </button>

                    <div className="relative flex-1">
                      <Input
                        placeholder={t.messagesPage.composePlaceholder}
                        className="h-12 rounded-full pl-12 pr-14 bg-muted/30 border-muted"
                        value={compose}
                        onChange={(e) => setCompose(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="button"
                          className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          aria-label={t.messagesPage.aria.send}
                          onClick={() => void send()}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={(open) => (creating ? null : setNewOpen(open))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.messagesPage.dialog.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.messagesPage.dialog.recipientEmailLabelSupport}</p>
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t.messagesPage.dialog.emailPlaceholder} />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setNewOpen(false)} disabled={creating}>{t.common.cancel}</Button>
              <Button onClick={() => void createConversation()} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                {t.common.create}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
