// services/index.js
const { bucketScan, bucketProfile, bucketMedicine,bucketNotification } = require('./storage');
const { transporter} = require('./email');
const { verificationCodes, passwordResetCodes, otpStorage } = require('./verification');

module.exports = {
    bucketScan,
    bucketProfile,
    bucketMedicine,
    bucketNotification,
    transporter,
    verificationCodes,
    passwordResetCodes,
    otpStorage
};


// sample ni for implementaion
//const { bucketScan, bucketProfile, transporter, verificationCodes } = require('./services');