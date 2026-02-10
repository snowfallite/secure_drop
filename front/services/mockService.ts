import { User, ChatSession, Message, MessageType } from '../types';
import { MOCK_USERS, INITIAL_BOT_USER } from '../constants';

// Simulating local storage persistence
const STORAGE_KEY_CHATS = 'secure_drop_chats';
const STORAGE_KEY_USER = 'secure_drop_user';

export class MockService {
  
  static async generateTOTP(username: string): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    // Deterministic mock TOTP for demo purposes (usually would be random)
    return "123456";
  }

  static async verifyTOTP(username: string, code: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 600));
    return code === "123456";
  }

  static getCurrentUser(): User | null {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    return stored ? JSON.parse(stored) : null;
  }

  static saveUser(user: User) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }

  static getChats(): ChatSession[] {
    const stored = localStorage.getItem(STORAGE_KEY_CHATS);
    if (stored) return JSON.parse(stored);
    
    // Return initial mock chat if empty
    return [{
      id: 'welcome-chat',
      participants: [INITIAL_BOT_USER],
      messages: [
        {
          id: 'msg_1',
          senderId: INITIAL_BOT_USER.id,
          content: 'Welcome to Secure Drop. Messages are end-to-end simulated.',
          type: MessageType.TEXT,
          timestamp: Date.now() - 100000
        }
      ],
      unreadCount: 1,
      lastMessage: {
        id: 'msg_1',
        senderId: INITIAL_BOT_USER.id,
        content: 'Welcome to Secure Drop.',
        type: MessageType.TEXT,
        timestamp: Date.now() - 100000
      }
    }];
  }

  static saveChats(chats: ChatSession[]) {
    localStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats));
  }

  static createChat(currentUser: User, targetUsername: string): ChatSession {
    // Check if mock user exists
    const target = MOCK_USERS.find(u => u.username === targetUsername) || {
      id: `user_${Date.now()}`,
      username: targetUsername,
      avatarUrl: `https://picsum.photos/seed/${targetUsername}/200/200`
    };

    return {
      id: `chat_${Date.now()}`,
      participants: [target],
      messages: [],
      unreadCount: 0
    };
  }
}