"use client";
import { Profile } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

export async function getProfileWithProfileId(
  profileId: string
): Promise<Profile | null> {
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
        phone_number,
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
      phoneNumber: data.phone_number,
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
