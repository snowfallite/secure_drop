import axios from 'axios';
import { User, ChatSession, Message, MessageType } from '../types';

const api = axios.create({
    headers: { 'Content-Type': 'application/json' },
});

export const setAuthToken = (token: string) => {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAuthToken = () => {
    delete api.defaults.headers.common['Authorization'];
};

// Restore token on module load
const savedToken = localStorage.getItem('access_token');
if (savedToken) setAuthToken(savedToken);

api.interceptors.response.use(
    (r) => r,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('access_token');
            clearAuthToken();
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export const ApiService = {
    auth: {
        register: async (username: string, publicKey: string) => {
            const r = await api.post('/auth/register', { username, public_key: publicKey });
            return r.data;
        },
        confirmRegistration: async (username: string, publicKey: string, totpSecret: string, totpCode: string) => {
            const r = await api.post('/auth/confirm-registration', {
                username,
                public_key: publicKey,
                totp_secret: totpSecret,
                totp_code: totpCode
            });
            return r.data;
        },
        login: async (username: string, code: string) => {
            const r = await api.post('/auth/login', { username, totp_code: code });
            return r.data;
        },
        me: async () => {
            const r = await api.get<User>('/users/me');
            return r.data;
        }
    },
    users: {
        search: async (username: string) => {
            const r = await api.get<User[]>('/users', { params: { username } });
            return r.data;
        },
        updateMe: async (data: { username?: string; avatar_url?: string }) => {
            const r = await api.put<User>('/users/me', data);
            return r.data;
        }
    },
    chats: {
        list: async () => {
            const r = await api.get('/chats');
            return r.data;
        },
        create: async (participantUsername: string) => {
            const r = await api.post('/chats', { participant_username: participantUsername });
            return r.data;
        },
        delete: async (chatId: string) => {
            const r = await api.delete(`/chats/${chatId}`);
            return r.data;
        },
        getMessages: async (chatId: string) => {
            const r = await api.get<Message[]>(`/chats/${chatId}/messages`);
            return r.data;
        },
        sendMessage: async (chatId: string, content: string, type: MessageType, replyToId?: string) => {
            const response = await api.post(`/chats/${chatId}/messages`, { content, type, reply_to_id: replyToId });
            return response.data;
        },

        deleteMessage: async (chatId: string, messageId: string) => {
            const response = await api.delete(`/chats/${chatId}/messages/${messageId}`);
            return response.data;
        },
    }
};
