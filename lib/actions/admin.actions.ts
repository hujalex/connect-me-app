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
  startOfWeek,
  endOfWeek,
  subDays,
} from "date-fns"; // Only use date-fns
import * as DateFNS from "date-fns-tz";
import ResetPassword from "@/app/(public)/set-password/page";
import { getStudentSessions } from "./student.actions";
import { date } from "zod";
import { withCoalescedInvoke } from "next/dist/lib/coalesced-function";
import toast from "react-hot-toast";
import { DatabaseIcon } from "lucide-react";
import { SYSTEM_ENTRYPOINTS } from "next/dist/shared/lib/constants";
import { Table } from "../supabase/tables";
import DeleteTutorForm from "@/components/admin/components/DeleteTutorForm";
import { createUser } from "./auth.actions";
import { handleCalculateDuration } from "./hours.actions";
import { language } from "googleapis/build/src/apis/language";
import { tableToIntefaceProfiles } from "../type-utils";
import { createPairingRequest } from "./pairing.actions";
// import { getMeeting } from "./meeting.actions";

const { toZonedTime, fromZonedTime } = DateFNS;
const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/* PROFILES */
export async function getAllProfiles(
  role: "Student" | "Tutor" | "Admin",
  orderBy?: string | null,
  ascending?: boolean | null
): Promise<Profile[] | null> {
  try {
    const profileFields = `
      id,
      created_at,
      role,
      user_id,
      age,
      grade,
      first_name,
      last_name,
      date_of_birth,
      start_date,
      availability,
      email,
      phone_number,
      parent_name,
      parent_phone,
      parent_email,
      tutor_ids,
      timezone,
      subjects_of_interest,
      languages_spoken,
      status,
      student_number,
      settings_id
    `;

    // Build query
    let query = supabase
      .from(Table.Profiles)
      .select(profileFields)
      .eq("role", role);

    // Add ordering if provided
    if (orderBy && ascending !== null) {
      query = query.order(orderBy, { ascending });
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching profiles:", error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Map database fields to camelCase Profile model
    const userProfiles: Profile[] = data.map((profile) => ({
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
      age: profile.age,
      grade: profile.grade,
      firstName: profile.first_name,
      lastName: profile.last_name,
      dateOfBirth: profile.date_of_birth,
      startDate: profile.start_date,
      availability: profile.availability,
      email: profile.email,
      phoneNumber: profile.phone_number,
      parentName: profile.parent_name,
      parentPhone: profile.parent_phone,
      parentEmail: profile.parent_email,
      tutorIds: profile.tutor_ids,
      timeZone: profile.timezone,
      subjectsOfInterest: profile.subjects_of_interest,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
      subjects_of_interest: profile.subjects_of_interest,
      languages_spoken: profile.languages_spoken,
    }));

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}

export const addStudent = async (
  studentData: Partial<Profile>
): Promise<Profile> => {
  const supabase = createClientComponentClient();

  try {
    if (!studentData.email) {
      throw new Error("Email is required to create a student profile");
    }

    const lower_case_email = studentData.email.toLowerCase().trim();

    // Check if a user with this email already exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from(Table.Profiles)
      .select("user_id")
      .eq("email", lower_case_email);

    if (userCheckError && userCheckError.code !== "PGRST116") {
      // PGRST116 means no rows returned, which is what we want
      throw userCheckError;
    }

    if (existingUser && existingUser.length > 0) {
      throw new Error("A user with this email already exists");
    }

    //-----Moved After Duplicate Check to prevent Sending confimration email-----
    const tempPassword = await createPassword();
    const userId = await createUser(lower_case_email, tempPassword);

    // Create the student profile without id and createdAt
    const newStudentProfile = {
      user_id: userId,
      role: "Student",
      first_name: studentData.firstName ? studentData.firstName.trim() : "",
      last_name: studentData.lastName ? studentData.lastName.trim() : "",
      age: studentData.age || "",
      grade: studentData.grade || "",
      gender: studentData.gender || "",
      // date_of_birth: studentData.dateOfBirth || "",
      start_date: studentData.startDate || new Date().toISOString(),
      availability: studentData.availability || [],
      email: lower_case_email,
      parent_name: studentData.parentName || "",
      parent_phone: studentData.parentPhone || "",
      parent_email: studentData.parentEmail || "",
      timezone: studentData.timeZone || "",
      subjects_of_interest: studentData.subjects_of_interest || [],
      tutor_ids: [], // Changed from tutorIds to tutor_ids
      status: "Active",
      student_number: studentData.studentNumber,
    };

    // Add student profile to the database
    const { data: profileData, error: profileError } = await supabase
      .from(Table.Profiles) // Ensure 'profiles' is correctly cased
      .insert(newStudentProfile)
      .select("*");

    if (profileError) {
      if (userId) await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }
    // Ensure profileData is defined and cast it to the correct type
    if (!profileData) {
      throw new Error("Profile data not returned after insertion");
    }

    // Type assertion to ensure profileData is of type Profile
    const createdProfile: any = profileData;

    // Return the newly created profile data, including autogenerated fields
    return {
      id: createdProfile.id, // Assuming 'id' is the generated key
      createdAt: createdProfile.createdAt, // Assuming 'created_at' is the generated timestamp
      userId: createdProfile.userId, // Adjust based on your schema
      role: createdProfile.role,
      firstName: createdProfile.firstName,
      lastName: createdProfile.lastName,
      age: createdProfile.age,
      grade: createdProfile.grade,
      gender: createdProfile.gender,
      // dateOfBirth: createdProfile.dateOfBirth,
      startDate: createdProfile.startDate,
      availability: createdProfile.availability,
      email: createdProfile.email,
      phoneNumber: createdProfile.phone_number,
      parentName: createdProfile.parentName,
      parentPhone: createdProfile.parentPhone,
      parentEmail: createdProfile.parentEmail,
      timeZone: createdProfile.timeZone,
      subjects_of_interest: createdProfile.subjects_of_interest,
      languages_spoken: createdProfile.languages_spoken,
      tutorIds: createdProfile.tutorIds,
      status: createdProfile.status,
      studentNumber: createdProfile.studentNumber,
      settingsId: createdProfile.settings_id,
    };
  } catch (error) {
    console.error("Error adding student:", error);
    throw error;
  }
};

export const addTutor = async (
  tutorData: Partial<Profile>,
  addToPairingQueue?: boolean
): Promise<Profile> => {
  const supabase = createClientComponentClient();
  try {
    console.log(tutorData);
    if (!tutorData.email) {
      throw new Error("Email is required to create a student profile");
    }

    const lowerCaseEmail = tutorData.email.toLowerCase().trim();

    // Check if a user with this email already exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from(Table.Profiles)
      .select("user_id")
      .eq("email", lowerCaseEmail);

    if (userCheckError && userCheckError.code !== "PGRST116") {
      // PGRST116 means no rows returned, which is what we want
      throw userCheckError;
    }

    if (existingUser && existingUser.length > 0) {
      throw new Error("A user with this email already exists");
    }

    //-----Moved After Duplicate Check to prevent Sending confimration email-----
    const tempPassword = await createPassword();
    const userId = await createUser(lowerCaseEmail, tempPassword);

    // Create the student profile without id and createdAt
    const newTutorProfile = {
      user_id: userId,
      role: "Tutor",
      first_name: tutorData.firstName ? tutorData.firstName.trim() : "",
      last_name: tutorData.lastName ? tutorData.lastName.trim() : "",
      // date_of_birth: tutorData.dateOfBirth || "",
      start_date: tutorData.startDate || new Date().toISOString(),
      availability: tutorData.availability || [],
      email: lowerCaseEmail,
      timezone: tutorData.timeZone || "",
      subjects_of_interest: tutorData.subjects_of_interest || [],
      languages_spoken: tutorData.languages_spoken || [],
      tutor_ids: [], // Changed from tutorIds to tutor_ids
      status: "Active",
      student_number: null,
    };

    // Add tutor profile to the database
    const { data: profileData, error: profileError } = await supabase
      .from(Table.Profiles) // Ensure 'profiles' is correctly cased
      .insert(newTutorProfile)
      .select("*");

    if (profileError) throw profileError;

    // Ensure profileData is defined and cast it to the correct type
    if (!profileData) {
      throw new Error("Profile data not returned after insertion");
    }

    if (addToPairingQueue) {
      await createPairingRequest(userId!, "");
    }

    // Type assertion to ensure profileData is of type Profile
    const createdProfile: any = profileData;

    // Return the newly created profile data, including autogenerated fields
    return {
      id: createdProfile.id, // Assuming 'id' is the generated key
      createdAt: createdProfile.createdAt, // Assuming 'created_at' is the generated timestamp
      userId: createdProfile.userId, // Adjust based on your schema
      role: createdProfile.role,
      firstName: createdProfile.firstName,
      lastName: createdProfile.lastName,
      // dateOfBirth: createdProfile.dateOfBirth,
      startDate: createdProfile.startDate,
      availability: createdProfile.availability,
      email: createdProfile.email,
      parentName: createdProfile.parentName,
      parentPhone: createdProfile.parentPhone,
      parentEmail: createdProfile.parentEmail,
      timeZone: createdProfile.timeZone,
      subjectsOfInterest: createdProfile.subjectsOfInterest,
      tutorIds: createdProfile.tutorIds,
      status: createdProfile.status,
      studentNumber: createdProfile.student_number,
      settingsId: createdProfile.settings_id,
    };
  } catch (error) {
    console.error("Error adding student:", error);
    throw error;
  }
};

export async function deleteUser(profileId: string) {
  try {
    if (!profileId) throw new Error("Profile ID is required");

    const response = await fetch("/api/admin/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ profileId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || `HTTP ${response.status}: Failed to delete user`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

export async function getUserFromId(profileId: string) {
  try {
    const { data: profile, error } = await supabase
      .from(Table.Profiles)
      .select(
        ` id,
          created_at,
          role,
          user_id,
          first_name,
          last_name,
          age,
          grade,
          gender,
          date_of_birth,
          start_date,
          availability,
          email,
          phone_number,
          parent_name,
          parent_phone,
          parent_email,
          tutor_ids,
          timezone,
          subjects_of_interest,
          languages_spoken,
          status,
          student_number,
          settings_id
        `
      )
      .eq("id", profileId)
      .single();

    if (error) {
      throw error;
    }
    if (!profile) return null;

    const userProfile: Profile = {
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      age: profile.age,
      grade: profile.grade,
      gender: profile.gender,
      dateOfBirth: profile.date_of_birth,
      startDate: profile.start_date,
      availability: profile.availability,
      email: profile.email,
      phoneNumber: profile.phone_number,
      parentName: profile.parent_name,
      parentPhone: profile.parent_phone,
      parentEmail: profile.parent_email,
      tutorIds: profile.tutor_ids,
      timeZone: profile.timezone,
      subjects_of_interest: profile.subjects_of_interest,
      languages_spoken: profile.languages_spoken,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
    };
    return userProfile;
  } catch (error) {
    console.error("Failed to fetch user");
    return null;
  }
}

//---updateUser
export async function editUser(profile: Profile) {
  const {
    id,
    role,
    firstName,
    lastName,
    age,
    grade,
    gender,
    email,
    // dateOfBirth,
    startDate,
    parentName,
    parentPhone,
    parentEmail,
    timeZone,
    availability,
    subjects_of_interest,
    languages_spoken,
    studentNumber,
  } = profile;
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({
        role: role,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age: age,
        grade: grade,
        gender: gender,
        email: email,
        // date_of_birth: dateOfBirth,
        start_date: startDate,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        timezone: timeZone,
        student_number: studentNumber,
        availability: availability,
        subjects_of_interest: subjects_of_interest,
        languages_spoken: languages_spoken,
      })
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating user", error);
    throw new Error("Unable to edit User");
  }
}

export async function deactivateUser(profileId: string) {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({ status: "Inactive" })
      .eq("id", profileId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error deactivating user:", error);
    throw error;
  }
}

export async function reactivateUser(profileId: string) {
  try {
    const { data, error } = await supabase
      .from(Table.Profiles)
      .update({ status: "Active" })
      .eq("id", profileId)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error reactivating user:", error);
    throw error;
  }
}

/* USERS */

export const sendConfirmationEmail = async (email: string) => {
  try {
    await resendEmailConfirmation(email);
  } catch (error) {
    console.error("Unable to send confirmation email", email);
    throw error;
  }
};

export const createConfirmationEmail = async (
  email: string,
  tempPassword: string
) => {
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: email,
      password: tempPassword,
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });
  } catch (error) {
    console.error("Unable to create confirmation email");
    throw error;
  }
};

export const resendEmailConfirmation = async (email: string) => {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error("Failed to resend Email Confirmation", error);
    throw error;
  }
};

