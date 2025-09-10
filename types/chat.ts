import { Person } from "./enrollment";

export interface AdminConversation {
  conversation_id: string;
  participants: { id: string; first_name: string; last_name: string }[];
}
