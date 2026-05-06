// mongoConnection.js - Conexión a MongoDB: proyecto_final_mongo
const mongoose = require('mongoose');

const connectMongoDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/proyecto_final_mongo');
    console.log('✅ Conexión exitosa a MongoDB');
  } catch (error) {
    console.error('Error MongoDB:', error.message);
  }
};

module.exports = connectMongoDB;