/* SESSIONS */
export async function createSession(sessionData: any) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .insert(sessionData)
    .single();

  if (error) throw error;
  return data;
}

export async function getAllSessions(
  startDate?: string,
  endDate?: string,
  orderBy?: string,
  ascending?: boolean
): Promise<Session[]> {
  try {
    let query = supabase.from(Table.Sessions).select(`
      id,
      enrollment_id,
      created_at,
      environment,
      student_id,
      tutor_id,
      date,
      summary,
      meeting_id,
      status,
      is_question_or_concern,
      is_first_session,
      session_exit_form,
      duration,
      meetings:Meetings!meeting_id(*),
      student:Profiles!student_id(*),
      tutor:Profiles!tutor_id(*)
    `);

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    if (orderBy && ascending !== undefined) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching student sessions:", error.message);
      throw error;
    }

    const sessions: Session[] = await Promise.all(
      data.map(async (session: any) => ({
        id: session.id,
        enrollmentId: session.enrollment_id,
        createdAt: session.created_at,
        environment: session.environment,
        date: session.date,
        summary: session.summary,
        // meetingId: session.meeting_id,
        // meeting: await getMeeting(session.meeting_id),
        meeting: session.meetings,
        student: await tableToIntefaceProfiles(session.student),
        tutor: await tableToIntefaceProfiles(session.tutor),
        // student: await getProfileWithProfileId(session.student_id),
        // tutor: await getProfileWithProfileId(session.tutor_id),
        status: session.status,
        session_exit_form: session.session_exit_form,
        isQuestionOrConcern: Boolean(session.is_question_or_concern),
        isFirstSession: Boolean(session.is_first_session),
        duration: session.duration,
      }))
    );
    console.log("Sessions", sessions);

    return sessions;
  } catch (error) {
    console.error("Error fetching sessions", error);
    return [];
  }
}

