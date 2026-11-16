import type {
  BusinessSettings,
  ConsentEvent,
  DeliveryStatus,
  Channel,
  MessageType,
  OrderStatus,
  SlotBooking,
  StaffUser,
  StatusLogEntry,
  Subscription,
} from "@abholdemo/shared";

export interface UserRec extends StaffUser {
  passwordHash: string;
}

export interface MessageRec {
  id: string;
  orderId: string;
  type: MessageType;
  channel: Channel;
  recipient: string; // full contact, only masked in views
  text: string;
  link: string;
  deliveryStatus: DeliveryStatus;
  costEur: number;
  createdAt: string;
  stopSimulated: boolean;
}

export interface OrderRec {
  id: string;
  code: string;
  item: string;
  category: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  plannedPickupDate: string | null;
  estimatedCompletion: string | null;
  status: OrderStatus;
  createdAt: string;
  readyAt: string | null;
  pickedUpAt: string | null;
  photoMime: string | null; // file lives in data/photos
  log: StatusLogEntry[];
  subscription: Subscription | null;
  consentLog: ConsentEvent[];
  booking: SlotBooking | null; // at most one per order
  readyMessageSent: boolean;
  reminderSent: boolean;
}

export interface Db {
  offsetDays: number;
  settings: BusinessSettings;
  users: UserRec[];
  tokens: { token: string; userId: string; createdAt: string }[];
  orders: OrderRec[];
  messages: MessageRec[];
  counters: { order: number; message: number; user: number };
}
