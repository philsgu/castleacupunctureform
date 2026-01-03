import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Changed to internalMutation so only Actions can call it
export const submit = internalMutation({
    args: {
        firstName: v.string(),
        lastName: v.string(),
        dob: v.string(),
        formData: v.any(),
    },
    handler: async (ctx, args) => {
        const newPatientId = await ctx.db.insert("patients", {
            firstName: args.firstName,
            lastName: args.lastName,
            dob: args.dob,
            submittedAt: new Date().toISOString(),
            formData: args.formData,
        });
        return newPatientId;
    },
});
