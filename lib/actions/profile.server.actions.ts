"use client";

import { Profile } from "@/types";
import { createClient } from "@supabase/supabase-js";

export async function getProfileWithProfileId(
  profileId: string
): Promise<Profile | null> {
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

  try {
    const { data, error } = await supabase
      .from("Profiles")
      .select(
        `
        id,
        created_at,
        role,
        user_id,
        first_name,
        last_name,
        date_of_birth,
        start_date,
        availability,
        email,
        parent_name,
        parent_phone,
        parent_email,
        tutor_ids,
        timezone,
        subjects_of_interest,
        status,
        student_number,
        settings_id
      `
      )
      .eq("id", profileId)
      .single();

    if (error) {
      console.error(
        "Error fetching profile in getProfileWithProfileId:",
        error.message
      );
      console.error("Error details:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Mapping the fetched data to the Profile object
    const userProfile: Profile = {
      id: data.id,
      createdAt: data.created_at,
      role: data.role,
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      // dateOfsBirth: data.date_of_birth,
      startDate: data.start_date,
      availability: data.availability,
      email: data.email,
      parentName: data.parent_name,
      parentPhone: data.parent_phone,
      tutorIds: data.tutor_ids,
      parentEmail: data.parent_email,
      timeZone: data.timezone,
      subjectsOfInterest: data.subjects_of_interest,
      status: data.status,
      studentNumber: data.student_number,
      settingsId: data.settings_id,
    };

    return userProfile;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}
interface UpdateProfileInput {
  profileId: string;
  availability?: { day: string; startTime: string; endTime: string }[];
  subjectsOfInterest?: string[];
  languagesSpoken?: string[]; // Make sure this exists in your DB
}
//{
// profileId,
//   availability,
//   subjectsOfInterest,
//   languagesSpoken,
// }

export async function updateProfileDetails(
  d: UpdateProfileInput
): Promise<{ success: boolean; error?: string }> {
  console.log("data: ", d);
  return;
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const updates: Record<string, any> = {};
  if (availability !== undefined) updates.availability = availability;
  if (subjectsOfInterest !== undefined)
    updates.subjects_of_interest = subjectsOfInterest;
  if (languagesSpoken !== undefined) updates.languages_spoken = languagesSpoken;

  const { error } = await supabase
    .from("Profiles")
    .update(updates)
    .eq("id", profileId);

  if (error) {
    console.error("Error updating profile:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}
