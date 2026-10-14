export type UserRole = 'owner' | 'admin' | 'member';

export interface AppUser {
  uid:         string;
  /** Faqat joriy foydalanuvchida (boshqalarniki serverdan kelmaydi). */
  email?:      string;
  displayName: string;
  photoURL:    string | null;
  phoneNumber?: string | null;
  bio?:        string | null;
  createdAt:   number;
  lastSeen:    number;
  isOnline:    boolean;
}

export type MessageType   = 'text' | 'image' | 'file' | 'voice' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type AttachmentKind = 'image' | 'file' | 'voice';

export interface Attachment {
  id:         string;
  kind:       AttachmentKind;
  name:       string;
  url:        string;
  /** MIME turi. */
  type:       string;
  size:       number;
  durationMs: number | null;
}

export interface Message {
  id:          string;
  chatId:      string;
  senderId:    string;
  senderName:  string;
  senderPhoto: string | null;
  content:     string;
  type:        MessageType;
  status:      MessageStatus;
  attachment?: Attachment;
  createdAt:   number;
  updatedAt:   number;
  /** Tahrirlangan vaqt (ms); tahrirlanmagan bo'lsa null. */
  editedAt:    number | null;
  isOptimistic?: boolean;
}

export interface ChatParticipant {
  uid:         string;
  displayName: string;
  photoURL:    string | null;
  isOnline:    boolean;
  lastSeen:    number;
  /** Shu vaqtgacha (ms) yuborilgan xabarlarni o'qigan. */
  lastReadAt?: number | null;
  role?:       UserRole;
}

export type ChatType = 'direct' | 'group' | 'channel';

export interface Chat {
  id:                 string;
  name:               string;
  type:               ChatType;
  photoURL:           string | null;
  description?:       string;
  participants:       string[];
  admins?:            string[];
  ownerId?:           string;
  /** Joriy foydalanuvchining roli (kanalda `participantDetails` to'liq bo'lmasligi mumkin). */
  myRole:             UserRole;
  isPublic?:          boolean;
  memberCount?:       number;
  participantDetails: Record<string, ChatParticipant>;
  lastMessage: {
    content:   string;
    senderId:  string;
    createdAt: number;
  } | null;
  unreadCount:  number;
  createdAt:    number;
  updatedAt:    number;
  typingUsers:  Record<string, boolean>;
}

export interface AuthState {
  user:        AppUser | null;
  loading:     boolean;
  error:       string | null;
  initialized: boolean;
}

export interface ChatsState {
  chats:        Chat[];
  activeChatId: string | null;
  loading:      boolean;
  error:        string | null;
  /** WebSocket qayta ulanganda oshadi — ochiq chat tarixini qayta yuklash uchun. */
  syncEpoch:    number;
}

export interface MessagesState {
  messagesByChatId:     Record<string, Message[]>;
  loadingByChatId:      Record<string, boolean>;
  errorByChatId:        Record<string, string | null>;
  /** Eskiroq xabarlar uchun kursor; null — boshqa yo'q. */
  nextCursorByChatId:   Record<string, string | null>;
  loadingOlderByChatId: Record<string, boolean>;
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
}

export interface UIState {
  composerHeight: number;
  activePanel:   'chats' | 'settings' | 'profile';
}

export interface PresenceState {
  onlineUsers: Record<string, boolean>;
}
