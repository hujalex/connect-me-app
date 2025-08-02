import { z } from "zod";

// Define schema for Zoom webhook secrets
const ConfigSchema = z.object({
  zoom: z.object({
    ZOOM_LINK_A_WH_SECRET: z.string(),
    ZOOM_LINK_B_WH_SECRET: z.string(),
    ZOOM_LINK_C_WH_SECRET: z.string(),
    ZOOM_LINK_D_WH_SECRET: z.string(),
    ZOOM_LINK_E_WH_SECRET: z.string(),
    ZOOM_LINK_F_WH_SECRET: z.string(),
    ZOOM_LINK_G_WH_SECRET: z.string(),
    ZOOM_LINK_H_WH_SECRET: z.string(),
    ZOOM_LINK_I_WH_SECRET: z.string(),
  }),
});

// Load values from environment variables
export const config = {
  zoom: {
    ZOOM_LINK_A_WH_SECRET: process.env.ZOOM_LINK_A_WH_SECRET,
    ZOOM_LINK_B_WH_SECRET: process.env.ZOOM_LINK_B_WH_SECRET,
    ZOOM_LINK_C_WH_SECRET: process.env.ZOOM_LINK_C_WH_SECRET,
    ZOOM_LINK_D_WH_SECRET: process.env.ZOOM_LINK_D_WH_SECRET,
    ZOOM_LINK_E_WH_SECRET: process.env.ZOOM_LINK_E_WH_SECRET,
    ZOOM_LINK_F_WH_SECRET: process.env.ZOOM_LINK_F_WH_SECRET,
    ZOOM_LINK_G_WH_SECRET: process.env.ZOOM_LINK_G_WH_SECRET,
    ZOOM_LINK_H_WH_SECRET: process.env.ZOOM_LINK_H_WH_SECRET,
    ZOOM_LINK_I_WH_SECRET: process.env.ZOOM_LINK_I_WH_SECRET,
  },
} as z.infer<typeof ConfigSchema>;

// let validatedConfig: z.infer<typeof ConfigSchema>;

try {
  ConfigSchema.parse(config);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error("❌ Environment variable validation failed:");
    for (const issue of err.errors) {
      console.error(`→ [${issue.path.join(".")}] ${issue.message}`);
    }
    process.exit(1); // Exit early if required config is missing
  } else {
    throw err; // Unknown error
  }
}
