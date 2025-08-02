import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { config } from "@/config";
import { logZoomMetadata } from "@/lib/actions/zoom.server.actions";
import { getActiveSessionFromMeetingID } from "@/lib/actions/session.server.actions";

export const MEETING_ID_TO_SECRET: Record<string, string> = {
  "89d13433-04c3-48d6-9e94-f02103336554": config.zoom.ZOOM_LINK_A_WH_SECRET,
  "72a87729-ae87-468c-9444-5ff9b073f691": config.zoom.ZOOM_LINK_B_WH_SECRET,
  "26576a69-afe8-46c3-bc15-dec992989cdf": config.zoom.ZOOM_LINK_C_WH_SECRET,
  "83cd43b6-ca22-411c-a75b-4fb9c685295b": config.zoom.ZOOM_LINK_D_WH_SECRET,
  "8d61e044-135c-4ef6-83e8-9df30dc152f2": config.zoom.ZOOM_LINK_E_WH_SECRET,
  "fc4f7e3a-bb0f-4fc4-9f78-01ca022caf33": config.zoom.ZOOM_LINK_F_WH_SECRET,
  "132360dc-cad9-4d4c-88f8-3347585dfcf1": config.zoom.ZOOM_LINK_G_WH_SECRET,
  "f87f8d74-6dc4-4a6c-89b7-717df776715f": config.zoom.ZOOM_LINK_H_WH_SECRET,
  "c8e6fe57-59e5-4bbf-8648-ed6cac2df1ea": config.zoom.ZOOM_LINK_I_WH_SECRET,
};

export async function POST(
  req: NextRequest,
  { params }: { params: { meeting: string } }
) {
  console.log("Received Zoom webhook request");
  const body = await req.json();

  console.log("Request body:", body);

  const validationSecret = MEETING_ID_TO_SECRET[params.meeting];
  if (!validationSecret)
    return NextResponse.json({
      err: `failed to find credentials for meeting: ${params.meeting}`,
    });

  //  Handle Zoom's URL validation challenge
  if (body.event === "endpoint.url_validation") {
    const hashForValidate = crypto
      .createHmac("sha256", validationSecret)
      .update(body.payload.plainToken)
      .digest("hex");

    return NextResponse.json({
      plainToken: body.payload.plainToken,
      encryptedToken: hashForValidate,
    });
  }
  // Verify authorization header from Zoom
  const authHeader = req.headers.get("authorization");
  console.log(authHeader);
  if (authHeader !== `Bearer ${validationSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Authorization header verified");

  // Handle actual Zoom events
  const event = body?.event;
  const payload = body?.payload;

  const session = getActiveSessionFromMeetingID(params.meeting);

  switch (event) {
    case "meeting.started":
      console.log("Meeting started:", payload?.object?.id);
      break;

    case "meeting.participant_joined":
      {
        const participant = payload?.object?.participant;

        await logZoomMetadata({
          // id: uuidv4(),
          session_id: payload?.object?.id,
          user_name: participant?.user_name,
          participant_uuid: participant?.user_id,
          email: participant?.email,
          date_time: participant?.join_time ?? new Date().toISOString(),
        });
      }
      break;

    case "meeting.participant_left":
      {
        const participant = payload?.object?.participant;

        //Needs to be retested on new schema

        // const { error } = await supabase
        //   .from("session_participation")
        //   .update({
        //     leave_time: participant?.leave_time ?? new Date().toISOString(),
        //     leave_reason: participant?.leave_reason ?? null,
        //   })
        //   .eq("participant_uuid", participant?.user_id)
        //   .eq("session_id", payload?.object?.id);

        // if (error) {
        //   console.error("Error updating participant leave:", error);
        //   return new Response("Update failed", { status: 500 });
        // }

        // console.log("Participant left:", participant?.user_name);
      }
      break;

    default:
      console.log("Unhandled Zoom event:", event);
  }

  return NextResponse.json({ status: "received" });
}
