// services/email.js
const nodemailer = require('nodemailer');
const config = require('../config');

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const transporter = nodemailer.createTransport({
    service: config.email.service,
    auth: {
        user: config.email.user,
        pass: config.email.password
    }
});

module.exports = {
    generateVerificationCode,
    transporter
};