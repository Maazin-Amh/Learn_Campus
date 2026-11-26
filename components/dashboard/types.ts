export type User = { uid: string; displayName: string };

export type Message = {
  senderId: string;
  text: string;
  createdAt: number;
};

export type Course = {
  id: string;
  name: string;
  code: string;
  lecturer: string;
  schedule: string;
  zoomUrl?: string;
  createdAt: number;
};

export type DashboardView = "overview" | "courses" | "chats" | "zoom";

export type Session = {
  uid: string;
  email: string;
  displayName: string;
  token: string;
  refreshToken?: string;
};
