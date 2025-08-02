// zoomLogger.ts
import { createClient } from "@supabase/supabase-js";

// Init Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role key required for inserting rows
);

// Typescript type (optional)
interface ZoomParticipantData {
  session_id: string; // UUID of the session
  user_id?: string; // Optional internal user ID
  user_name: string;
  participant_uuid: string;
  email?: string;
  date_time: string; // ISO format datetime of join
  leave_time?: string; // ISO format datetime of leave
  leave_reason?: string;
}

/**
 * Log Zoom Account Activity
 * @param participant
 * @returns
 */
export async function logZoomMetadata(participant: ZoomParticipantData) {
  const { data, error } = await supabase.from("session_participation").insert([
    {
      session_id: participant.session_id,
      user_id: participant.user_id || null,
      user_name: participant.user_name,
      participant_uuid: participant.participant_uuid,
      email: participant.email || null,
      date_time: participant.date_time,
      leave_time: participant.leave_time || null,
      leave_reason: participant.leave_reason || null,
    },
  ]);

  if (error) {
    console.error("Error logging Zoom metadata:", error);
    throw error;
  }

  return data;
}
