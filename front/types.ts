export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  AUDIO = 'AUDIO',
  EMOJI = 'EMOJI'
}

export interface User {
  id: string;
  username: string;
  public_key?: string;
  avatar_url?: string;
  is_verified?: boolean;
  is_online?: boolean;
  last_seen?: string;
  encrypted_private_key?: string;
  key_salt?: string;
}

export interface Message {
  id: string;
  chat_id?: string;
  sender_id: string;
  content: string;
  type: MessageType;
  created_at: string;
  read_at?: string | null;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  reply_to_id?: string;
  reply_to?: {
    id: string;
    content: string;
    sender_id: string;
    type: MessageType;
  };
}

export interface LastMessage {
  id: string;
  content: string;
  type: string;
  sender_id: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  participants: User[];
  messages: Message[];
  last_message: LastMessage | null;
  created_at: string;
}