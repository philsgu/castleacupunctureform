import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    patients: defineTable({
        // Basic Info for easy querying
        firstName: v.string(),
        lastName: v.string(),
        dob: v.string(),
        submittedAt: v.string(),

        // Store the raw form data payload as a JSON object
        // This allows flexibility if form fields change without strict schema migrations every time
        formData: v.any(),
    }),
});
