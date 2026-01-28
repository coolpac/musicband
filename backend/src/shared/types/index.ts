// Общие типы для проекта

export type UserRole = 'user' | 'admin' | 'agent';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
export type AgentStatus = 'active' | 'inactive' | 'suspended';
export type ReferralEventType = 'click' | 'registration' | 'booking' | 'vote';
export type ReferralEventStatus = 'pending' | 'confirmed' | 'rejected';