// export function getAllSessions(
//   startDate?: string,
//   endDate?: string,
//   orderBy?: string,
//   ascending?: boolean
// ) {
//   try {
//     let query = supabase.from(Table.Sessions).select(`
//       id,
//       created_at,
//       environment,
//       student_id,
//       tutor_id,
//       date,
//       summary,
//       meeting_id,
//       status,
//       is_question_or_concern,
//       is_first_session,
//       session_exit_form
//     `);

//     if (startDate) {
//       query = query.gte("date", startDate);
//     }
//     if (endDate) {
//       query = query.lte("date", endDate);
//     }

//     if (orderBy && ascending !== undefined) {
//       query = query.order(orderBy, { ascending });
//     }

//     const { data, error } = await query;

//     if (error) {
//       console.error("Error fetching student sessions:", error.message);
//       throw error;
//     }

//     // Map the result to the Session interface
//     const sessions: Session[] = await Promise.all(
//       data.map(async (session: any) => ({
//         id: session.id,
//         createdAt: session.created_at,
//         environment: session.environment,
//         date: session.date,
//         summary: session.summary,
//         // meetingId: session.meeting_id,
//         meeting: await getMeeting(session.meeting_id),
//         student: await getProfileWithProfileId(session.student_id),
//         tutor: await getProfileWithProfileId(session.tutor_id),
//         status: session.status,
//         session_exit_form: session.session_exit_form,
//         isQuestionOrConcern: Boolean(session.is_question_or_concern),
//         isFirstSession: Boolean(session.is_first_session),
//       }))
//     );

//     console.log(sessions);

//     return sessions;
//   } catch (error) {
//     console.error("Error fetching sessions");
//     return [];
//   }
// }

export async function rescheduleSession(sessionId: string, newDate: string) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      date: newDate,
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function getSessionKeys(data?: Session[]) {
  const sessionKeys: Set<string> = new Set();

  if (!data) {
    const { data, error } = await supabase
      .from(Table.Sessions)
      .select("student_id, tutor_id, date");

    if (error) {
      console.error("Error fetching sessions:", error);
      throw error;
    }
  }

  if (!data) return sessionKeys;

  data.forEach((session) => {
    if (session.date) {
      const sessionDate = new Date(session.date);
      const key = `${session.student?.id}-${session.tutor?.id}-${format(
        sessionDate,
        "yyyy-MM-dd-HH:mm"
      )}`;
      sessionKeys.add(key);
    }
  });

  return sessionKeys;
}

