const mongoose = require('mongoose');

const vehiculoSchema = new mongoose.Schema({
  marca: { type: String, required: true, trim: true },
  modelo: { type: String, required: true, trim: true },
  anio: { type: Number, required: true, min: 1900, max: 2100 },
  color: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', vehiculoSchema);