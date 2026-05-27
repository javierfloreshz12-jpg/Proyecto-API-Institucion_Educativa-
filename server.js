const express = require("express");
const connectMongoDB = require("./mongoConnection");
const app = express();

app.use(express.json());

const Vehiculo = require("./Vehiculo");

app.get("/api/getVehiculos", async (req, res) => {
  try {
    const vehiculos = await Vehiculo.find();

    res.status(200).json({
      message: "Vehículos consultados correctamente",
      data: vehiculos,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al consultar vehículos",
      error: error.message,
    });
  }
});

app.post("/api/createVehiculo", async (req, res) => {
  try {
    const { marca, modelo, anio, color } = req.body;

    if (!marca || !modelo || !anio || !color) {
      return res.status(400).json({
        message: "Todos los campos son obligatorios",
      });
    }

    if (isNaN(anio)) {
      return res.status(400).json({
        message: "El año debe ser numérico",
      });
    }

    const nuevoVehiculo = new Vehiculo({
      marca,
      modelo,
      anio,
      color,
    });

    await nuevoVehiculo.save();

    res.status(201).json({
      message: "Vehículo creado correctamente",
      data: nuevoVehiculo,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear vehículo",
      error: error.message,
    });
  }
});

connectMongoDB();
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});