/**
 * Checks if a meeting is available at the requested session time
 *
 * @param meetingId - ID of the meeting to check
 * @param sessionId - ID of the current session (to exclude from conflicts)
 * @param sessionDate - ISO string date of the requested session
 * @param existingSessions - Array of all sessions to check for conflicts
 * @returns boolean - True if the meeting is available
 */
// export async function isMeetingAvailable(
//   meetingId: string,
//   sessionId: string | undefined,
//   sessionDate: string,
//   existingSessions: Session[]
// ): Promise<boolean> {
//   try {
//     // Check if the session date is valid
//     if (!sessionDate || !isValid(parseISO(sessionDate))) {
//       console.error("Invalid session date provided");
//       return false;
//     }

//     // Calculate session time range
//     const sessionStartTime = parseISO(sessionDate);
//     const sessionEndTime = addHours(sessionStartTime, 1);

//     // Check for conflicts with existing sessions
//     const hasConflict = existingSessions.some(
//       (existingSession) =>
//         // Don't check against the same session we're updating
//         sessionId !== existingSession.id &&
//         // Check if the meeting ID matches
//         existingSession.meeting?.id === meetingId &&
//         // Check for time overlap
//         areIntervalsOverlapping(
//           { start: sessionStartTime, end: sessionEndTime },
//           {
//             start: parseISO(existingSession.date),
//             end: addHours(parseISO(existingSession.date), 1),
//           }
//         )
//     );

//     // Return true if no conflicts found
//     return !hasConflict;
//   } catch (error) {
//     console.error("Error checking meeting availability:", error);
//     return false; // Default to unavailable on error
//   }
// }

/**
 *Applies a SQL query to check if an individual meeting is available
 *@param meetingId
 *@param session
 */

export async function isSingleMeetingAvailable(
  meetingId: string,
  session: Session
): Promise<void> {}

/**
 * Checks availability of multiple meetings at once
 *
 * @param meetings - Array of meetings to check
 * @param sessionId - ID of the current session
 * @param sessionDate - ISO string date of the requested session
 * @param existingSessions - Array of all sessions to check for conflicts
 * @returns Record<string, boolean> - Map of meeting IDs to availability
 */
// export async function checkMeetingsAvailability(
//   meetings: Meeting[],
//   sessionId: string | undefined,
//   sessionDate: string,
//   existingSessions: Session[]
// ): Promise<Record<string, boolean>> {
//   try {
//     const meetingAvailability: Record<string, boolean> = {};

//     // Initialize all meetings as available
//     meetings.forEach((meeting) => {
//       meetingAvailability[meeting.id] = true;
//     });

//     // Check each meeting for conflicts
//     for (const meeting of meetings) {
//       meetingAvailability[meeting.id] = await isMeetingAvailable(
//         meeting.id,
//         sessionId,
//         sessionDate,
//         existingSessions
//       );
//     }

//     return meetingAvailability;
//   } catch (error) {
//     console.error("Error checking meetings availability:", error);
//     return {}; // Return empty object on error
//   }
// }

export async function addOneSession(
  session: Session,
  scheduleEmail: boolean = true
): Promise<void> {
  try {
    const newSession = {
      date: session.date,
      enrollment_id: null, //omdependent of enrollment date
      student_id: session.student?.id,
      tutor_id: session.tutor?.id,
      status: "Active",
      summary: session.summary,
      meeting_id: session.meeting?.id,
      duration: 1,
    };

    const { data, error } = await supabase
      .from(Table.Sessions)
      .insert(newSession)
      .select()
      .single();

    if (error) throw error;

    if (!data) toast.error("No Data");

    if (data && scheduleEmail) {
      const addedSession: Session = {
        id: data.id,
        enrollmentId: data.enrollment_id,
        createdAt: data.created_at,
        environment: data.environment,
        date: data.date,
        summary: data.summary,
        meeting: await getMeeting(data.meeting_id),
        student: await getProfileWithProfileId(data.student_id),
        tutor: await getProfileWithProfileId(data.tutor_id),
        status: data.status,
        session_exit_form: data.session_exit_form || null,
        isQuestionOrConcern: data.isQuestionOrConcern,
        isFirstSession: data.isFirstSession,
        duration: 1, //default //! might fix
      };

      sendScheduledEmailsBeforeSessions([addedSession]);
    }
  } catch (error) {
    console.error("Unable to add one session", error);
    throw error;
  }
}

async function isSessioninPastWeek(enrollmentId: string, midWeek: Date) {
  const midLastWeek = subDays(midWeek, 7);

  const startOfLastWeek: Date = startOfWeek(midLastWeek);
  const endOfLastWeek: Date = endOfWeek(midLastWeek);

  const { data, error } = await supabase
    .from("Sessions")
    .select("*")
    .gte("date", startOfLastWeek.toISOString())
    .lte("date", endOfLastWeek.toISOString())
    .eq("enrollment_id", enrollmentId);

  if (error) throw error;

  return Object.keys(data).length > 0;
}

/**
 * Add sessions for enrollments within the specified week range
 * @param weekStartString - ISO string of week start in Eastern Time
 * @param weekEndString - ISO string of week end in Eastern Time
 * @param enrollments - List of enrollments to create sessions for
 * @param sessions - Existing sessions to avoid duplicates
 * @returns Newly created sessions
 */
