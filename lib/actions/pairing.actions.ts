"use client";

import { PairingLog, PairingRequest, SharedPairing } from "@/types/pairing";
import { createClient } from "@supabase/supabase-js";
import { getProfile, getProfileRole, supabase } from "./user.actions";
import { getAccountEnrollments } from "./enrollments.action";
import { Table } from "../supabase/tables";
import { PairingLogSchemaType } from "../pairing/types";
import { Person } from "@/types/enrollment";
import { Availability, Profile } from "@/types";
import { ProfilePairingMetadata } from "@/types/profile";
import axios, { AxiosResponse } from "axios"; // Not used, can be removed
import { toast } from "react-hot-toast";
import { TutorMatchingNotificationEmailProps } from "@/components/emails/tutor-matching-notification";
import { sendPairingEmail } from "./email.server.actions";
import { addEnrollment } from "./admin.actions";
import { getOverlappingAvailabilites } from "./enrollment.actions";
import { getSupabase } from "../supabase-server/serverClient";
import { timeStrToHours } from "../utils";
import { number } from "zod";

export const getAllPairingRequests = async (
  profileType: "student" | "tutor"
) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.rpc("get_all_pairing_requests", {
    p_type: profileType,
  });

  return { data: data as PairingRequest[], error };
};

export const createPairingRequest = async (userId: string, notes: string) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  console.log(userId);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [profile, enrollments] = await Promise.all([
    getProfile(userId),
    getAccountEnrollments(userId),
  ]);

  console.log(enrollments);

  if (!enrollments) throw new Error("cannot locate account enrollments");
  if (!profile) throw new Error("failed to validate profile role");

  const priority = enrollments.length < 1 ? 1 : 2;

  //Check for current enrollments here to determine assigned priority ranking
  console.log("f -> ", {
    user_id: profile.id,
    type: profile.role.toLowerCase(),
    priority,
    notes,
  });

  const result = await supabase.from(Table.PairingRequests).insert([
    {
      user_id: profile.id,
      type: profile.role.toLowerCase(),
      priority,
      notes,
    },
  ]);

  if (!result.error) {
    supabase.from("pairing_logs").insert([
      {
        type: "pairing-que-entered",
        message: `${profile.firstName} ${profile.lastName} has entered the queue.`,
        error: false,
        metadata: {
          profile_id: profile.id,
        },
      } as PairingLogSchemaType,
    ]);
  }

  console.log("creation result: ", result);
};

export const acceptStudentMatch = () => {};

export const getPairingLogs = async (
  start_time: string,
  end_time: string
): Promise<PairingLog[]> => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: logs, error } = await supabase.rpc("get_pairing_logs", {
    start_time,
    end_time,
  });

  console.log("logs ", error);

  console.log("selected pairing logs: ", logs, "from ", start_time, end_time);

  return logs;
};

export type IncomingPairingMatch = {
  tutor: Person & ProfilePairingMetadata;
  student: Person & ProfilePairingMetadata;
  tutor_id: string;
  pairing_match_id: string;
  created_at: string;
};

export const getIncomingPairingMatches = async (profileId: string) => {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  console.log("PROFILE ID: ", profileId);
  const { data, error } = await supabase.rpc(
    "get_pairing_matches_with_profiles",
    {
      requestor: profileId,
    }
  );

  console.log("returned matches: ", data);

  return data;
};

export const deletePairing = async (tutorId: string, studentId: string) => {
  try {
    console.log(tutorId);
    console.log(studentId);

    const { data, error } = await supabase
      .from("Pairings")
      .delete()
      .eq("tutor_id", tutorId)
      .eq("student_id", studentId);

    if (error) throw error;
    console.log(data);

    console.log("Deleted");
  } catch (error) {
    console.error("Failed to delete pairing", error);
    throw error;
  }
};

export const handleResolveQueues = () => {
  const promise = axios.post("/api/pairing");
  toast.promise(promise, {
    success: "Successfully ran pairing process",
    error: "Failed to run pairing process",
    loading: "Pairing...",
  });
};

export const findAvailableSessionTimes = async () => {
  try {
    for (let i = 0; i < 1000; ++i) {}
  } catch (error) {}
};

// Function to convert time string to minutes since midnight
function timeToMinutes(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours * 60 + minutes + seconds / 60;
}

// Function to convert minutes back to time string
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes % 1) * 60);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// Main function to get average time floored to hours with 1-hour duration
function getAverageTimeWithDuration(
  startTime: string,
  endTime: string,
  day: string
): {
  startTime: string;
  endTime: string;
  day: string;
} {
  // Convert both times to minutes
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  // Calculate average
  const averageMinutes = (startMinutes + endMinutes) / 2;

  // Floor to nearest hour
  const flooredHour = Math.floor(averageMinutes / 60);
  const flooredStartMinutes = flooredHour * 60;

  // Add 1 hour for end time
  const flooredEndMinutes = flooredStartMinutes + 60;

  return {
    startTime: minutesToTime(flooredStartMinutes),
    endTime: minutesToTime(flooredEndMinutes),
    day: day,
  };
}

const isOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number
) => {
  try {
    return start1 < end2 && start2 < end1;
  } catch (error) {
    throw error;
  }
};

