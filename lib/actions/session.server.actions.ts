"use server";
import { Session } from "@/types";
import { toast } from "react-hot-toast";
import { Client } from "@upstash/qstash";
import { createClient } from "@supabase/supabase-js";
import { Profile } from "@/types";
import { getProfileWithProfileId } from "./user.actions";
import { getMeeting } from "./meeting.server.actions";
import { getSupabase } from "../supabase-server/serverClient";

export async function getSessions(
  start: string,
  end: string
): Promise<Session[]> {
  try {
    const supabase = getSupabase();

    const { data: sessionData, error: sessionError } = await supabase
      .from("Sessions")
      .select("*")
      .gt("date", start)
      .lt("date", end);

    if (sessionError) throw sessionError;

    const sessions: Session[] = await Promise.all(
      sessionData.map(async (session: any) => ({
        id: session.id,
        enrollmentId: session.enrollment_id,
        createdAt: session.created_at,
        environment: session.environment,
        date: session.date,
        summary: session.summary,
        // meetingId: session.meeting_id,
        meeting: await getMeeting(session.meeting_id),
        student: await getProfileWithProfileId(session.student_id),
        tutor: await getProfileWithProfileId(session.tutor_id),
        status: session.status,
        session_exit_form: session.session_exit_form,
        isQuestionOrConcern: Boolean(session.is_question_or_concern),
        isFirstSession: Boolean(session.is_first_session),
        duration: session.duration,
      }))
    );

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions: ", error);
    throw error;
  }
}
