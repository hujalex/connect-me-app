// lib/admins.actions.ts

// lib/student.actions.ts
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Profile,
  Session,
  Notification,
  Event,
  Enrollment,
  Meeting,
  Availability,
} from "@/types";
import {
  deleteScheduledEmailBeforeSessions,
  sendScheduledEmailsBeforeSessions,
  updateScheduledEmailBeforeSessions,
} from "./email.server.actions";
import { getProfileWithProfileId, getProfileByEmail } from "./user.actions";
import {
  addDays,
  format,
  parse,
  parseISO,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  addHours,
  isValid,
  setHours,
  setMinutes,
} from "date-fns"; // Only use date-fns
import ResetPassword from "@/app/(public)/set-password/page";
import { getStudentSessions } from "./student.actions";
import { date } from "zod";
import { withCoalescedInvoke } from "next/dist/lib/coalesced-function";
import toast from "react-hot-toast";
import { DatabaseIcon } from "lucide-react";
import { SYSTEM_ENTRYPOINTS } from "next/dist/shared/lib/constants";
import { Table } from "../supabase/tables";
// import { getMeeting } from "./meeting.actions";

const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export async function getEnrollments(
  tutorId: string
): Promise<Enrollment[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from(Table.Enrollments)
      .select(
        `
        id,
        created_at,
        summary,
        student_id,
        tutor_id,
        start_date,
        end_date,
        availability,
        meetingId,
        summer_paused,
        duration
      `
      )
      .eq("tutor_id", tutorId);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      console.log("No events found:");
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const enrollments: Enrollment[] = await Promise.all(
      data.map(async (enrollment: any) => ({
        createdAt: enrollment.created_at,
        id: enrollment.id,
        summary: enrollment.summary,
        student: await getProfileWithProfileId(enrollment.student_id),
        tutor: await getProfileWithProfileId(enrollment.tutor_id),
        startDate: enrollment.start_date,
        endDate: enrollment.end_date,
        availability: enrollment.availability,
        meetingId: enrollment.meetingId,
        summerPaused: enrollment.summer_paused,
        duration: enrollment.duration,
      }))
    );

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null;
  }
}

export const getHourInterval = async (availabilityList: Availability[]) => {
  try {
    let availabilityListHours: Availability[] = [];

    availabilityList.map((availability) => {
      availability.day;
      availability.startTime;
      availability.endTime;
    });
  } catch (error) {
    console.error("Unable to split into hours", error);
    throw error;
  }
};

export const getOverlappingAvailabilites = async (
  tutorAvailability: {
    day: string;
    startTime: string;
    endTime: string;
  }[],
  studentAvailability: {
    day: string;
    startTime: string;
    endTime: string;
  }[]
): Promise<Availability[] | undefined> => {
  try {
    console.log(tutorAvailability);
    console.log(studentAvailability);

    const { data, error } = await supabase.rpc(
      "get_overlapping_availabilities_array",
      {
        a: tutorAvailability,
        b: studentAvailability,
      }
    );
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to get overlapping availabilities");
  }
};
