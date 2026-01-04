import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Resend } from "resend";
import { Buffer } from "buffer";
import { PDF_TEMPLATE } from "./template";
import { OFFICE_SIG_BASE64 } from "./assets";

export const submitAndNotify = action({
    args: {
        firstName: v.string(),
        lastName: v.string(),
        dob: v.string(),
        formData: v.any(),
    },
    handler: async (ctx, args) => {
        console.log("RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);
        // 1. Save to Database
        const patientId = await ctx.runMutation(internal.patients.submit, {
            firstName: args.firstName,
            lastName: args.lastName,
            dob: args.dob,
            formData: args.formData,
        });

        const data = args.formData;

        // --- FIELD LABELS MAPPING ---
        const FIELD_LABELS: Record<string, string> = {
            firstName: "First Name",
            lastName: "Last Name",
            dob: "Birthdate",
            sex: "Sex",
            address: "Address",
            city: "City",
            state: "State",
            zip: "Zip",
            email: "Email",
            cellPhone: "Cell Phone",
            otherPhone: "Other Phone",
            language: "Primary Language",
            employer: "Employer",
            occupation: "Occupation",
            underCare: "Under care of physician?",
            physicianCondition: "Physician Condition",
            currentProblem: "Current health problem(s)",
            problemOnset: "How and When it began",
            treatment: "Treatment received",
            treatmentOtherText: "Other Treatment",
            workRelated: "Work related?",
            progress: "Progress So Far",
            painArea: "Current Pain Areas",
            painLevel: "Pain Level (0-10)",
            painInterference: "Interference with Daily Activities (0-10)",
            symptomFrequency: "Symptom Frequency",
            healthCondition: "General Health Condition",
            tobaccoUseRef: "Tobacco Use",
            tobaccoType: "Tobacco Type",
            tobaccoFrequency: "Tobacco Frequency",
            history: "Conditions",
            otherConditionText: "Other Condition",
            medications: "Medications",
            familyHistory: "Family History",
            familyHistoryRel_Cancer: "Cancer Relationship",
            familyHistoryRel_Heart: "Heart Disease Relationship",
            familyHistoryRel_Hypertension: "Hypertension Relationship",
            familyHistoryRel_Lupus: "Lupus Relationship",
            familyHistoryRel_Other: "Other History Relationship",
            familyHistoryOtherSpec: "Other History Condition",
            lastMenses: "Last Menses Date",
            isPatientSigner: "Is Patient the Signer?",
            privacyName: "Privacy Acknowledgement Name",
            retroactiveCoverage: "Retroactive Arbitration Coverage",
            arbitrationInitial: "Arbitration Initial",
            arbPatientName: "Arb Patient Name",
            arbGuardianName: "Arb Guardian Name",
            consentPatientName: "Consent Patient Name",
            consentRelationship: "Consent Relationship"
        };

        // --- UTILITY: Wrap Text ---
        const wrapText = (text: string, maxWidth: number, font: any, fontSize: number) => {
            // CRITICAL: Replace newlines/tabs with spaces to avoid PDF-Lib encoding errors
            const sanitized = text.replace(/[\n\r\t]+/g, ' ').trim();
            const words = sanitized.split(' ');
            const lines = [];
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const width = font.widthOfTextAtSize(testLine, fontSize);
                if (width > maxWidth) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        };

        // 2. Create New PDF
        const newPdf = await PDFDocument.create();
        const templatePdf = await PDFDocument.load(PDF_TEMPLATE);

        // --- PAGE 1: SUMMARY ---
        let summaryPage = newPdf.addPage();
        const { width, height } = summaryPage.getSize();
        const font = await newPdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold);

        let y = height - 50;
        const margin = 50;
        const contentWidth = width - 2 * margin;
        const fontSize = 10;
        const lineHeight = 14;

        // Helper: Format DOB as MM-DD-YYYY
        const formatDOB = (dob: string) => {
            if (!dob) return "N/A";
            const parts = dob.split('-');
            if (parts.length === 3) {
                return `${parts[1]}-${parts[2]}-${parts[0]}`;
            }
            return dob;
        };

        // Helper: Draw a section header
        const drawSectionHeader = (title: string) => {
            checkPageBreak(40);
            y -= 10;
            summaryPage.drawText(title, { x: margin, y, size: 12, font: boldFont });
            y -= 5;
            // Draw a line under the header
            summaryPage.drawLine({
                start: { x: margin, y },
                end: { x: margin + contentWidth, y },
                thickness: 0.5,
            });
            y -= 15;
        };

        // Helper: Draw a field (label + value)
        const drawField = (label: string, value: string | undefined | null) => {
            if (!value || value === 'undefined' || value === 'null') return;
            const sanitized = String(value).replace(/[\n\r\t]+/g, ' ').trim();
            checkPageBreak(lineHeight + 5);
            summaryPage.drawText(`${label}: `, { x: margin, y, size: fontSize, font: boldFont });
            const labelWidth = boldFont.widthOfTextAtSize(`${label}: `, fontSize);
            const valueLines = wrapText(sanitized, contentWidth - labelWidth, font, fontSize);
            summaryPage.drawText(valueLines[0], { x: margin + labelWidth, y, size: fontSize, font });
            y -= lineHeight;
            for (let i = 1; i < valueLines.length; i++) {
                checkPageBreak(lineHeight + 5);
                summaryPage.drawText(valueLines[i], { x: margin + labelWidth, y, size: fontSize, font });
                y -= lineHeight;
            }
        };

        // Helper: Draw a combined field (multiple values on one line)
        const drawCombinedField = (label: string, values: (string | undefined | null)[]) => {
            const combined = values.filter(v => v && v !== 'undefined' && v !== 'null').join(', ');
            if (!combined) return;
            drawField(label, combined);
        };

        // Helper to check for page break
        const checkPageBreak = (needed: number) => {
            if (y < needed) {
                summaryPage = newPdf.addPage();
                y = height - 50;
                return true;
            }
            return false;
        };

        // --- HEADER ---
        summaryPage.drawText(`Patient Intake Summary`, { x: margin, y, size: 18, font: boldFont });
        y -= 30;
        summaryPage.drawText(`Patient: ${args.firstName} ${args.lastName}   DOB: ${formatDOB(args.dob)}`, { x: margin, y, size: 12, font: boldFont });
        y -= 25;

        // --- SECTION 1: PATIENT DEMOGRAPHICS ---
        drawSectionHeader("Section 1: Patient Demographics");
        drawField("Name", `${args.firstName} ${args.lastName}`);
        drawField("Date of Birth", formatDOB(args.dob));
        drawField("Sex", data.sex);
        drawCombinedField("Address", [data.address, data.city, data.state, data.zip]);
        drawField("Email", data.email);
        drawField("Cell Phone", data.cellPhone);
        drawField("Other Phone", data.otherPhone);
        drawField("Primary Language", data.language);
        drawField("Employer", data.employer);
        drawField("Occupation", data.occupation);

        // --- SECTION 2: CURRENT CONDITION ---
        drawSectionHeader("Section 2: Current Condition");
        drawField("Under care of physician?", data.underCare);
        drawField("Physician Condition", data.physicianCondition);
        drawField("Current Health Problem(s)", data.currentProblem);
        drawField("How and When it began", data.problemOnset);
        drawCombinedField("Treatment received", Array.isArray(data.treatment) ? data.treatment : [data.treatment]);
        drawField("Other Treatment", data.treatmentOtherText);
        drawField("Work related?", data.workRelated);
        drawField("Progress So Far", data.progress);

        // --- SECTION 3: PAIN & SYMPTOMS ---
        drawSectionHeader("Section 3: Pain & Symptoms");
        drawCombinedField("Current Pain Areas", Array.isArray(data.painArea) ? data.painArea : [data.painArea]);
        drawField("Symptom Frequency", data.symptomFrequency);
        drawField("Pain Level (0-10)", data.painLevel);
        drawField("Interference with Daily Activities (0-10)", data.dailyInterference);

        // --- SECTION 4: MEDICAL HISTORY ---
        drawSectionHeader("Section 4: Medical History");
        drawField("General Health Condition", data.generalHealth);
        drawCombinedField("Conditions", Array.isArray(data.conditions) ? data.conditions : [data.conditions]);
        drawField("Other Condition", data.otherCondition);
        drawField("Medications", data.medications);
        drawField("Tobacco Use", data.tobaccoUseRef);
        drawField("Tobacco Type", data.tobaccoType);
        drawField("Tobacco Frequency", data.tobaccoFrequency);
        drawField("Last Menses Date (optional)", data.lastMenses);
        drawCombinedField("Family History", Array.isArray(data.familyHistory) ? data.familyHistory : [data.familyHistory]);
        // Family History Relationships
        drawField("Cancer Relationship", data.familyCancerRelation);
        drawField("Heart Disease Relationship", data.familyHeartRelation);
        drawField("Hypertension Relationship", data.familyHypertensionRelation);
        drawField("Other History Condition", data.familyHistoryOther);
        drawField("Other History Relationship", data.familyOtherRelation);

        // Certification
        checkPageBreak(180); // Increased threshold for safety
        y -= 10;
        const certText = `I certify that the above information is complete and accurate to the best of my knowledge. If the health 
plan information is not accurate, or if I am not eligible to receive a healthcare benefit through this 
practitioner, I understand that I am liable for all charges for services. I agreed to notify this practitioner 
immediately whenever I have changes in my health condition or health plan coverage. I understand that 
my practitioner of acupuncture services needs to contact my primary care physician or treating physician 
if my condition needs to be comanaged. Therefore, I will give authorization to my practitioner of 
acupuncture services to contact my medical doctor if necessary.`;

        const certFontSize = 9;
        const certLineHeight = 12;
        const approxLines = 7; // Fixed text block takes ~7 lines
        summaryPage.drawText(certText, { x: margin, y, size: certFontSize, font, lineHeight: certLineHeight });

        // Move y down by the height of the text block + some padding
        y -= (approxLines * certLineHeight) + 30;

        summaryPage.drawText("Patient signature ______________________________________________________ Date __________", { x: margin, y, size: 10, font: boldFont });

        if (data.sigTermsPatientData && data.sigTermsPatientData.startsWith('data:image/')) {
            const sigImage = await newPdf.embedPng(data.sigTermsPatientData.split(',')[1]);
            summaryPage.drawImage(sigImage, {
                x: margin + 100,
                y: y - 5,
                width: 150,
                height: 40
            });
            summaryPage.drawText(new Date().toLocaleDateString(), { x: margin + 430, y: y, size: 10, font });
        }

        // --- APPEND TEMPLATE PAGES (2, 3, 4) ---
        // User Specified Pages 2, 3, 4. In 0-indexed array, these are indices 1, 2, 3.
        const [page2, page3, page4] = await newPdf.copyPages(templatePdf, [1, 2, 3]);
        newPdf.addPage(page2);
        newPdf.addPage(page3);
        newPdf.addPage(page4);

        // --- MAPPING CONFIGURATION ---
        const pageHeight = 792;

        // Helper
        const drawContent = async (page: any, type: 'sig' | 'date' | 'text', key: string | null, left: number, top: number, w: number, h: number, textValue?: string, dateDependencyKey?: string) => {
            const y = pageHeight - (top + h); // Convert Top-Left layout to Bottom-Left Y

            if (type === 'sig' && key) {
                let sigData = null;
                if (key === 'sigArbOffice') {
                    sigData = OFFICE_SIG_BASE64;
                } else {
                    sigData = data[key + 'Data'];
                }

                if (sigData && sigData.startsWith('data:image/')) {
                    // Check if png or jpeg
                    let img;
                    if (sigData.includes('image/jpeg')) {
                        img = await newPdf.embedJpg(sigData.split(',')[1]);
                    } else {
                        img = await newPdf.embedPng(sigData.split(',')[1]);
                    }
                    page.drawImage(img, { x: left, y, width: w, height: h });
                }
            } else if (type === 'date') {
                // Date Dependency Logic
                let shouldDrawDate = true;
                if (dateDependencyKey) {
                    // Check if signature exists
                    let sigData = data[dateDependencyKey + 'Data'];
                    if (dateDependencyKey === 'sigArbOffice') {
                        sigData = OFFICE_SIG_BASE64;
                    }

                    if (!sigData || !sigData.startsWith('data:image/')) {
                        shouldDrawDate = false;
                    }
                }

                if (shouldDrawDate) {
                    const dateStr = new Date().toLocaleDateString();
                    page.drawText(dateStr, { x: left, y: y + (h / 4), size: 10, font });
                }
            } else if (type === 'text') {
                const txt = textValue || (key ? (data[key] || "") : "");
                // Construct full name if needed
                let finalStr = txt;
                if (key === 'patientName') finalStr = `${args.firstName} ${args.lastName}`;

                // CRITICAL: Replace newlines/tabs with spaces to avoid PDF-Lib encoding errors
                const sanitizedStr = String(finalStr).replace(/[\n\r\t]+/g, ' ').trim();

                page.drawText(sanitizedStr, { x: left, y: y + (h / 4), size: 10, font });
            }
        };

        // --- PAGE 2 MAPPINGS ---
        // 1. Sig Patient (Top)
        await drawContent(page2, 'sig', 'sigTermsPatient', 87.74, 562.33, 91.29, 22.26);
        // 2. Date
        await drawContent(page2, 'date', null, 192.89, 558.92, 51.45, 22.26, undefined, 'sigTermsPatient');
        // 3. Sig Rep (Top)
        await drawContent(page2, 'sig', 'sigTermsRep', 322.99, 559.42, 104.69, 22.26);
        // 4. Date
        await drawContent(page2, 'date', null, 442.92, 559.22, 49.64, 23.26, undefined, 'sigTermsRep');
        // 5. Patient Name (Bottom - Acknowledgement)
        await drawContent(page2, 'text', 'patientName', 79.34, 627.9, 176.68, 17.97);
        // 6. Sig Patient (Bottom - Acknowledgement)
        await drawContent(page2, 'sig', 'sigPrivacyPatient', 55.0, 666.77, 130.0, 20.0, undefined);
        // 7. Date (Patient Acknowledgement)
        await drawContent(page2, 'date', null, 180.0, 666.77, 60.0, 20.0, undefined, 'sigPrivacyPatient');
        // 8. Sig Rep (Bottom - Acknowledgement)
        await drawContent(page2, 'sig', 'sigPrivacyRep', 310.0, 666.77, 120.0, 20.0, undefined);
        // 9. Date (Rep Acknowledgement)
        await drawContent(page2, 'date', null, 480.0, 666.77, 60.0, 20.0, undefined, 'sigPrivacyRep');

        // --- PAGE 3 MAPPINGS (Arbitration) ---
        // 1. Patient Name (Top)
        await drawContent(page3, 'text', 'patientName', 118.36, 31.1, 404.51, 21.81);
        // 2. Initial (Retroactive)
        await drawContent(page3, 'text', 'arbitrationInitial', 183.22, 541.72, 28.5, 13.78);
        // 3. Patient Name (Signature area) - Keep this? The user didn't say delete. 
        // But usually these requests are complete for that field. 
        // Actually, let's update the one at 120.38 to the new one and see.
        // Wait, 31.1 top is definitely the top of the page. 
        // Let's keep the existing signature area name too just in case.
        await drawContent(page3, 'text', 'patientName', 120.38, 662.06, 125.21, 18.68);

        // 4. Sig Patient
        await drawContent(page3, 'sig', 'sigArbPatient', 304.83, 662.5, 151.7, 18.06, undefined);
        // 5. Date
        await drawContent(page3, 'date', null, 492.18, 662.5, 73.36, 21.49, undefined, 'sigArbPatient');
        // 6. Parent/Guardian Name
        await drawContent(page3, 'text', null, 145.09, 684.0, 100.52, 23.15, data.arbGuardianName || "");
        // 7. Sig Guardian
        await drawContent(page3, 'sig', 'sigArbGuardian', 297.42, 684.0, 160.88, 21.81);
        // 8. Date
        await drawContent(page3, 'date', null, 494.03, 684.0, 79.08, 21.81, undefined, 'sigArbGuardian');
        // 9. Office Name
        await drawContent(page3, 'text', null, 93.47, 709.05, 153.75, 17.31, "Castle Acupuncture");
        // 10. Signature of Georgina (Office)
        await drawContent(page3, 'sig', 'sigArbOffice', 304.73, 710.89, 152.9, 16.63);
        // 11. Date
        await drawContent(page3, 'date', null, 493.93, 704.99, 77.19, 18.33, undefined, 'sigArbOffice');

        // --- PAGE 4 MAPPINGS (Consent) ---
        // 1. Patient Name (Top)
        await drawContent(page4, 'text', 'patientName', 137.95, 585.83, 416.15, 20.64);
        // 2. Acupuncture Name
        await drawContent(page4, 'text', null, 160.56, 636.79, 408.37, 20.64, "Georgina Castle, L.Ac");
        // 3. Patient Sig
        await drawContent(page4, 'sig', 'sigConsentPatient', 171.81, 688.98, 158.56, 23.31);
        // 4. Date
        await drawContent(page4, 'date', null, 372.03, 685.88, 112.65, 23.31, undefined, 'sigConsentPatient');


        const pdfBytes = await newPdf.save();
        const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        const pdfBuffer = Buffer.from(pdfBytes);

        // 3. Send Email
        const resend = new Resend(process.env.RESEND_API_KEY);

        let toEmail = "philsgu@icloud.com";
        const patientEmail = data.email;
        if (patientEmail && patientEmail.includes('@')) {
            toEmail = patientEmail;
        }

        const { error } = await resend.emails.send({
            from: 'Castle Acupuncture <no-reply@castleacupuncture.com>',
            to: [toEmail],
            replyTo: 'philsgu@icloud.com',
            cc: ['philsgu@icloud.com'],
            subject: `Confirmation: New Patient Paperwork`,
            html: `
        <p>Hello! Thank you for choosing Castle Acupuncture.</p>
        <p>Attached is a copy of the intake form you recently submitted. If any of this information changes or requires a correction, please contact me at <a href="mailto:georginatcm@gmail.com">georginatcm@gmail.com</a>.</p>
        <p>I look forward to seeing you soon and supporting your health and wellness.</p>
        <p>Sincerely,</p>
        <p>Georgina Castle, DACM, MPH</p>
      `,
            attachments: [
                {
                    filename: `Intake_${args.lastName}_${args.firstName}.pdf`,
                    content: pdfBase64,
                },
            ],
        });

        if (error) {
            console.error("Resend Failure Details:", JSON.stringify(error, null, 2));
            // Throw with the exact message from Resend
            throw new Error(`Resend Failed: ${error.name} - ${error.message}`);
        }

        return { patientId, status: "sent" };
    },
});
