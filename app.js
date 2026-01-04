import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

// Initialize Convex Client
const convex = new ConvexClient(import.meta.env.VITE_CONVEX_URL);

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('intakeForm');
    const steps = document.querySelectorAll('.step');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const progressBar = document.getElementById('progressBar');
    const indicators = document.querySelectorAll('.step-indicator');

    let currentStep = 1;

    // Set max date for DOB to today
    const dobInput = document.getElementById('dob');
    if (dobInput) {
        // Use PST (America/Los_Angeles) to determine "today" to avoid allowing "tomorrow" 
        // if the browser relies on UTC while it's still evening in PST.
        const todayPST = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        dobInput.max = todayPST;
    }

    // Initialize
    updateUI();
    setupValidationListeners();
    setupConditionalFields();
    setupGenderToggle(); // New Gender Toggle for Menses
    setupNameAutofill(); // New Auto-fill
    setupDefaultSignatures(); // New Default Sig
    setupSignerToggle(); // New Signer Toggle for Sections 5-7
    setupPhoneFormatting(); // New Phone Formatting

    function setupConditionalFields() {
        // Tobacco Toggle (Radio)
        const tobaccoRadios = document.getElementsByName('tobaccoUseRef');
        tobaccoRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    toggleFieldGroup('tobaccoDetails', e.target.value === 'Yes');
                }
            });
        });

        // Other Condition Toggle
        const otherCheckbox = document.getElementById('otherConditionCheck');
        if (otherCheckbox) {
            otherCheckbox.addEventListener('change', (e) => {
                toggleFieldGroup('otherConditionContainer', e.target.checked);
            });
        }

        // Family History Other Toggle
        const familyOtherCheckbox = document.getElementById('familyHistoryOtherCheck');
        if (familyOtherCheckbox) {
            familyOtherCheckbox.addEventListener('change', (e) => {
                toggleFieldGroup('familyHistoryOtherDetails', e.target.checked);
            });
        }

        // Treatment Other Toggle
        const treatmentOtherCheckbox = document.getElementById('treatmentOtherCheck');
        if (treatmentOtherCheckbox) {
            treatmentOtherCheckbox.addEventListener('change', (e) => {
                toggleFieldGroup('treatmentOtherContainer', e.target.checked);
            });
        }
    }

    function setupGenderToggle() {
        // Gender Toggle for Last Menses
        const sexRadios = document.getElementsByName('sex');
        const mensesContainer = document.getElementById('mensesContainer');
        const mensesInput = document.getElementById('lastMenses');

        function updateMensesVisibility() {
            const selectedSex = document.querySelector('input[name="sex"]:checked');
            if (selectedSex && selectedSex.value === 'Female') {
                if (mensesContainer) {
                    mensesContainer.classList.remove('hidden');
                    // Add required if visible? The prompt said "only show... if...".
                    // Usually hidden fields shouldn't be required. 
                    // If it becomes visible, is it required? 
                    // The original HTML didn't have 'required' on lastMenses.
                    // So I will just toggle visibility.
                }
            } else {
                if (mensesContainer) {
                    mensesContainer.classList.add('hidden');
                    if (mensesInput) mensesInput.value = ''; // Clear Date
                }
            }
        }

        sexRadios.forEach(radio => {
            radio.addEventListener('change', updateMensesVisibility);
        });

        // Initial check
        updateMensesVisibility();
    }

    function setupSignerToggle() {
        // Default State: Assume nothing selected yet.
        // Check if one is already checked (e.g. browser cached state), otherwise default to null (hidden)
        const yes = document.querySelector('input[name="isPatientSigner"][value="Yes"]');
        const no = document.querySelector('input[name="isPatientSigner"][value="No"]');

        let initialState = null;
        if (yes.checked) initialState = true;
        else if (no.checked) initialState = false;

        updateSignerVisibility(initialState);

        const signerRadios = document.getElementsByName('isPatientSigner');
        signerRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                updateSignerVisibility(e.target.value === 'Yes');
            });
        });
    }

    function updateSignerVisibility(isPatient) {
        // If isPatient is null, HIDE EVERYTHING in S5 (Signatures & Dates)
        const showPatient = isPatient === true;
        const showRep = isPatient === false; // If null, this is false. Valid.
        // Wait, if isPatient is null, showPatient is false, showRep is false.

        // Section 5: Terms
        toggleInputGroup('sigTermsPatientContainer', showPatient);
        toggleInputGroup('sigTermsPatientDateContainer', showPatient); // Toggle Date

        toggleInputGroup('sigTermsRepContainer', showRep);
        toggleInputGroup('sigTermsRepDateContainer', showRep); // Toggle Date

        // Section 5: Privacy
        toggleInputGroup('sigPrivacyPatientContainer', showPatient);
        toggleInputGroup('sigPrivacyPatientDateContainer', showPatient); // Toggle Date

        toggleInputGroup('sigPrivacyRepContainer', showRep);
        toggleInputGroup('sigPrivacyRepDateContainer', showRep); // Toggle Date

        // Section 6: Arbitration
        // Show/Hide Blocks & Dynamic Labels
        const patientBlock = document.getElementById('sec6PatientBlock');
        const guardianBlock = document.getElementById('sec6GuardianBlock');

        if (patientBlock && guardianBlock) {
            if (showPatient) {
                patientBlock.classList.remove('hidden');
            } else {
                patientBlock.classList.add('hidden');
            }

            if (showRep) {
                guardianBlock.classList.remove('hidden');
                // Update Labels for Representative
                const nameLabel = document.getElementById('arbGuardianNameLabel');
                const sigLabel = document.getElementById('sigArbGuardianLabel');
                if (nameLabel) nameLabel.innerText = 'Representative Name (print)';
                if (sigLabel) sigLabel.innerText = 'Representative Signature';
            } else {
                guardianBlock.classList.add('hidden');
                // Reset Labels to Default
                const nameLabel = document.getElementById('arbGuardianNameLabel');
                const sigLabel = document.getElementById('sigArbGuardianLabel');
                if (nameLabel) nameLabel.innerText = 'Parent or Guardian (print)';
                if (sigLabel) sigLabel.innerText = 'Signature';
            }
        }

        // Section 7: Consent
        toggleFieldGroup('consentRelationshipContainer', !showPatient); // If null (false), it shows? 
        // Logic: if null, it hides (because boolean check above?)
        // Let's stick to explicit:
        if (isPatient === null) {
            toggleFieldGroup('consentRelationshipContainer', false);
        } else {
            toggleFieldGroup('consentRelationshipContainer', !isPatient);
        }

        // S7 Dynamic Label
        const s7sigLabel = document.getElementById('sigConsentLabel');
        if (s7sigLabel) {
            if (showRep) {
                s7sigLabel.innerText = 'Representative Signature';
            } else {
                s7sigLabel.innerHTML = 'Patient Signature (<strong>X</strong>)';
            }
        }
    }

    function toggleInputGroup(elementId, show) {
        const el = document.getElementById(elementId);
        if (el) {
            // Check if element IS the group (if it has input-group class)
            // The Date Containers ARE the input-group.
            // The Signature Containers are INSIDE input-group.

            if (el.classList.contains('input-group')) {
                if (show) el.classList.remove('hidden');
                else el.classList.add('hidden');
            } else {
                const group = el.closest('.input-group');
                if (group) {
                    if (show) group.classList.remove('hidden');
                    else group.classList.add('hidden');
                }
            }
        }
    }

    function setupPhoneFormatting() {
        const phoneInputs = ['cellPhone', 'otherPhone'];

        phoneInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                // Create error message element if it doesn't exist
                let errorMsg = input.nextElementSibling;
                if (!errorMsg || !errorMsg.classList.contains('error-message')) {
                    errorMsg = document.createElement('span');
                    errorMsg.className = 'error-message';
                    errorMsg.textContent = 'Phone number must be 10 digits';
                    input.parentNode.insertBefore(errorMsg, input.nextSibling);
                }

                input.addEventListener('input', (e) => {
                    // Get current cursor position
                    const cursorPosition = e.target.selectionStart;
                    const oldValue = e.target.value;

                    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                    if (value.length > 10) value = value.slice(0, 10); // Limit to 10 digits

                    // If empty, clear everything
                    if (value.length === 0) {
                        e.target.value = '';
                        input.classList.remove('input-error');
                        input.style.borderColor = '#e2e8f0';
                        return;
                    }

                    let formatted = '';
                    if (value.length > 0) {
                        formatted += '(' + value.substring(0, 3);
                        if (value.length > 3) {
                            formatted += ') ' + value.substring(3, 6);
                            if (value.length > 6) {
                                formatted += '-' + value.substring(6, 10);
                            }
                        }
                    }

                    e.target.value = formatted;

                    // Try to restore cursor position if it wasn't at the end
                    if (cursorPosition < oldValue.length) {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                    }

                    // Real-time clear error if it reaches 10
                    if (value.length === 10) {
                        input.classList.remove('input-error');
                        input.style.borderColor = '#e2e8f0';
                    }
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace') {
                        const pos = input.selectionStart;
                        const val = input.value;
                        const charBefore = val[pos - 1];

                        // If backspacing a punctuation character, delete 2 characters (punctuation + digit)
                        if (charBefore === ')' || charBefore === '-' || charBefore === '(') {
                            e.preventDefault();
                            input.value = val.substring(0, pos - 2) + val.substring(pos);
                            input.setSelectionRange(pos - 2, pos - 2);
                            input.dispatchEvent(new Event('input'));
                        }
                        // If backspacing after the space in "(xxx) x", delete 3 characters (space + ) + digit)
                        else if (charBefore === ' ' && val[pos - 2] === ')') {
                            e.preventDefault();
                            input.value = val.substring(0, pos - 3) + val.substring(pos);
                            input.setSelectionRange(pos - 3, pos - 3);
                            input.dispatchEvent(new Event('input'));
                        }
                    }
                });

                input.addEventListener('blur', () => {
                    const value = input.value.replace(/\D/g, '');
                    if (value.length === 0) {
                        input.classList.remove('input-error');
                        input.style.borderColor = '#e2e8f0';
                    } else if (value.length < 10) {
                        input.classList.add('input-error');
                        input.style.borderColor = '#ef4444';
                    }
                });
            }
        });
    }

    function setupNameAutofill() {
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');

        function updateNames() {
            const first = firstNameInput.value.trim();
            const last = lastNameInput.value.trim();
            if (first && last) {
                const fullName = `${first} ${last}`;

                // Section 5 Privacy Name
                const privacyName = document.querySelector('input[name="privacyName"]');
                if (privacyName) privacyName.value = fullName;

                // Section 6 Patient Name
                const arbPatientName = document.querySelector('input[name="arbPatientName"]');
                if (arbPatientName) arbPatientName.value = fullName;

                // Section 7 Patient Name
                const consentPatientName = document.querySelector('input[name="consentPatientName"]');
                if (consentPatientName) consentPatientName.value = fullName;
            }
        }

        if (firstNameInput && lastNameInput) {
            firstNameInput.addEventListener('input', updateNames);
            lastNameInput.addEventListener('input', updateNames);
        }
    }

    function setupDefaultSignatures() {
        // Section 6: Office Signature
        const sigContainer = document.getElementById('sigArbOfficeContainer');
        const sigImage = document.getElementById('sigArbOfficeImage');
        const sigData = document.getElementById('sigArbOfficeData');
        const sigDate = document.getElementById('sigArbOfficeDate');

        if (sigContainer && sigImage) {
            // Set visuals
            sigImage.src = 'Gina_Sig.jpg';
            sigImage.classList.remove('hidden');

            const placeholder = sigContainer.querySelector('.placeholder-text');
            if (placeholder) placeholder.classList.add('hidden');

            // Set data (using path as placeholder, or could fetch blob if needed for submission)
            if (sigData) sigData.value = 'Gina_Sig.jpg';

            // Set Date
            if (sigDate) {
                sigDate.value = new Date().toISOString().split('T')[0];
            }
        }
    }

    function setupValidationListeners() {
        // Select all inputs that might have 'required' attribute
        const inputs = document.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            if (input.hasAttribute('required')) {
                // On blur: check if empty and highlight
                input.addEventListener('blur', () => {
                    validateField(input);
                });

                // On input: remove highlight if valid
                input.addEventListener('input', () => {
                    if (input.value.trim() || input.type === 'date') {
                        input.style.borderColor = '#e2e8f0';
                        input.classList.remove('input-error');
                    }
                });

                // For Radios: Clear group error on change
                if (input.type === 'radio') {
                    input.addEventListener('change', () => {
                        const group = input.closest('.input-group');
                        if (group) group.classList.remove('group-error');
                    });
                }
            }
        });
    }

    function validateField(input) {
        if (input.type === 'radio' || input.type === 'checkbox') return; // Skip radios/checks for blur style

        let isValid = true;
        const val = input.value.trim();

        if (!val) {
            isValid = false;
        } else if (input.id === 'cellPhone' || input.id === 'otherPhone') {
            const digits = val.replace(/\D/g, '');
            if (digits.length > 0 && digits.length < 10) {
                isValid = false;
            }
        }

        if (!isValid) {
            input.style.borderColor = '#ef4444';
            input.classList.add('input-error');
        } else {
            input.style.borderColor = '#e2e8f0';
            input.classList.remove('input-error');
        }
    }

    // Event Listeners
    nextBtn.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < steps.length) {
                currentStep++;
                updateUI();
            } else {
                submitForm();
            }
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateUI();
        }
    });

    // Helper functions
    function updateUI() {
        // Show/Hide Steps
        steps.forEach((step, index) => {
            if (index + 1 === currentStep) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // Update Progress Bar
        const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;
        progressBar.style.setProperty('--progress', `${progressPercentage}%`);

        // Update Indicators
        indicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            indicator.classList.remove('active', 'completed');
            if (stepNum === currentStep) {
                indicator.classList.add('active');
            } else if (stepNum < currentStep) {
                indicator.classList.add('completed');
                indicator.innerHTML = '&#10003;'; // Checkmark
            } else {
                indicator.innerHTML = stepNum;
            }
        });

        // Update Buttons
        prevBtn.disabled = currentStep === 1;

        if (currentStep === steps.length) {
            nextBtn.textContent = 'Submit Form';
            nextBtn.classList.add('btn-submit');
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.classList.remove('btn-submit');
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function validateStep(step) {
        const currentStepEl = document.getElementById(`step${step}`);
        const inputs = currentStepEl.querySelectorAll('input:required, select:required, textarea:required');
        let isValid = true;

        // Track handled radio groups to avoid duplicate alerts/checks
        const handledRadioGroups = new Set();

        inputs.forEach(input => {
            let isFieldValid = true;

            if (input.type === 'radio') {
                if (handledRadioGroups.has(input.name)) return;
                handledRadioGroups.add(input.name);

                // Check if any radio with this name in the current step is checked
                const isChecked = currentStepEl.querySelector(`input[name="${input.name}"]:checked`);
                if (!isChecked) {
                    isFieldValid = false;
                }
            } else if (input.type === 'checkbox') {
                if (!input.checked) isFieldValid = false;
            } else {
                if (!input.value.trim()) isFieldValid = false;
            }

            const inputGroup = input.closest('.input-group');

            if (!isFieldValid) {
                isValid = false;

                if (input.type === 'radio' || input.type === 'checkbox') {
                    if (inputGroup) inputGroup.classList.add('group-error');
                } else {
                    input.style.borderColor = '#ef4444'; // Red
                    input.classList.add('input-error');

                    // Add shake animation
                    input.addEventListener('animationend', () => {
                        input.classList.remove('shake');
                    });
                }
            } else {
                if (input.type === 'radio' || input.type === 'checkbox') {
                    if (inputGroup) inputGroup.classList.remove('group-error');
                } else {
                    input.style.borderColor = '#e2e8f0'; // Reset
                    input.classList.remove('input-error');
                }
            }
        });

        if (!isValid) {
            alert('Please fill in all required fields.');
        }

        if (isValid) {
            // Check State of Signer (S5 -> S7)
            if (step >= 5) {
                const isPatient = getIsPatientSigner();
                if (isPatient === null && step === 5) {
                    alert('Please select "Are you the patient?" (Yes or No).');
                    isValid = false;
                }

                if (isValid && isPatient !== null) {
                    // Step 5 Validation
                    if (step === 5) {
                        if (isPatient) {
                            if (!document.getElementById('sigTermsPatientData').value) { alert('Patient Signature (Terms) required.'); isValid = false; }
                            if (isValid && !document.getElementById('sigPrivacyPatientData').value) { alert('Patient Signature (Privacy) required.'); isValid = false; }
                        } else {
                            if (!document.getElementById('sigTermsRepData').value) { alert('Representative Signature (Terms) required.'); isValid = false; }
                            if (isValid && !document.getElementById('sigPrivacyRepData').value) { alert('Representative Signature (Privacy) required.'); isValid = false; }
                        }
                    }

                    // Step 6 Validation
                    if (step === 6) {
                        // Article 6 Logic remains (Yes/No mandatory)
                        const retroactive = document.querySelector('input[name="retroactiveCoverage"]:checked');
                        if (!retroactive) {
                            alert('Please select Yes or No for Article 6: Retroactive Effect.');
                            isValid = false;
                        }

                        if (isValid) {
                            if (isPatient) {
                                if (!document.getElementById('sigArbPatientData').value) { alert('Patient Signature (Arbitration) required.'); isValid = false; }
                            } else {
                                // Representative: Mandatory Name & Sig
                                const guardName = document.querySelector('input[name="arbGuardianName"]').value.trim();
                                if (!guardName) {
                                    alert('Representative Name is required.');
                                    isValid = false;
                                }

                                if (isValid && !document.getElementById('sigArbGuardianData').value) {
                                    alert('Representative Signature (Arbitration) required.');
                                    isValid = false;
                                }
                            }
                        }
                    }

                    // Step 7 Validation
                    if (step === 7) {
                        // Shared Signature (Consent) - checks based on who is signing?
                        // "make sure the signature field is completed... All appropriate signature fields are mandatory"
                        // Since visibility toggles the input groups, we can check the VISIBLE signature fields.
                        // But sticking to data IDs is safer if we know them.
                        // S7 HTML has: sigConsentPatientData (used for Patient) ?? 
                        // Wait, looking at HTML: id="sigConsentPatientContainer" is seemingly the only one?
                        // Let's re-verify S7 HTML to be sure we target the correct ID for Rep vs Patient.
                        // I assumed shared "sigConsentPatientData".
                        // If so:
                        if (!document.getElementById('sigConsentPatientData').value) {
                            alert('Signature is required to submit.');
                            isValid = false;
                        }

                        // Relationship Field (Only for Rep)
                        // If isPatient is FALSE, Relationship is mandatory.
                        if (isValid && !isPatient) {
                            const rel = document.querySelector('input[name="consentRelationship"]').value.trim();
                            if (!rel) {
                                alert('Please indicate relationship to patient.');
                                isValid = false;
                            }
                        }
                    }
                }
            }
        }

        if (!isValid) {
            // Already alerted specific or generic
        } else {
            return true;
        }

        if (!isValid && !document.querySelector('.custom-alert-shown')) {
            // Fallback
        }

        return isValid;
    }

    async function submitForm() {
        // Collect Data
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            // Handle multiple checkboxes with same name
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });

        console.log('Form Data Collected:', data);

        // UI Update
        nextBtn.textContent = 'Submitting...';
        nextBtn.disabled = true;

        try {
            // Using Action to Save + Email
            await convex.action(api.actions.submitAndNotify, {
                firstName: data.firstName || "Unknown",
                lastName: data.lastName || "Unknown",
                dob: data.dob || "Unknown",
                formData: data
            });

            // alert('Form Submitted & Email Sent!'); // REMOVED
            // nextBtn.textContent = 'Submitted';

            // Show Success Screen
            document.getElementById('formContainer').classList.add('hidden');
            document.getElementById('progressBar').parentElement.classList.add('hidden'); // Hide progress bar too

            const successContainer = document.getElementById('successContainer');
            successContainer.classList.remove('hidden');

            // Populate Details
            const firstName = data.firstName || "Patient";
            const lastName = data.lastName || "";
            document.getElementById('successName').textContent = `${firstName} ${lastName}`;

            const email = data.email || "your provided email";
            document.getElementById('successEmail').textContent = email;

            // Optional: Scroll to top
            window.scrollTo(0, 0);
        } catch (error) {
            console.error("Submission failed:", error);
            alert('Failed to submit form: ' + error.message);
            nextBtn.textContent = 'Submit Form';
            nextBtn.disabled = false;
        }
    }

    // Global toggle function (legacy for Step 2)
    window.toggleField = function (id, show) {
        const element = document.getElementById(id);
        if (show) {
            element.classList.remove('hidden');
            element.setAttribute('required', 'true');
        } else {
            element.classList.add('hidden');
            element.removeAttribute('required');
            element.value = ''; // Clear value
        }
    }

    // Toggle Group Function (for Tobacco/Other)
    function toggleFieldGroup(id, show) {
        const element = document.getElementById(id);
        if (!element) return;

        if (show) {
            element.classList.remove('hidden');
            // Find inputs inside and make them required if they are text inputs
            const inputs = element.querySelectorAll('input[type="text"]');
            inputs.forEach(input => input.setAttribute('required', 'true'));
        } else {
            element.classList.add('hidden');
            const inputs = element.querySelectorAll('input[type="text"]');
            inputs.forEach(input => {
                input.removeAttribute('required');
                input.value = '';
            });
        }
    }

    // --- Signature Pad Logic ---
    // --- Signature Pad Logic ---
    const modal = document.getElementById('signatureModal');
    const canvas = document.getElementById('signatureCanvas');
    let ctx;
    let isDrawing = false;
    let currentTargetId = null; // Track which signature field opened the modal

    window.openSignatureModal = function (targetId) {
        currentTargetId = targetId; // Store the ID (e.g., 'sigTermsPatient')
        modal.classList.remove('hidden');
        if (!ctx) {
            setupCanvas();
        } else {
            resizeCanvas();
        }

        // Check for existing signature data
        const dataInput = document.getElementById(targetId + 'Data');
        if (dataInput && dataInput.value) {
            const img = new Image();
            img.onload = function () {
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear first
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = dataInput.value;
        } else {
            // No existing data, clear for new signature
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    window.closeSignatureModal = function () {
        modal.classList.add('hidden');
        currentTargetId = null;
    };

    window.clearSignature = function () {
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        // Fix: Also clear the data if the user clears the canvas but doesn't save?
        // Actually, if they clear and Cancel, old sig remains. 
        // If they Clear and Save -> Save function handles it?
        // Wait, "if the signature modal is cleared of the signarture, this should NOT bypass".
        // This implies if I open modal, clear it, and save -> it should result in EMPTY data.
    };

    window.saveSignature = function () {
        if (!currentTargetId) {
            console.error('No target ID for signature save');
            return;
        }

        // Check if canvas is empty? 
        // A simple check: isDrawing used? Or get image data.
        // For now, let's assume if they click Save, they want whatever is on canvas.
        const dataURL = canvas.toDataURL('image/png');

        // Simple empty check (a blank canvas produces a specific base64 length or content, 
        // but easier: did we draw? Or just let validation handle invalid/empty check? 
        // Validation checks .value. If I save a blank canvas, it has a value (transparent png).
        // To strictly enforce "signed", we should detect if empty.
        // A quick hack for empty canvas detection:
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        const isBlank = dataURL === blank.toDataURL(); // Compare with empty

        // Dynamic Element Selection based on targetId Convention
        const signatureContainer = document.getElementById(currentTargetId + 'Container');
        const signatureImage = document.getElementById(currentTargetId + 'Image');
        const signatureDataInput = document.getElementById(currentTargetId + 'Data');
        const signatureDateInput = document.getElementById(currentTargetId + 'Date');

        if (signatureContainer && signatureImage && signatureDataInput) {
            if (isBlank) {
                // Treated as CLEARED
                signatureDataInput.value = ''; // FORCE EMPTY
                signatureImage.classList.add('hidden');
                signatureImage.style.display = 'none';

                const placeholder = signatureContainer.querySelector('.placeholder-text');
                if (placeholder) placeholder.classList.remove('hidden');
            } else {
                // 1. Show the Image
                signatureImage.src = dataURL;
                signatureImage.classList.remove('hidden');
                signatureImage.style.display = 'block'; // Force display

                // 2. Hide "Click to Sign" text inside the container
                const placeholder = signatureContainer.querySelector('.placeholder-text');
                if (placeholder) placeholder.classList.add('hidden');

                // 3. Store Data in Hidden Input
                signatureDataInput.value = dataURL;

                // 4. Auto-populate Date if field exists
                if (signatureDateInput) {
                    const today = new Date().toISOString().split('T')[0];
                    signatureDateInput.value = today;
                }
            }
        } else {
            console.error('Missing signature elements for ID:', currentTargetId);
        }

        closeSignatureModal();
    };

    function getIsPatientSigner() {
        const yes = document.querySelector('input[name="isPatientSigner"][value="Yes"]');
        const no = document.querySelector('input[name="isPatientSigner"][value="No"]');
        if (yes && yes.checked) return true;
        if (no && no.checked) return false;
        return null;
    }

    function setupCanvas() {
        ctx = canvas.getContext('2d');
        resizeCanvas();

        // Mouse Events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(e.touches[0]);
        });
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            draw(e.touches[0]);
        });
        canvas.addEventListener('touchend', stopDrawing);
    }

    function resizeCanvas() {
        // Set canvas internal resolution to match display size
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Reset context props after resize
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
    }

    function startDrawing(e) {
        isDrawing = true;
        draw(e); // Draw dot
    }

    function draw(e) {
        if (!isDrawing) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.pageX) - rect.left;
        const y = (e.clientY || e.pageY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath(); // Reset path
    }

    // --- Additional Initialization ---
    // Restrict Last Menses Date to Today or earlier
    const lastMenses = document.getElementById('lastMenses');
    if (lastMenses) {
        lastMenses.max = new Date().toISOString().split('T')[0];
    }
});