export async function addSessions(
  weekStartString: string,
  weekEndString: string,
  enrollments: Enrollment[],
  sessions: Session[]
): Promise<Session[]> {
  try {
    const weekStart: Date = fromZonedTime(
      parseISO(weekStartString),
      "America/New_York"
    );
    const weekEnd: Date = fromZonedTime(
      parseISO(weekEndString),
      "America/New_York"
    );

    const now: string = new Date().toISOString();

    //Set created to avoid duplicates
    const scheduledSessions: Set<string> = await getSessionKeys(sessions);
    // Prepare bulk insert data
    const sessionsToCreate: any[] = [];

    // Process all enrollments
    for (const enrollment of enrollments) {
      const {
        id,
        student,
        tutor,
        availability,
        meetingId,
        summary,
        startDate,
        duration,
        frequency,
      } = enrollment;

      if (frequency === "biweekly") {
        if (await isSessioninPastWeek(id, addDays(weekStart, 3))) continue;
      }

      const startDate_asDate = new Date(startDate); //UTC

      //Check if paused over the summer
      if (enrollment.summerPaused) {
        continue;
      }

      // Skip invalid enrollments
      if (!student?.id || !tutor?.id || !availability?.length) {
        continue;
      }

      // Process each availability slot
      let { day, startTime, endTime } = availability[0];

      // Skip invalid time formats
      if (
        !startTime ||
        !endTime
        // startTime.includes("-") ||
        // endTime.includes("-")
      ) {
        console.error(`Invalid time format in availability:`, availability[0]);
        continue;
      }

      // Find matching day in the week range
      let currentDate = new Date(weekStart);
      const dayLower = day.toLowerCase();

      while (currentDate <= weekEnd) {
        const currentDay = format(currentDate, "EEEE").toLowerCase();

        // Skip days that don't match
        if (currentDay !== dayLower) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        //Add Seven Days if CurrentDate is last week (Acts as a Modulus to ensure updating current week only)
        if (currentDate < parseISO(weekStartString)) {
          currentDate = addDays(currentDate, 7);
        }

        //Remove Seven Days if CurrentDate is next week (Acts as a Modulus to ensure updating current week only)
        if (currentDate > parseISO(weekEndString)) {
          currentDate = addDays(currentDate, -7);
        }

        try {
          // Parse times correctly
          const [startHour, startMinute] = startTime.split(":").map(Number);
          const [endHour, endMinute] = endTime.split(":").map(Number);

          if (
            isNaN(startHour) ||
            isNaN(startMinute) ||
            isNaN(endHour) ||
            isNaN(endMinute)
          ) {
            throw new Error(
              `Invalid time format: start=${startTime}, end=${endTime}`
            );
          }

          // Create session date with correct time
          // * SetHours and SetMinutes are dependent on local timezone

          const dateString = `${format(currentDate, "yyyy-MM-dd")}T${startTime}:00`;
          const sessionStartTime = fromZonedTime(
            dateString,
            "America/New_York"
          ); // Automatically handles DST

          if (sessionStartTime < startDate_asDate) {
            throw new Error("Session occurs before start date");
          }

          // Check for duplicate session
          const sessionKey = `${student.id}-${tutor.id}-${format(
            sessionStartTime,
            "yyyy-MM-dd-HH:mm"
          )}`;

          if (!scheduledSessions.has(sessionKey)) {
            // Add to batch insert
            sessionsToCreate.push({
              enrollment_id: id,
              date: sessionStartTime.toISOString(),
              student_id: student.id,
              tutor_id: tutor.id,
              status: "Active",
              summary: summary || "",
              meeting_id: meetingId || null,
              duration: duration,
            });

            // Track this session to avoid duplicates
            scheduledSessions.add(sessionKey);
          }
        } catch (err) {
          console.error(
            `Error processing time for ${day} ${startTime}-${endTime}:`,
            err
          );
        }

        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
    }

    // Perform batch insert if we have sessions to create
    if (sessionsToCreate.length > 0) {
      const { data, error } = await supabase
        .from(Table.Sessions)
        .insert(sessionsToCreate)
        .select();

      if (error) throw error;

      if (data) {
        // Transform returned data to Session objects
        const sessions: Session[] = await Promise.all(
          data.map(async (session: any) => ({
            id: session.id,
            enrollmentId: session.enrollment_id,
            createdAt: session.created_at,
            environment: session.environment,
            date: session.date,
            summary: session.summary,
            meeting: await getMeeting(session.meeting_id),
            student: await getProfileWithProfileId(session.student_id),
            tutor: await getProfileWithProfileId(session.tutor_id),
            status: session.status,
            session_exit_form: session.session_exit_form || null,
            isQuestionOrConcern: session.isQuestionOrConcern,
            isFirstSession: session.isFirstSession,
            duration: session.duration,
          }))
        );

        //Schedule emails
        return sessions;
      }
    }

    return [];
  } catch (error) {
    console.error("Error creating sessions:", error);
    throw error;
  }
}

async function logSessionInfo(
  weekStartString: string,
  weekStart: Date,
  weekEnd: Date,
  currentDate: Date,
  sessionStartTime: Date,
  sessionStartTimeEST: Date
) {
  console.log("ISO of week start", weekStartString);
  console.log("date object of week start", weekStart);
  console.log("Date object of week end,", weekEnd);
  // console.log("Date Object EST of week Start", weekStartEST);
  // console.log("Date object EST of Week End", weekEndEST);
  console.log("Date object of day of session", currentDate);
  console.log("Date object of day of session + hours", sessionStartTime);
  console.log("EST, ", sessionStartTimeEST);
  console.log(`ISOstring UTC, ${sessionStartTime.toISOString()}`);
  console.log(`ISOstring EST, ${sessionStartTimeEST.toISOString()}`);
  console.log(`${format(sessionStartTime, "yyyy-MM-dd'T'HH:mm:ss.SSS")}`);
  console.log("-----------------");
}

// export async function addSessions(
//   weekStartString: string,
//   weekEndString: string,
//   enrollments: Enrollment[],
//   sessionsFetched: Session[]
// ) {
//   const weekStart = parseISO(weekStartString);
//   const weekEnd = parseISO(weekEndString);
//   const sessions: Session[] = [];

//   const scheduledSessions: Set<string> = await getSessionKeys(sessionsFetched);

//   for (const enrollment of enrollments) {
//     const { student, tutor, availability } = enrollment;

//     if (!student || !tutor) continue;

//     for (const avail of availability) {
//       const { day, startTime, endTime } = avail;

//       if (!startTime || startTime.includes("-")) {
//         console.error(`Invalid time format for availability: ${startTime}`);
//         console.log("Errored Enrollment", enrollment);
//         continue;
//       }

//       const [availStart, availEnd] = [startTime, endTime];

//       if (!availStart || !availEnd) {
//         console.error(
//           `Invalid start or end time: start=${availStart}, end=${availEnd}`
//         );
//         continue;
//       }

//       let sessionDate = new Date(weekStart);
//       while (sessionDate <= weekEnd) {
//         if (format(sessionDate, "EEEE").toLowerCase() === day.toLowerCase()) {
//           const availStartTime = parse(
//             availStart.toLowerCase(),
//             "HH:mm",
//             sessionDate
//           );
//           const availEndTime = parse(
//             availEnd.toLowerCase(),
//             "HH:mm",
//             sessionDate
//           );

//           if (
//             isNaN(availStartTime.getTime()) ||
//             isNaN(availEndTime.getTime())
//           ) {
//             console.error(
//               `Invalid parsed time: start=${availStart}, end=${availEnd}`
//             );
//             break;
//           }

//           const sessionStartTime = setMinutes(
//             setHours(sessionDate, availStartTime.getHours()),
//             availStartTime.getMinutes()
//           );
//           const sessionEndTime = setMinutes(
//             setHours(sessionDate, availEndTime.getHours()),
//             availEndTime.getMinutes()
//           );

//           if (
//             isBefore(sessionStartTime, weekStart) ||
//             isAfter(sessionEndTime, weekEnd)
//           ) {
//             sessionDate = addDays(sessionDate, 1);
//             continue;
//           }

//           // Check for duplicates
//           const sessionKey = `${student.id}-${tutor.id}-${format(
//             sessionStartTime,
//             "yyyy-MM-dd-HH:mm"
//           )}`;
//           if (scheduledSessions.has(sessionKey)) {
//             console.warn(`Duplicate session detected: ${sessionKey}`);
//             sessionDate = addDays(sessionDate, 1);
//             continue;
//           }

//           console.log(enrollment);

//           const { data: session, error } = await supabase
//             .from(Table.Sessions)
//             .insert({
//               date: sessionStartTime.toISOString(),
//               student_id: student.id,
//               tutor_id: tutor.id,
//               status: "Active",
//               summary: enrollment.summary,
//               meeting_id: enrollment.meetingId || null, //TODO: invalid uuid input syntax, uuid doesn't take ""
//             })
//             .single();

//           if (error) {
//             console.error("Error creating session:", error);
//             continue;
//           }

//           sessions.push(session);
//           scheduledSessions.add(sessionKey);
//         }
//         sessionDate = addDays(sessionDate, 1);
//       }
//     }
//   }

//   return sessions;
// }

// Function to update a session
export async function updateSession(
  updatedSession: Session,
  updateEmail: boolean = true
) {
  try {
    const {
      id,
      status,
      tutor,
      student,
      date,
      summary,
      meeting,
      session_exit_form,
      isQuestionOrConcern,
      isFirstSession,
    } = updatedSession;

    const { data, error } = await supabase
      .from(Table.Sessions)
      .update({
        status: status,
        student_id: student?.id,
        tutor_id: tutor?.id,
        date: date,
        summary: summary,
        meeting_id: meeting?.id,
        session_exit_form: session_exit_form,
        is_question_or_concern: isQuestionOrConcern,
        is_first_session: isFirstSession,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating session:", error);
      return null;
    }

    if (data) {
      return data[0];
    } else {
      console.error("NO DATA");
    }
    if (updateEmail && data) {
      const newSession: Session = {
        id: data.id,
        enrollmentId: data.enrollment_id,
        createdAt: data.created_at,
        environment: data.environment,
        date: data.date,
        summary: data.summary,
        meeting: await getMeeting(data.meeting_id),
        student: await getProfileWithProfileId(data.student_id),
        tutor: await getProfileWithProfileId(data.tutor_id),
        status: data.status,
        session_exit_form: data.session_exit_form || null,
        isQuestionOrConcern: data.isQuestionOrConcern,
        isFirstSession: data.isFirstSession,
        duration: data.duration,
      };
      await updateScheduledEmailBeforeSessions(newSession);
    }
  } catch (error) {
    console.error("Unable to update session");
    throw error;
  }
}

export async function removeSession(
  sessionId: string,
  updateEmail: boolean = true
) {
  // Create a notification for the admin
  const { error: eventError } = await supabase
    .from(Table.Sessions)
    .delete()
    .eq("id", sessionId);

  if (eventError) {
    throw eventError;
  }

  if (updateEmail) {
    await deleteScheduledEmailBeforeSessions(sessionId);
  }
}

/* MEETINGS */
export async function getMeetings(): Promise<Meeting[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from(Table.Meetings).select(`
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `);

    console.log("Data: ", data);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const meetings: Meeting[] = await Promise.all(
      data.map(async (meeting: any) => ({
        id: meeting.id,
        name: meeting.name,
        meetingId: meeting.meeting_id,
        password: meeting.password,
        link: meeting.link,
        createdAt: meeting.created_at,
        // name: meeting.name,
      }))
    );

    return meetings; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

export const createEnrollment = async (
  entry: any,
  studentData: any,
  tutorData: any
) => {
  const migratedPairing: Enrollment = {
    id: "",
    createdAt: "",
    student: studentData,
    tutor: tutorData,
    summary: entry.summary,
    startDate: entry.startDate,
    endDate: entry.endDate,
    availability: entry.availability,
    meetingId: entry.meetingId,
    summerPaused: entry.summerPaused,
    duration: entry.duration,
    frequency: entry.frequency,
  };

  return await addEnrollment(migratedPairing);
};

/* ENROLLMENTS */
export async function getAllEnrollments(): Promise<Enrollment[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from(Table.Enrollments).select(`
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
        duration,
        frequency
      `);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
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
        frequency: enrollment.frequency,
      }))
    );

    return enrollments; // Return the array of enrollments
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null;
  }
}

