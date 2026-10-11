export type UserRole = 'owner' | 'admin' | 'member';

export interface AppUser {
  uid:         string;
  email:       string;
  displayName: string;
  photoURL:    string | null;
  phoneNumber?: string | null;
  createdAt:   number;
  lastSeen:    number;
  isOnline:    boolean;
}

export type MessageType   = 'text' | 'image' | 'file' | 'voice' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Attachment {
  id:           string;
  name:         string;
  url:          string;
  type:         string;
  size:         number;
  thumbnailUrl?: string;
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
  isOptimistic?: boolean;
}

export interface ChatParticipant {
  uid:         string;
  displayName: string;
  photoURL:    string | null;
  isOnline:    boolean;
  lastSeen:    number;
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
}

export interface MessagesState {
  messagesByChatId: Record<string, Message[]>;
  loadingByChatId:  Record<string, boolean>;
  errorByChatId:    Record<string, string | null>;
}

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
}

export interface UIState {
  sidebarOpen:   boolean;
  composerHeight: number;
  activePanel:   'chats' | 'settings' | 'profile';
}

export interface PresenceState {
  onlineUsers: Record<string, boolean>;
}

export interface UploadProgress {
  id:       string;
  fileName: string;
  progress: number;
  status:   'uploading' | 'complete' | 'error';
  url?:     string;
}

export interface FirebaseConfig {
  apiKey:            string;
  authDomain:        string;
  projectId:         string;
  storageBucket:     string;
  messagingSenderId: string;
  appId:             string;
  databaseURL:       string;
}
