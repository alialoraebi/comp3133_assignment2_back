const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const employeeSchema = new Schema({
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    salary: { type: Number, required: true }
});

module.exports = mongoose.model('Employee', employeeSchema);