export async function pauseEnrollmentOverSummer(enrollment: Enrollment) {
  try {
    const { data, error } = await supabase
      .from(Table.Enrollments)
      .update({ summer_paused: enrollment.summerPaused })
      .eq("id", enrollment.id)
      .select()
      .single();
    console.log("Updated summer");
    console.log(data);

    if (error) throw error;

    return enrollment;
  } catch (error) {
    console.error("Unable to pause/unpause enrollment over summer");
    throw error;
  }
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from("Meetings")
      .select(
        `
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `
      )
      .eq("id", id)
      .single();

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }
    // Check if data exists
    if (!data) {
      return null; // Valid return
    }
    // Mapping the fetched data to the Notification object
    const meeting: Meeting = {
      id: data.id,
      name: data.name,
      meetingId: data.meeting_id,
      password: data.password,
      link: data.link,
      createdAt: data.created_at,
    };
    return meeting; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

export const updateEnrollment = async (enrollment: Enrollment) => {
  try {
    const now = new Date().toISOString();

    const duration = await handleCalculateDuration(
      enrollment.availability[0].startTime,
      enrollment.availability[0].endTime
    );

    const { data: updateEnrollmentData, error: updateEnrollmentError } =
      await supabase
        .from(Table.Enrollments)
        .update({
          student_id: enrollment.student?.id,
          tutor_id: enrollment.tutor?.id,
          summary: enrollment.summary,
          start_date: enrollment.startDate,
          end_date: enrollment.endDate,
          availability: enrollment.availability,
          meetingId: enrollment.meetingId,
          duration: duration,
          frequency: enrollment.frequency,
        })
        .eq("id", enrollment.id)
        .select("*") // Ensure it selects all columns
        .single(); // Ensure only one object is returned

    if (updateEnrollmentError) {
      console.error("Error updating enrollment: ", updateEnrollmentError);
      throw updateEnrollmentError;
    }

    // update related sessions
    if (enrollment.student && enrollment.tutor) {
      const { data: updateSessionData, error: updateSessionError } =
        await supabase
          .from(Table.Sessions)
          .update({
            student_id: enrollment.student?.id,
            tutor_id: enrollment.tutor?.id,
            meeting_id: enrollment.meetingId,
          })
          .eq("enrollment_id", enrollment.id)
          .gt("date", now);

      if (updateSessionError) {
        console.error("Error updating sessions: ", updateSessionError);
        throw updateSessionError;
      }
    }

    //remove future sessions
    await removeFutureSessions(enrollment.id);

    return updateEnrollmentData;
  } catch (error) {
    console.error("Unable to update Enrollment", error);
    throw error;
  }
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const addEnrollment = async (
  enrollment: Omit<Enrollment, "id" | "createdAt">,
  sendEmail?: boolean
) => {
  try {
    console.log("Duration", enrollment.availability[0]);

    const duration = await handleCalculateDuration(
      enrollment.availability[0].startTime,
      enrollment.availability[0].endTime
    );
    console.log("Duration", duration);

    if (enrollment.duration <= 0)
      throw new Error("Duration should be a positive amount");

    // if (duration >= 3) {
    //   throw new Error(
    //     "Please consult an Exec Team member about sessions longer than 3 hours"
    //   );
    // }

    if (!enrollment.student) throw new Error("Please select a Student");

    if (enrollment.meetingId && !isValidUUID(enrollment.meetingId)) {
      throw new Error("Invalid or no meeting link");
    }

    const { data, error } = await supabase
      .from(Table.Enrollments)
      .insert({
        student_id: enrollment.student?.id,
        tutor_id: enrollment.tutor?.id,
        summary: enrollment.summary,
        start_date: enrollment.startDate,
        end_date: enrollment.endDate,
        availability: enrollment.availability,
        meetingId: enrollment.meetingId,
        duration: duration, //default
        frequency: enrollment.frequency,
      })
      .select(`*`)
      .single();

    if (error) {
      console.error("Error adding enrollment:", error);
      throw error;
    }

    console.log(data);

    return {
      createdAt: data.created_at,
      id: data.id,
      summary: data.summary,
      student: await getProfileWithProfileId(data.student_id),
      tutor: await getProfileWithProfileId(data.tutor_id),
      startDate: data.start_date,
      endDate: data.end_date,
      availability: data.availability,
      meetingId: data.meetingId,
      duration: data.duration,
      frequency: data.frequency,
    };
  } catch (error) {
    throw error;
  }
};

export const removeFutureSessions = async (enrollmentId: string) => {
  try {
    const now: string = new Date().toISOString();
    const { data: deleteSessionsData, error: deleteSessionsError } =
      await supabase
        .from("Sessions")
        .delete()
        .eq("enrollment_id", enrollmentId)
        .eq("status", "Active")
        .gte("date", now);

    console.log("Successfully deleted sessions");

    if (deleteSessionsError) {
      throw deleteSessionsError;
    }
  } catch (error) {
    console.error("Unable to remove future sessions", error);
    throw error;
  }
};

export const removeEnrollment = async (enrollmentId: string) => {
  await removeFutureSessions(enrollmentId);

  const { data: deleteEnrollmentData, error: deleteEnrollmentError } =
    await supabase.from("Enrollments").delete().eq("id", enrollmentId);

  if (deleteEnrollmentError) {
    console.error("Error removing enrollment:", deleteEnrollmentError);
    throw deleteEnrollmentError;
  }
};

/* EVENTS */
export async function getEvents(tutorId: string): Promise<Event[]> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from("Events")
      .select(
        `
        id,
        created_at,
        date,
        summary,
        tutor_id,
        hours
      `
      )
      .eq("tutor_id", tutorId);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return []; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      console.log("No events found:");
      return []; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const events: Event[] = await Promise.all(
      data.map(async (event: any) => ({
        createdAt: event.created_at,
        id: event.id,
        summary: event.summary,
        tutorId: event.tutor_id,
        date: event.date,
        hours: event.hours,
        type: event.type,
      }))
    );

    return events; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return [];
  }
}

