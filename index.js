//Archivo principal de entrada de la aplicación
// Base de datos PostgreSQL: proyecto_final_db
// Base de datos MongoDB: proyecto_final_mongo

// Importamos Express, el framework web para Node.js
const express = require('express');
// Importamos la conexión a PostgreSQL
const pool = require('./db');
// Importamos la función que conecta a MongoDB
const connectMongoDB = require('./mongoConnection');
// Importamos el modelo de Mongoose para la colección 'Vehiculo'
const Vehiculo = require('./Vehiculo');
// Inicializamos la aplicación Express
const app = express();
// Definimos el puerto donde escuchará el servidor (3000 por defecto)
const PORT = 3000;
// Middleware para parsear cuerpos de peticiones JSON y
// Permite acceder a req.body en las rutas POST/PUT
app.use(express.json());
// Conectamos a MongoDB al iniciar
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

// MÓDULO: ALUMNOS
//  GET /alumnos - Listar todos los alumnos activos
app.get('/alumnos', async (req, res) => {
  try {
    // Se ejecuta con una consulta SQL
    // Se seleccionan solo alumnos donde isActive = true
    const resultado = await pool.query(
      'SELECT * FROM alumno WHERE isActive = true ORDER BY nombre'
    );
    // Se responde con éxito y los datos obtenidos
    // resultado.rows contiene el array de registros de la BD
    res.json({ ok: true, data: resultado.rows });
  } catch (error) {
    // Si ocurre un error, se rigistra en la consola
    console.error(error);
    // Se responde con estado 500 (Error Interno del Servidor)
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

//GET /alumnos/:id - Obtener un alumno específico por su ID
app.get('/alumnos/:id', async (req, res) => {
  try {
    // Se extrae el parámetro 'id' de la URL
    const { id } = req.params;
    // Validación: se verifica que el ID sea un número válido
    // isNaN() devuelve true si NO es número, entonces se retorna un error 400
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Consulta SQL con parámetro parametrizado ($1) para prevenir inyección SQL
    // Se busca el alumno por ID y que esté activo
    const resultado = await pool.query(
      'SELECT * FROM alumno WHERE id = $1 AND isActive = true', [id]
    );
    // Si no se encontraron registros se responde, no encontrado
    if (resultado.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // Se responde con el primer y único resultado encontrado
    res.json({ ok: true, data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// GET /alumnos/buscar/:valor - Búsqueda por nombre o apellido
app.get('/alumnos/buscar/:valor', async (req, res) => {
  try {
    // Obtenemos el término de búsqueda desde los parámetros de la URL
    const { valor } = req.params;
    // Validación: El término de búsqueda no puede estar vacío
    if (!valor || valor.trim() === '') 
      return res.status(400).json({ ok: false, error: 'Término obligatorio' });
    // Consulta con ILIKE para búsqueda insensible a mayúsculas/minúsculas
    // Los % son comodines: '%valor%' busca el texto en cualquier posición
    // Se buscan las coincidencias en nombre O apellido, solo alumnos activos
    const resultado = await pool.query(
      `SELECT * FROM alumno 
       WHERE (nombre ILIKE $1 OR apellido ILIKE $1) AND isActive = true`,
      [`%${valor.trim()}%`]  // Array con el parámetro para $1
    );
    // Se responde incluyendo el conteo de resultados encontrados
    res.json({ ok: true, count: resultado.rows.length, data: resultado.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al buscar' });
  }
});

// POST /alumnos/crear - Crear un nuevo alumno
app.post('/alumnos/crear', async (req, res) => {
  try {
    // Se extraen los datos del cuerpo de la petición JSON
    const { nombre, apellido, edad, correo } = req.body;
    // Validación: Todos los campos son obligatorios
    if (!nombre || !apellido || !edad || !correo) 
      return res.status(400).json({ ok: false, error: 'Campos obligatorios' });
    // Consulta INSERT con RETURNING * para obtener el registro creado
    // isActive se establece en true por defecto para nuevos registros
    const resultado = await pool.query(
      `INSERT INTO alumno (nombre, apellido, edad, correo, isActive) 
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [nombre, apellido, edad, correo]
    );
    // Status 201 = Creado exitosamente, se responde con el nuevo registro
    res.status(201).json({ ok: true, message: 'Creado exitosamente', data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    // Código '23505' = Violación de restricción única
    // Esto ocurre si intentamos registrar un correo que ya existe
    if (error.code === '23505') 
      return res.status(400).json({ ok: false, error: 'Correo duplicado' });
    // Para cualquier otro error, se responde con error 500
    res.status(500).json({ ok: false, error: 'Error al crear' });
  }
});
// PUT /alumnos/actualizar/:id - Actualizar datos de un alumno
app.put('/alumnos/actualizar/:id', async (req, res) => {
  try {
    const { id } = req.params; // ID del alumno a actualizar
    const { nombre, apellido, edad, correo } = req.body;  // Datos a actualizar
    // Validación: El ID debe ser numérico
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificamos que el alumno exista y esté activo antes de actualizar
    const existe = await pool.query(
      'SELECT id FROM alumno WHERE id = $1 AND isActive = true', [id]
    );
    if (existe.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // Creamos arrays para construir la parte SET de forma segura
    const campos = [], valores = []; 
    let i = 1;  // Contador para los parámetros $1, $2, $3
    // Solo agregamos al UPDATE los campos que se enviaron en el body
    // Esto permite actualizaciones parciales (ejemplo: solo cambiar el correo)
    if (nombre) { campos.push(`nombre=$${i++}`); valores.push(nombre); }
    if (apellido) { campos.push(`apellido=$${i++}`); valores.push(apellido); }
    if (edad) { campos.push(`edad=$${i++}`); valores.push(edad); }
    if (correo) { campos.push(`correo=$${i++}`); valores.push(correo); }
    // Si no se envió ningún campo para actualizar, retornamos error
    if (campos.length === 0) 
      return res.status(400).json({ ok: false, error: 'Envía datos a actualizar' });
    // Agregamos el ID al final de los valores para el where id=$n
    valores.push(id);
    // Construimos y ejecutamos la consulta UPDATE
    // Ejemplo resultante: UPDATE alumno SET nombre=$1, correo=$2 WHERE id=$3
    const resultado = await pool.query(
      `UPDATE alumno SET ${campos.join(',')} WHERE id=$${i} RETURNING *`, 
      valores
    );
    res.json({ ok: true, message: 'Actualizado', data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    // Manejo de correo duplicado también en actualización
    if (error.code === '23505') 
      return res.status(400).json({ ok: false, error: 'Correo duplicado' });
    res.status(500).json({ ok: false, error: 'Error al actualizar' });
  }
});

// DELETE /alumnos/eliminar/:id - Eliminación lógica
app.delete('/alumnos/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Validación de ID numérico
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificamos que el alumno exista antes de "eliminarlo"
    const existe = await pool.query(
      'SELECT id,nombre FROM alumno WHERE id=$1 AND isActive=true', [id]
    );
    if (existe.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // eliminacion lógica: actualizamos el campo isActive a false en lugar de borrar el registro
    // Esto mantiene el historial y permite recuperación si es necesario
    await pool.query('UPDATE alumno SET isActive=false WHERE id=$1', [id]);
    // Se confirma la operación con los datos del registro inactivado
    res.json({ ok: true, message: 'Inactivado', data: { id, isActive: false } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al eliminar' });
  }
});

// MÓDULO: MATERIAS
// GET /materias - Listar todas las materias
app.get('/materias', async (req, res) => {
  try {
    // Consulta simple: traemos todas las materias existentes
    const resultado = await pool.query('SELECT * FROM materia ORDER BY nombre');
    res.json({ ok: true, data: resultado.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

// GET /materias/:id - Obtener materia por ID
app.get('/materias/:id', async (req, res) => {
  try {
    // Extraer ID de la URL
    const { id } = req.params;
    // Validar que el ID sea numérico
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Consultar materia por ID 
    const resultado = await pool.query('SELECT * FROM materia WHERE id=$1', [id]);
    // Si no hay resultados, se responde con error 404 (No encontrado)
    if (resultado.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // Se responde con la materia encontrada
    res.json({ ok: true, data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// POST /materias/crear - Crear nueva materia
app.post('/materias/crear', async (req, res) => {
  try {
    const { nombre, semestre, creditos } = req.body;
    // Validación básica: el nombre es obligatorio y no puede estar vacío
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    }
    // Verificamos si ya existe una materia con la misma combinación:
    // nombre + semestre + créditos
    const existe = await pool.query(
      `SELECT id FROM materia 
       WHERE nombre = $1 
         AND (semestre = $2 OR (semestre IS NULL AND $2 IS NULL))
         AND (creditos = $3 OR (creditos IS NULL AND $3 IS NULL))`,
      [nombre.trim(), semestre || null, creditos || null]
    );
    // Si se encuentra un registro idéntico, se rechaza la creación de la materia
    if (existe.rows.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Ya existe una materia con este nombre, semestre y créditos' 
      });
    }
    // Se inserta la nueva materia
    // Se usa || null para convertir valores vacíos/undefined a NULL en la BD
    const resultado = await pool.query(
      `INSERT INTO materia (nombre, semestre, creditos) 
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), semestre || null, creditos || null]
    );
    // Se responde con el nuevo registro creado, incluyendo un mensaje de éxito
    res.status(201).json({ 
      ok: true, 
      message: 'Materia creada correctamente', 
      data: resultado.rows[0] 
    });
  } catch (error) {
    console.error('Error al crear materia:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// MÓDULO: RELACIÓN ALUMNO - MATERIAS
// POST /alumnos/:id/materias - Asignar una materia a un alumno
app.post('/alumnos/:id/materias', async (req, res) => {
  try {
    // Se extrae el ID: alumno_id de la URL y materia_id del cuerpo de la petición
    const { id: alumno_id } = req.params;
    const { materia_id } = req.body;
    // Validaciones básicas
    if (!materia_id) {
      return res.status(400).json({ ok: false, error: 'El materia_id es obligatorio' });
    }
    if (isNaN(alumno_id) || isNaN(materia_id)) {
      return res.status(400).json({ ok: false, error: 'Los IDs deben ser números válidos' });
    }
    //  Se verifica que el alumno exista y esté activo, que la materia exista, y que la asignación todavia no exista
    // 1. Verificar que el alumno exista y esté activo
    const alumno = await pool.query(
      'SELECT id, nombre FROM alumno WHERE id = $1 AND isActive = true',
      [alumno_id]
    );
    if (alumno.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado o inactivo' });
    }
    // 2. Verificar que la materia exista
    const materia = await pool.query(
      'SELECT id, nombre FROM materia WHERE id = $1',
      [materia_id]
    );
    if (materia.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Materia no encontrada' });
    }
    // 3. Verificar que la asignación no exista ya
    const existe = await pool.query(
      'SELECT id FROM alumno_materia WHERE alumno_id = $1 AND materia_id = $2',
      [alumno_id, materia_id]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ ok: false, error: 'Esta materia ya está asignada al alumno' });
    }
    // Si todas las validaciones pasan, se procede a insertar la relación en la tabla intermedia,alumno_materia
    const resultado = await pool.query(
      `INSERT INTO alumno_materia (alumno_id, materia_id) 
       VALUES ($1, $2) RETURNING *`,
      [alumno_id, materia_id]
    );
    res.status(201).json({
      ok: true,
      message: 'Materia asignada correctamente',
      data: { 
        ...resultado.rows[0],
        alumno_nombre: alumno.rows[0].nombre,
        materia_nombre: materia.rows[0].nombre
      }
    });
  } catch (error) {
    console.error('Error al asignar materia:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// GET /alumnos/:id/materias - Listar materias de un alumno
app.get('/alumnos/:id/materias', async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificar que el alumno exista y esté activo
    const alumno = await pool.query(
      'SELECT id, nombre FROM alumno WHERE id=$1 AND isActive=true', [id]
    );
    if (alumno.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado o inactivo' });
    // Consulta SQL para obtener las materias asignadas al alumno
    // Unimos las tablas 'materia' y 'alumno_materia' para obtener
    // los detalles completos de las materias asignadas al alumno
    const resultado = await pool.query(
      `SELECT m.* FROM materia m
       INNER JOIN alumno_materia am ON m.id=am.materia_id
       WHERE am.alumno_id=$1 ORDER BY m.nombre`, [id]
    );
    // Se responde con el nombre del alumno, el conteo de materias asignadas y la lista de materias
    res.json({ 
      ok: true, 
      alumno_id: parseInt(id),
      alumno: alumno.rows[0].nombre,
      count: resultado.rows.length, 
      data: resultado.rows 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

// GET /alumnos/:id/materias/contar - Contar materias asignadas
app.get('/alumnos/:id/materias/contar', async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificación de existencia del alumno
    const alumno = await pool.query(
      'SELECT id FROM alumno WHERE id=$1 AND isActive=true', [id]
    );
    if (alumno.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado' });
    // Consulta de agregación: COUNT(*) para obtener el total
    const resultado = await pool.query(
      'SELECT COUNT(*) as total FROM alumno_materia WHERE alumno_id=$1', [id]
    );
    // Despues de que se conto las materias se muestran
    // Si sucede un error se muestra el mensaje de error- error al contar
    res.json({ ok: true, total_materias: parseInt(resultado.rows[0].total) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al contar' });
  }
});

// MÓDULO: VEHÍCULOS (MongoDB)
// GET /vehiculos - Listar todos los veiculos resgistrado
app.get('/vehiculos', async (req, res) => {
  try {
    // Vehiculo.find() es un método de Mongoose que busca todos los documentos
    // en la colección 'vehiculos' de MongoDB
    const vehiculos = await Vehiculo.find();
    // Se responde con la lista de los veiculos registrados
    res.json({ ok: true, database: 'mongo', count: vehiculos.length, data: vehiculos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

// POST /vehiculos - Crear nuevo registro de un veiculo
app.post('/vehiculos', async (req, res) => {
  try {
    const { marca, modelo, anio, color } = req.body;
    // Validación de campos obligatorios
    if (!marca || !modelo || !anio) 
      return res.status(400).json({ ok: false, error: 'Marca, modelo y año obligatorios' });
    // Validación de rango para el año: entre 1900 y 2100
    if (isNaN(anio) || anio < 1900 || anio > 2100) 
      return res.status(400).json({ ok: false, error: 'Año inválido' });
    // Creamos una nueva instancia del modelo Vehiculo con los datos
    // Mongoose validará automáticamente contra el esquema definido en - Vehiculo.js
    const nuevo = new Vehiculo({ marca, modelo, anio: parseInt(anio), color });
    // Se guardara el documento en MongoDB
    await nuevo.save();
    // Responde con el documento creado
    res.status(201).json({ ok: true, message: 'Creado', database: 'mongo', data: nuevo });
  } catch (error) {
    console.error(error);
    // Manejo de e
    // rrores de validación de Mongoose
    // Ocurre cuando los datos no cumplen con el esquema
    if (error.name === 'ValidationError') 
      return res.status(400).json({ ok: false, error: 'Datos inválidos' });
    res.status(500).json({ ok: false, error: 'Error al crear' });
  }
});

// INICIO DEL SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`PostgreSQL: proyecto_final_db`);
  console.log(`MongoDB: proyecto_final_mongo`);
});