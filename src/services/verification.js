// services/verification.js

// Verification Codes Storage 
const verificationCodes = new Map();
const passwordResetCodes = new Map();
const otpStorage = new Map();

module.exports = {
    verificationCodes,
    passwordResetCodes,
    otpStorage
};