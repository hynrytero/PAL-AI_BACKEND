// services/storage.js
const { Storage } = require('@google-cloud/storage');
const config = require('../config');

const storage = new Storage({
    projectId: config.storage.projectId,
});

const bucketScan = storage.bucket(config.storage.bucketScan);
const bucketProfile = storage.bucket(config.storage.bucketProfile);
const bucketMedicine = storage.bucket(config.storage.bucketMedicine);

module.exports = {
    bucketScan,
    bucketProfile,
    bucketMedicine,
};