// services/index.js
const { storage, bucketScan, bucketProfile } = require('./storage');
const { transporter, generateVerificationCode} = require('./email');
const { verificationCodes, passwordResetCodes, otpStorage } = require('./verification');

module.exports = {
    storage,
    bucketScan,
    bucketProfile,
    transporter,
    verificationCodes,
    passwordResetCodes,
    otpStorage,
    generateVerificationCode
};


// sample ni for implementaion
//const { bucketScan, bucketProfile, transporter, verificationCodes } = require('./services');