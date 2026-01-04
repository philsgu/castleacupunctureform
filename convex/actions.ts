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

        // 2. Create New PDF
        const newPdf = await PDFDocument.create();
        const templatePdf = await PDFDocument.load(PDF_TEMPLATE);

        // --- PAGE 1: SUMMARY ---
        const summaryPage = newPdf.addPage();
        const { width, height } = summaryPage.getSize(); // 612 x 792 for Letter
        const font = await newPdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold);

        let y = height - 50;
        const margin = 50;

        summaryPage.drawText(`Patient Intake Summary`, { x: margin, y, size: 18, font: boldFont });
        y -= 30;
        summaryPage.drawText(`Patient: ${args.firstName} ${args.lastName}   DOB: ${args.dob}`, { x: margin, y, size: 12, font: boldFont });
        y -= 25;

        const fontSize = 10;
        summaryPage.drawText("Form Data:", { x: margin, y, size: 12, font: boldFont });
        y -= 15;

        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('sig') || key === 'formData') continue;
            if (y < 250) break; // Leave room for footer

            const label = key.charAt(0).toUpperCase() + key.slice(1);
            const text = `${label}: ${value}`;
            summaryPage.drawText(text.substring(0, 90), { x: margin, y, size: fontSize, font });
            y -= 15;
        }

        // Certification
        y = 240;
        const certText = `I certify that the above information is complete and accurate to the best of my knowledge. If the health 
plan information is not accurate, or if I am not eligible to receive a healthcare benefit through this 
practitioner, I understand that I am liable for all charges for services. I agreed to notify this practitioner 
immediately whenever I have changes in my health condition or health plan coverage. I understand that 
my practitioner of acupuncture services needs to contact my primary care physician or treating physician 
if my condition needs to be comanaged. Therefore, I will give authorization to my practitioner of 
acupuncture services to contact my medical doctor if necessary.`;

        summaryPage.drawText(certText, { x: margin, y, size: 9, font, lineHeight: 12 });

        y = 100;
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

                page.drawText(finalStr, { x: left, y: y + (h / 4), size: 10, font });
            }
        };

        // --- PAGE 2 MAPPINGS ---
        // 1. Sig Patient (Top)
        await drawContent(page2, 'sig', 'sigTermsPatient', 87.74, 562.33, 91.29, 22.26);
        // 2. Date
        await drawContent(page2, 'date', null, 192.89, 558.92, 51.45, 22.26, null, 'sigTermsPatient');
        // 3. Sig Rep (Top)
        await drawContent(page2, 'sig', 'sigTermsRep', 322.99, 559.42, 104.69, 22.26);
        // 4. Date
        await drawContent(page2, 'date', null, 442.92, 559.22, 49.64, 23.26, null, 'sigTermsRep');
        // 5. Patient Name (Bottom)
        await drawContent(page2, 'text', 'patientName', 79.34, 627.9, 176.68, 17.97);
        // 6. Sig Patient (Bottom)
        await drawContent(page2, 'sig', 'sigPrivacyPatient', 88.49, 660.82, 95.79, 24.87);
        // 7. Date
        await drawContent(page2, 'date', null, 201.74, 660.56, 51.03, 24.87, null, 'sigPrivacyPatient');
        // 8. Sig Rep (Bottom)
        await drawContent(page2, 'sig', 'sigPrivacyRep', 321.12, 663.71, 112.79, 21.91);
        // 9. Date
        await drawContent(page2, 'date', null, 444.21, 663.28, 44.13, 21.49, null, 'sigPrivacyRep');

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
        await drawContent(page3, 'sig', 'sigArbPatient', 301.04, 661.99, 153.85, 18.68);
        // 5. Date
        await drawContent(page3, 'date', null, 492.18, 659.97, 73.36, 21.49, null, 'sigArbPatient');
        // 6. Parent/Guardian Name
        await drawContent(page3, 'text', null, 145.09, 683.79, 100.52, 23.15, data.arbGuardianName || "");
        // 7. Sig Guardian
        await drawContent(page3, 'sig', 'sigArbGuardian', 297.42, 685.38, 160.88, 21.81);
        // 8. Date
        await drawContent(page3, 'date', null, 494.03, 682.13, 79.08, 21.81, null, 'sigArbGuardian');
        // 9. Office Name
        await drawContent(page3, 'text', null, 93.47, 709.05, 153.75, 17.31, "Castle Acupuncture");
        // 10. Signature of Georgina (Office)
        await drawContent(page3, 'sig', 'sigArbOffice', 304.73, 710.89, 152.9, 16.63);
        // 11. Date
        await drawContent(page3, 'date', null, 493.93, 704.99, 77.19, 18.33, null, 'sigArbOffice');

        // --- PAGE 4 MAPPINGS (Consent) ---
        // 1. Patient Name (Top)
        await drawContent(page4, 'text', 'patientName', 137.95, 585.83, 416.15, 20.64);
        // 2. Acupuncture Name
        await drawContent(page4, 'text', null, 160.56, 636.79, 408.37, 20.64, "Georgina Castle, L.Ac");
        // 3. Patient Sig
        await drawContent(page4, 'sig', 'sigConsentPatient', 171.81, 688.98, 158.56, 23.31);
        // 4. Date
        await drawContent(page4, 'date', null, 372.03, 685.88, 112.65, 23.31, null, 'sigConsentPatient');


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
            reply_to: 'philsgu@icloud.com',
            cc: ['philsgu@icloud.com'],
            subject: `New Patient Intake: ${args.lastName}, ${args.firstName}`,
            html: `
        <h1>New Patient Intake Form Submitted</h1>
        <p><strong>Name:</strong> ${args.firstName} ${args.lastName}</p>
        <p><strong>DOB:</strong> ${args.dob}</p>
        <p><strong>Patient Email:</strong> ${patientEmail || "N/A"}</p>
        <p>A PDF copy of the intake packet is attached.</p>
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
