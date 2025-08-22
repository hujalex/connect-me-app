import { getProfileByEmail } from "@/lib/actions/user.actions";
import { Profile } from "@/types";
import { SupabaseAuthClient } from "@supabase/supabase-js/dist/module/lib/SupabaseAuthClient";
import { request } from "http";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { ideahub } from "googleapis/build/src/apis/ideahub";
import { getSupabase } from "@/lib/supabase-server/serverClient";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const { to, subject, body, sessionId } = await request.json();

    const { data: session, error: sessionError } = await supabase
      .from("Sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        status: 404,
        message: "Session no longer exists",
      });
    }

    if (session.status === "Cancelled") {
      return NextResponse.json({
        status: 400,
        message: "Session no longer active",
      });
    }

    const recipient: Profile = await getProfileByEmail(to);
    const { data: notification_settings, error } = await supabase
      .from("User_Notification_Settings")
      .select("email_tutoring_session_notifications_enabled")
      .eq("id", recipient.settingsId)
      .single();

    if (error) throw error;
    if (!notification_settings) throw new Error("No Notification Settings");

    if (notification_settings.email_tutoring_session_notifications_enabled) {
      await resend.emails.send({
        from: "Connect Me Free Tutoring & Mentoring <reminder@connectmego.app>",
        to: to,
        subject: subject,
        text: body,
      });
      return NextResponse.json({
        status: 200,
        message: "Email sent successfully",
      });
    }
    return NextResponse.json({
      status: 200,
      message: "Email setting turned off",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({
      status: 500,
      message: "Unable to send email or fetch email settings",
    });
  }
}