export const getAvailableMeetingLink = async (
  start: string,
  end: string,
  day: string
) => {
  try {
    console.log("Input:", { start, end, day });

    // Get all enrollments since we can't easily filter JSON arrays in Supabase
    const { data: allEnrollments, error } = await supabase
      .from("Enrollments")
      .select("meetingId, availability");

    if (error) throw error;

    console.log("All enrollments:", allEnrollments?.length);

    // Filter in JavaScript for arrays
    const availableMeetings =
      allEnrollments?.filter((enrollment) => {
        // Check if this enrollment has any availability slots for the requested day
        const daySlots = enrollment.availability.filter(
          (slot: { day: string }) => slot.day === day
        );

        if (daySlots.length === 0) {
          // No availability for this day - consider it available
          return true;
        }

        // Check if ALL slots for this day have no overlap with requested time
        const hasConflict = daySlots.some(
          (slot: { startTime: string; endTime: string }) => {
            // Two ranges overlap if: slot.start < end AND slot.end > start
            const overlap = slot.startTime < end && slot.endTime > start;
            return overlap;
          }
        );

        // Return true if NO conflict (available)
        return !hasConflict;
      }) || [];

    console.log(
      "Available meetings:",
      availableMeetings.map((m) => m.meetingId)
    );
    console.log(availableMeetings);
    return availableMeetings.length > 0 ? availableMeetings[0] : null;
  } catch (error) {
    console.error("Full error:", error);
    throw error;
  }
};

export const getAutoAvailableSessionTimes = async (
  start: string,
  end: string,
  day: string
) => {
  try {
    let autoAvailability = null;
    let meetingId = null;

    for (let i = 0; i < 10; ++i) {
      autoAvailability = await getAverageTimeWithDuration(start, end, day);
      meetingId = await getAvailableMeetingLink(
        autoAvailability.startTime,
        autoAvailability.endTime,
        autoAvailability.day
      );
      if (meetingId)
        return { availability: autoAvailability, meetingId: meetingId };
    }
    return null;
  } catch (error) {}
};

export const updatePairingMatchStatus = async (
  profileId: string,
  matchId: string,
  status: "accepted" | "rejected"
) => {
  // if (
  //   !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  //   !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // ) {
  //   throw new Error("Missing Supabase environment variables");
  // }
  // console.log("logs fine here!");
  // const supabase = await createServerClient();
  //
  const updateResponse = await supabase
    .from("pairing_matches")
    .update({ tutor_status: status })
    .eq("id", matchId)
    .eq("tutor_id", profileId);
  if (updateResponse.error) {
    console.log("ERROR: ", updateResponse.error);
  }

  const { data, error } = await supabase
    .rpc("get_pairing_match", {
      match_id: matchId,
    })
    .single();

  if (error) return console.error(error);
  const pairingMatch = data as IncomingPairingMatch;
  console.log("data", pairingMatch);
  const { student, tutor } = pairingMatch;
  if (status === "accepted") {
    // create new unique student tutor pairing
    const createdPairingResult = await supabase.from("Pairings").insert([
      {
        student_id: student.id,
        tutor_id: tutor.id,
      },
    ]);

    if (tutor.availability || student.availability) {
      const availabilities = await getOverlappingAvailabilites(
        tutor.availability!,
        student.availability!
      );

      if (availabilities) {
        const firstAvailability = availabilities[0];
        if (!firstAvailability) return;

        const autoAvailability = await getAutoAvailableSessionTimes(
          firstAvailability.startTime,
          firstAvailability.endTime,
          firstAvailability.day
        );

        console.log(autoAvailability);

        if (autoAvailability) {
          const result = await addEnrollment(
            {
              student: student as unknown as Profile,
              tutor: tutor as unknown as Profile,
              availability: [autoAvailability.availability],
              meetingId: "",
              summerPaused: false,
              duration: 1,
              startDate: new Date().toISOString(),
              endDate: null,
              summary: "Automatically Created Enrollment",
              frequency: "weekly",
            },
            true
          );
        } else {
          console.warn("failed to automatically create enrollment");
        }
      }

      //auto select first availability & create enrollment
    }

    const createdPairingError = createdPairingResult.error;
    if (createdPairingError) {
      if (createdPairingError?.code === "23505") {
        throw new Error("student - tutor pairing already exists");
      }
      console.error(createdPairingResult.error);
      throw new Error("failed to create pairings");
    }

    const emailData = {
      studentName: `${student.first_name} ${student.last_name}`,
      studentGender: student.gender ?? "male",
      parentName: `Parent Name`,
    } as TutorMatchingNotificationEmailProps;

    //send respective pairing email to student and tutor

    // if (status == "accepted") {
    //   await axios.post("/api/email/pairing?type=match-accepted", {
    //     emailType: "match-accepted",
    //     data: emailData,
    //   });
    // }

    console.log("student", student);
    // Replace the fetch with:
    await sendPairingEmail("match-accepted", emailData);

    const log = await supabase.from("pairing_logs").insert([
      {
        type: "pairing-match-accepted",
        message: `${tutor.first_name} ${tutor.last_name} has accepted ${student.first_name} ${student.last_name} as a student`,
        error: false,
        metadata: {
          profile_id: profileId,
        },
      } as PairingLogSchemaType,
    ]);

    console.log("LOG ", log);

    //reset tutor and student status to be auto placed in que
  } else if (status === "rejected") {
    const { data, error } = await supabase
      .from("pairing_requests")
      .update({
        status: "pending",
      })
      .in("user_id", [student.id, tutor.id]);

    console.log(data, error);
    if (!error)
      await supabase.from("pairing_logs").insert([
        {
          type: "pairing-match-rejected",
          message: `${tutor.first_name} ${tutor.last_name} has declined ${student.first_name} ${student.last_name} as a student`,
          error: false,
          metadata: {
            profile_id: profileId,
          },
        } as PairingLogSchemaType,
      ]);
  }
};
