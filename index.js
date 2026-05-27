//Archivo principal de entrada de la aplicación
// Base de datos PostgreSQL: proyecto_final_db
// Base de datos MongoDB: proyecto_final_mongo

// Importamos Express, el framework web para Node.js
const express = require('express');
// Importamos la conexión a PostgreSQL (pool de conexiones)
// Este archivo debe exportar un objeto 'pool' configurado con pg
const pool = require('./db');
// Importamos la función que conecta a MongoDB
// Este archivo debe establecer la conexión con Mongoose
const connectMongoDB = require('./mongoConnection');
// Importamos el modelo de Mongoose para la colección 'Vehiculo'
const Vehiculo = require('./Vehiculo');
// Inicializamos la aplicación Express
const app = express();
// Definimos el puerto donde escuchará el servidor (3000 por defecto)
const PORT = 3000;
// Middleware para parsear cuerpos de peticiones JSON
// Permite acceder a req.body en las rutas POST/PUT
app.use(express.json());
// Conectamos a MongoDB al iniciar la aplicación
connectMongoDB();

// RUTA PRINCIPAL
// Ruta GET para la raíz de la API
// Sirve como punto de entrada para verificar que el servidor funciona
app.get('/', (req, res) => {
  // Respondemos con un objeto JSON informativo
  res.json({
    message: 'API funcionando',
    docs: 'Usa /alumnos, /materias, /vehiculos'
  });
});



// INICIO DEL SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`PostgreSQL: proyecto_final_db`);
  console.log(`MongoDB: proyecto_final_mongo`);
});