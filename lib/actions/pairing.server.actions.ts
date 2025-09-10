"use server";

import { Meeting, Profile } from "@/types";
import { SharedPairing } from "@/types/pairing";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";
import { getProfile } from "./user.actions";
import { createServerClient } from "../supabase/server";
import { getUserFromAction } from "./user.server.actions";
import { TutorMatchingNotificationEmailProps } from "@/components/emails/tutor-matching-notification";
import { IncomingPairingMatch } from "./pairing.actions";
import { NextResponse } from "next/server";
import { PairingLogSchemaType } from "../pairing/types";
import { getSupabase } from "../supabase-server/serverClient";
import { sendPairingEmail } from "./email.server.actions";
import { addEnrollment, createEnrollment } from "./admin.actions";
import { getOverlappingAvailabilites } from "./enrollment.actions";

export const getPairingFromEnrollmentId = async (enrollmentId: string) => {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error("Missing Supabase environment variables");
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase
      .from("Enrollments")
      .select("pairing_id")
      .eq("id", enrollmentId)
      .single();
    if (error) throw error;
    console.log(data);
    return data.pairing_id;
  } catch (error) {
    console.error("Unable to get pairing from enrollment", error);
    throw error;
  }
};

export async function getAccountPairings(userId: string) {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error("Missing Supabase environment variables");
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase.rpc(
      "get_user_pairings_with_profiles",
      {
        requestor_auth_id: userId,
      }
    );

    if (error) {
      console.error("Error fetching enrollments:", error);
      return null;
    }

    return data as SharedPairing[];
  } catch (error) {
    console.error("Unable to get account pairings", error);
    throw error;
  }
}

export const deleteAllPairingRequests = async () => {
  try {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error("Missing Supabase environment variables");
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete all rows from pairing_requests
    const { error: pairingRequestsError } = await supabase
      .from("pairing_requests")
      .delete()
      .not("id", "is", null);

    if (pairingRequestsError) {
      console.error("Error deleting pairing_requests:", pairingRequestsError);
    } else {
      console.log("All rows deleted from pairing_requests successfully");
    }

    // Delete all rows from pairing_matches
    const { error: pairingMatchesError } = await supabase
      .from("pairing_matches")
      .delete()
      .not("id", "is", null);

    if (pairingMatchesError) {
      console.error("Error deleting pairing_matches:", pairingMatchesError);
    } else {
      console.log("All rows deleted from pairing_matches successfully");
    }

    // Delete all rows from pairing_logs
    const { error: pairingLogsError } = await supabase
      .from("pairing_logs")
      .delete()
      .not("id", "is", null);

    if (pairingLogsError) {
      console.error("Error deleting pairing_logs:", pairingLogsError);
    } else {
      console.log("All rows deleted from pairing_logs successfully");
    }
  } catch (err: any) {
    console.error(err.message);
  }
};

export const resetPairingQueues = async () => {
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
  const { error } = await supabase
    .from("pairing_requests")
    .update({ status: "pending" })
    .not("id", "is", null); // forces Supabase to delete all rows

  if (error) {
    console.error("Error deleting rows:", error);
  } else {
    console.log("All rows deleted successfully");
  }
};

/**
 * Initiate pairing & sending out emails
 * @param matchId
 * @param status
 */
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
  const supabase = await getSupabase();

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

        const startDate = "";
        const endDate = "";

        //auto select first availability & create enrollment
        const result = await addEnrollment(
          {
            student: student as unknown as Profile,
            tutor: tutor as unknown as Profile,
            availability: availabilities,
            meetingId: "",
            summerPaused: false,
            duration: 60,
            startDate,
            endDate,
            summary: "Automatically Created Enrollment",
            frequency: "weekly",
          },
          true
        );
      }
    } else {
      console.warn("failed to automatically create enrollment");
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
