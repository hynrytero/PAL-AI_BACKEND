// services/index.js
const { storage, bucketScan, bucketProfile } = require('./storage');
const { transporter} = require('./email');
const { verificationCodes, passwordResetCodes, otpStorage } = require('./verification');

module.exports = {
    bucketScan,
    bucketProfile,
    transporter,
    verificationCodes,
    passwordResetCodes,
    otpStorage
};


// sample ni for implementaion
//const { bucketScan, bucketProfile, transporter, verificationCodes } = require('./services');