export async function getEventsWithTutorMonth(
  tutorId: string,
  selectedMonth: string
): Promise<Event[] | null> {
  try {
    // Fetch event details filtered by tutor IDs and selected month
    const { data, error } = await supabase
      .from("Events")
      .select(
        `
        id,
        created_at,
        date,
        summary,
        tutor_id,
        hours
      `
      )
      .eq("tutor_id", tutorId) // Filter by tutor IDs
      .gte("date", selectedMonth) // Filter events from the start of the selected month
      .lt(
        "date",
        new Date(
          new Date(selectedMonth).setMonth(
            new Date(selectedMonth).getMonth() + 1
          )
        ).toISOString()
      ); // Filter before the start of the next month

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      return null;
    }

    // Check if data exists
    if (!data) {
      console.log("No events found:");
      return null;
    }

    // Map the fetched data to the Event object
    const events: Event[] = data.map((event: any) => ({
      createdAt: event.created_at,
      id: event.id,
      summary: event.summary,
      tutorId: event.tutor_id,
      date: event.date,
      hours: event.hours,
      type: event.type,
    }));

    return events; // Return the array of events
  } catch (error) {
    console.error("Unexpected error in getEventsWithTutorMonth:", error);
    return null;
  }
}

export async function createEvent(event: Event) {
  // Create a notification for the admin
  const { error: eventError } = await supabase.from("Events").insert({
    date: event.date,
    summary: event.summary,
    tutor_id: event.tutorId,
    hours: event.hours,
    type: event.type,
  });

  if (eventError) {
    throw eventError;
  }
}

