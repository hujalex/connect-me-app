"use server";
import { Meeting } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "../supabase-server/serverClient";

export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const supabase = getSupabase();
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
      console.log("No events found:");
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
