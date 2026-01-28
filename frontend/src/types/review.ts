export type Review = {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  rating: number; // 1-5
  text?: string;
  createdAt: string;
  updatedAt?: string;
};
