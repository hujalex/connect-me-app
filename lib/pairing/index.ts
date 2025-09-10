import { PairingMatch } from "@/types/pairing";
import { createClient } from "../supabase/server";
import { Table } from "../supabase/tables";
import { Person } from "@/types/enrollment";
import { PairingLogSchemaType } from "./types";

type QueueItem = {
  pairing_request_id: string;
  profile_id: string;
};

type PairingRequests = {};

type QueueItemMatch = QueueItem & {
  similarity: number;
  match_profile: Person;
  requestor_profile: Person;
};

export const runPairingWorkflow = async () => {
  console.log("STARTING PAIRING WORKFLOW");
  const supabase = createClient();

  const updatePairingStatus = (requestId: string, status: "paired") =>
    supabase.from("pairing_requests").update({ status }).eq("id", requestId);

  const logs: PairingLogSchemaType[] = [];

  // Get top pairing requests for tutors & students
  const [tutorQueueResult, studentQueueResult] = await Promise.all([
    supabase.rpc("get_top_pairing_request", { request_type: "tutor" }),
    supabase.rpc("get_top_pairing_request", { request_type: "student" }),
  ]);

  const [tutorQueue, studentQueue] = [
    tutorQueueResult.data ?? [],
    studentQueueResult.data ?? [],
  ] as [QueueItem[], QueueItem[]];

  // console.log("tutorQueue:", tutorQueue);
  // console.log("studentQueue:", studentQueue);

  // Helper to shuffle a queue

  // Alternate pairing: student, tutor, student, tutor
  const maxLength = Math.max(studentQueue.length, tutorQueue.length);

  //matches tutors  for students
  const studentMatches: QueueItemMatch[] = [];
  //matched students for tutors
  const tutorMatches: QueueItemMatch[] = [];

  for (let i = 0; i < maxLength; i++) {
    if (i < studentQueue.length) {
      const studentReq = studentQueue[i];
      const { data, error } = await supabase
        .rpc("get_best_match", {
          request_type: "student",
          request_id: studentReq.pairing_request_id,
        })
        .single();

      console.log("call error: ", error);
      const result = data as QueueItemMatch;
      console.log("r: ", result);
      if (result) {
        const { requestor_profile, match_profile } = result;
        console.log("r: ", result);
        logs.push({
          message: `${requestor_profile.first_name} ${requestor_profile.last_name} Matched With ${match_profile?.first_name} 
          ${match_profile?.first_name}`,
          type: "pairing-match",
          error: false,
          metadata: {
            pairing_request_id: studentReq.pairing_request_id,
            match_profile_id: result.match_profile.id,
          },
        });
        await updatePairingStatus(studentReq.pairing_request_id, "paired");
        studentMatches.push(result);

        // logs.push({
        //   message: "Pairing "
        // })
        // console.log("pairing request log: ", r);
      } else {
        logs.push({
          message: "Failed to find pairing",
          type: "pairing-selection-failed",
          error: true,
          metadata: {
            pairing_request_id: studentReq.pairing_request_id,
          },
        });
      }

      console.log("Student match:", result);
    }

    if (i < tutorQueue.length) {
      const tutorReq = tutorQueue[i];
      const { data } = await supabase
        .rpc("get_best_match", {
          request_type: "tutor",
          request_id: tutorReq.pairing_request_id,
        })
        .single();
      const result = data as QueueItemMatch;
      console.log("Tutor match:", data);
      if (result as QueueItemMatch) {
        await updatePairingStatus(tutorReq.pairing_request_id, "paired");
        tutorMatches.push(result as QueueItemMatch);
        logs.push({
          message: `Matched With ${result.match_profile.first_name} 
          ${result.match_profile.first_name}`,
          type: "pairing-match",
          error: false,
          metadata: {
            pairing_request_id: tutorReq.pairing_request_id,
            match_profile_id: result.match_profile.id,
          },
        });
      } else {
        logs.push({
          message: "Failed to find pairing",
          type: "pairing-selection-failed",
          error: true,
          metadata: {
            pairing_request_id: tutorReq.pairing_request_id,
          },
        });
      }
    }
  }
  console.log("LOGS: ", logs);
  console.log("MATCHES", tutorMatches);
  console.log("STUDENT MATCHES: ", studentMatches);

  const matchedStudents: PairingMatch[] = studentMatches.map(
    (match) =>
      ({
        student_id: match.requestor_profile.id,
        tutor_id: match.match_profile.id,
        similarity: match.similarity,
      }) as PairingMatch
  );

  const matchedTutors: PairingMatch[] = tutorMatches.map(
    (match) =>
      ({
        student_id: match.match_profile.id,
        tutor_id: match.requestor_profile.id,
        similarity: match.similarity, // or another default/status as appropriate
      }) as PairingMatch
  );

  console.log(matchedTutors, matchedStudents);

  const r1 = await supabase
    .from("pairing_matches")
    .insert(
      [...matchedStudents, ...matchedTutors].filter(
        ({ similarity }) => similarity
      )
    );
  const r2 = await supabase
    .from("pairing_logs")
    .insert(logs.filter((log) => !log.error));
  console.log(r1, r2);
  console.log("PAIRINGS ENDING");
};