export async function removeEvent(eventId: string): Promise<boolean> {
  try {
    // Validate eventId format
    if (!eventId || typeof eventId !== "string") {
      console.error("Invalid event ID provided:", eventId);
      return false;
    }

    // Attempt to delete the event
    const { data, error, count } = await supabase
      .from("Events")
      .delete()
      .eq("id", eventId)
      .select(); // Add this to get back the deleted record

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }

    // Check if any records were actually deleted
    if (!data || data.length === 0) {
      console.warn(`No event found with ID: ${eventId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove event:", error);
    throw error;
  }
}

/* NOTIFICATIONS */
export async function getAllNotifications(): Promise<Notification[] | null> {
  try {
    // Fetch meeting details from Supabase
    const { data, error } = await supabase.from("Notifications").select(`
        id,
        created_at,
        session_id,
        previous_date,
        suggested_date,
        tutor_id,
        student_id,
        status,
        summary
      `);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching notification details:", error.message);
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      console.log("No notifications found:");
      return null; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const notifications: Notification[] = await Promise.all(
      data.map(async (notification: any) => ({
        createdAt: notification.created_at,
        id: notification.id,
        summary: notification.summary,
        sessionId: notification.session_id,
        previousDate: notification.previous_date,
        suggestedDate: notification.suggested_date,
        student: await getProfileWithProfileId(notification.student_id),
        tutor: await getProfileWithProfileId(notification.tutor_id),
        status: notification.status,
      }))
    );

    return notifications; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    return null; // Valid return
  }
}

export const updateNotification = async (
  notificationId: string,
  status: "Active" | "Resolved"
) => {
  try {
    const { data, error } = await supabase
      .from("Notifications") // Adjust this table name to match your database
      .update({ status: status }) // Update the status field
      .eq("id", notificationId); // Assuming `id` is the primary key for the notifications table

    if (error) {
      throw error; // Handle the error as needed
    }

    return data; // Return the updated notification data or whatever is needed
  } catch (error) {
    console.error("Error updating notification:", error);
    throw new Error("Failed to update notification");
  }
};

export async function createPassword(length: number = 16): Promise<string> {
  // Character sets for password generation
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = lowercase + uppercase + numbers + symbols;

  // Use crypto.getRandomValues for cryptographically secure randomness
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let password = "";

  // Ensure at least one character from each character set
  const guaranteedChars = [
    lowercase[array[0] % lowercase.length],
    uppercase[array[1] % uppercase.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];

  // Fill remaining positions with random characters from all sets
  for (let i = 4; i < length; i++) {
    password += allChars[array[i] % allChars.length];
  }

  // Add guaranteed characters
  password += guaranteedChars.join("");

  // Shuffle the password to randomize guaranteed character positions
  return shuffleString(password);
}

function shuffleString(str: string): string {
  const array = str.split("");
  const randomArray = new Uint8Array(array.length);
  crypto.getRandomValues(randomArray);

  // Fisher-Yates shuffle with crypto random
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomArray[i] % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array.join("");
}
// function zonedTimeToUtc(arg0: any, arg1: string) {
//   throw new Error("Function not implemented.");
// }
