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

// MÓDULO: ALUMNOS
//  GET /alumnos - Listar todos los alumnos activos
app.get('/alumnos', async (req, res) => {
  try {
    // Ejecutamos una consulta SQL segura usando parámetros ($1, $2, etc.)
    // Seleccionamos solo alumnos donde isActive = true (soft delete)
    // Ordenamos los resultados alfabéticamente por nombre
    const resultado = await pool.query(
      'SELECT * FROM alumno WHERE isActive = true ORDER BY nombre'
    );
    // Respondemos con éxito y los datos obtenidos
    // resultado.rows contiene el array de registros de la BD
    res.json({ ok: true, data: resultado.rows });
  } catch (error) {
    // Si ocurre un error, lo registramos en consola para debugging
    console.error(error);
    // Respondemos con estado 500 (Error Interno del Servidor)
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

// 🔍 GET /alumnos/:id - Obtener un alumno específico por su ID
app.get('/alumnos/:id', async (req, res) => {
  try {
    // Extraemos el parámetro 'id' de la URL (ej: /alumnos/5)
    const { id } = req.params;
    // Validación: Verificamos que el ID sea un número válido
    // isNaN() devuelve true si NO es número, entonces retornamos error 400
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Consulta SQL con parámetro parametrizado ($1) para prevenir inyección SQL
    // Buscamos el alumno por ID y que esté activo
    const resultado = await pool.query(
      'SELECT * FROM alumno WHERE id = $1 AND isActive = true', [id]
    );
    // Si no se encontraron registros (array vacío), el alumno no existe
    if (resultado.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // Respondemos con el primer (y único) resultado encontrado
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
    // Buscamos coincidencias en nombre O apellido, solo alumnos activos
    const resultado = await pool.query(
      `SELECT * FROM alumno 
       WHERE (nombre ILIKE $1 OR apellido ILIKE $1) AND isActive = true`,
      [`%${valor.trim()}%`]  // Array con el parámetro para $1
    );
    // Respondemos incluyendo el conteo de resultados encontrados
    res.json({ ok: true, count: resultado.rows.length, data: resultado.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al buscar' });
  }
});

// POST /alumnos/crear - Crear un nuevo alumno
app.post('/alumnos/crear', async (req, res) => {
  try {
    // Extraemos los datos del cuerpo de la petición JSON
    const { nombre, apellido, edad, correo } = req.body;
    // Validación: Todos los campos son obligatorios
    if (!nombre || !apellido || !edad || !correo) 
      return res.status(400).json({ ok: false, error: 'Campos obligatorios' });
    // Consulta INSERT con RETURNING * para obtener el registro creado
    // isActive se establece en true por defecto para nuevos registros
    const resultado = await pool.query(
      `INSERT INTO alumno (nombre, apellido, edad, correo, isActive) 
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [nombre, apellido, edad, correo]  // Valores en orden de los $1, $2, etc.
    );
    // Status 201 = Created (recomendado para recursos creados)
    res.status(201).json({ ok: true, message: 'Creado', data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    // Manejo específico de errores de PostgreSQL
    // Código '23505' = Violación de restricción única (unique constraint)
    // Esto ocurre si intentamos registrar un correo que ya existe
    if (error.code === '23505') 
      return res.status(400).json({ ok: false, error: 'Correo duplicado' });
    // Para cualquier otro error, respondemos con 500
    res.status(500).json({ ok: false, error: 'Error al crear' });
  }
});

//------------------

// PUT /alumnos/actualizar/:id - Actualizar datos de un alumno
app.put('/alumnos/actualizar/:id', async (req, res) => {
  try {
    const { id } = req.params;  // ID desde la URL
    const { nombre, apellido, edad, correo } = req.body;  // Datos a actualizar
    // Validación: El ID debe ser numérico
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificamos que el alumno exista y esté activo antes de actualizar
    const existe = await pool.query(
      'SELECT id FROM alumno WHERE id = $1 AND isActive = true', [id]
    );
    if (existe.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    // === CONSTRUCCIÓN DINÁMICA DE LA CONSULTA UPDATE ===
    // Creamos arrays para construir la parte SET de forma segura
    const campos = [], valores = []; 
    let i = 1;  // Contador para los parámetros $1, $2, $3...
    // Solo agregamos al UPDATE los campos que se enviaron en el body
    // Esto permite actualizaciones parciales (ej: solo cambiar el correo)
    if (nombre) { campos.push(`nombre=$${i++}`); valores.push(nombre); }
    if (apellido) { campos.push(`apellido=$${i++}`); valores.push(apellido); }
    if (edad) { campos.push(`edad=$${i++}`); valores.push(edad); }
    if (correo) { campos.push(`correo=$${i++}`); valores.push(correo); }
    // Si no se envió ningún campo para actualizar, retornamos error
    if (campos.length === 0) 
      return res.status(400).json({ ok: false, error: 'Envía datos a actualizar' });
    // Agregamos el ID al final de los valores (para la cláusula WHERE)
    valores.push(id);
    // Construimos y ejecutamos la consulta UPDATE dinámica
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
    // === ELIMINACIÓN LÓGICA ===
    // En lugar de borrar el registro (DELETE), cambiamos isActive a false
    // Esto mantiene el historial y permite recuperación si es necesario
    await pool.query('UPDATE alumno SET isActive=false WHERE id=$1', [id]);
    // Confirmamos la operación con los datos del registro inactivado
    res.json({ ok: true, message: 'Inactivado', data: { id, isActive: false } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al eliminar' });
  }
});

// MÓDULO: MATERIAS (PostgreSQL) - Operaciones CRUD
// GET /materias - Listar todas las materias
app.get('/materias', async (req, res) => {
  try {
    // Consulta simple: todas las materias ordenadas por nombre
    // No filtramos por isActive porque las materias no usan soft delete en este ejemplo
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
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    const resultado = await pool.query('SELECT * FROM materia WHERE id=$1', [id]);
    if (resultado.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'No encontrado' });
    res.json({ ok: true, data: resultado.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// POST /materias/crear - Crear nueva materia con validación de duplicados
app.post('/materias/crear', async (req, res) => {
  try {
    const { nombre, semestre, creditos } = req.body;
    
    // Validación básica: el nombre es obligatorio y no puede estar vacío
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ ok: false, error: 'El nombre es obligatorio' });
    }
    
    // === VALIDACIÓN DE DUPLICADOS AVANZADA ===
    // Verificamos si ya existe una materia con la misma combinación:
    // nombre + semestre + créditos
    // Manejamos valores NULL correctamente con OR (semestre IS NULL AND $2 IS NULL)
    const existe = await pool.query(
      `SELECT id FROM materia 
       WHERE nombre = $1 
         AND (semestre = $2 OR (semestre IS NULL AND $2 IS NULL))
         AND (creditos = $3 OR (creditos IS NULL AND $3 IS NULL))`,
      [nombre.trim(), semestre || null, creditos || null]
    );
    
    // Si encontramos un registro idéntico, rechazamos la creación
    if (existe.rows.length > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Ya existe una materia con este nombre, semestre y créditos' 
      });
    }
    // Insertamos la nueva materia
    // Usamos || null para convertir valores vacíos/undefined a NULL en la BD
    const resultado = await pool.query(
      `INSERT INTO materia (nombre, semestre, creditos) 
       VALUES ($1, $2, $3) RETURNING *`,
      [nombre.trim(), semestre || null, creditos || null]
    );
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

//-------------------

// MÓDULO: RELACIÓN ALUMNO - MATERIAS
// Esta sección maneja la tabla intermedia 'alumno_materia' que conecta
// alumnos con materias. Es una relación muchos-a-muchos.
// POST /alumnos/:id/materias - Asignar una materia a un alumno
app.post('/alumnos/:id/materias', async (req, res) => {
  try {
    // Extraemos IDs: alumno_id de la URL, materia_id del body JSON
    const { id: alumno_id } = req.params;
    const { materia_id } = req.body;
    // Validaciones básicas de presencia y tipo de datos
    if (!materia_id) {
      return res.status(400).json({ ok: false, error: 'El materia_id es obligatorio' });
    }
    if (isNaN(alumno_id) || isNaN(materia_id)) {
      return res.status(400).json({ ok: false, error: 'Los IDs deben ser números válidos' });
    }
    //  VERIFICACIÓN DE EXISTENCIA
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
    // 3. Verificar que la asignación no exista ya (evitar duplicados)
    const existe = await pool.query(
      'SELECT id FROM alumno_materia WHERE alumno_id = $1 AND materia_id = $2',
      [alumno_id, materia_id]
    );
    if (existe.rows.length > 0) {
      return res.status(400).json({ ok: false, error: 'Esta materia ya está asignada al alumno' });
    }
    // INSERCIÓN DE LA RELACIÓN
    // Insertamos en la tabla intermedia alumno_materia
    const resultado = await pool.query(
      `INSERT INTO alumno_materia (alumno_id, materia_id) 
       VALUES ($1, $2) RETURNING *`,
      [alumno_id, materia_id]
    );
    // Respuesta enriquecida: incluimos nombres legibles junto con los IDs
    res.status(201).json({
      ok: true,
      message: 'Materia asignada correctamente',
      data: { 
        ...resultado.rows[0],  // Datos de la tabla intermedia (id, fechas, etc.)
        alumno_nombre: alumno.rows[0].nombre,    // Nombre del alumno
        materia_nombre: materia.rows[0].nombre   // Nombre de la materia
      }
    });
  } catch (error) {
    console.error('Error al asignar materia:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

/ GET /alumnos/:id/materias - Listar materias de un alumno
app.get('/alumnos/:id/materias', async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ ok: false, error: 'ID inválido' });
    // Verificar que el alumno exista
    const alumno = await pool.query(
      'SELECT id, nombre FROM alumno WHERE id=$1 AND isActive=true', [id]
    );
    if (alumno.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado' });
    // CONSULTA CON JOIN
    // Unimos las tablas 'materia' y 'alumno_materia' para obtener
    // los detalles completos de las materias asignadas al alumno
    const resultado = await pool.query(
      `SELECT m.* FROM materia m
       INNER JOIN alumno_materia am ON m.id=am.materia_id
       WHERE am.alumno_id=$1 ORDER BY m.nombre`, [id]
    );
    // Respuesta con metadatos: ID del alumno, nombre y conteo de materias
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
    // Verificación rápida de existencia del alumno
    const alumno = await pool.query(
      'SELECT id FROM alumno WHERE id=$1 AND isActive=true', [id]
    );
    if (alumno.rows.length === 0) 
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado' });
    // Consulta de agregación: COUNT(*) para obtener el total
    // Más eficiente que traer todos los registros y contar en JavaScript
    const resultado = await pool.query(
      'SELECT COUNT(*) as total FROM alumno_materia WHERE alumno_id=$1', [id]
    );
    // parseInt() convierte el resultado de COUNT (string) a número
    res.json({ ok: true, total_materias: parseInt(resultado.rows[0].total) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al contar' });
  }
});

// MÓDULO: VEHÍCULOS (MongoDB) - Operaciones con Base NoSQL
// GET /vehiculos - Listar todos los vehículos desde MongoDB
app.get('/vehiculos', async (req, res) => {
  try {
    // Vehiculo.find() es un método de Mongoose que busca todos los documentos
    // en la colección 'vehiculos' de MongoDB
    const vehiculos = await Vehiculo.find();
    // Respondemos indicando que usamos MongoDB y el conteo de resultados
    res.json({ ok: true, database: 'mongo', count: vehiculos.length, data: vehiculos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: 'Error al consultar' });
  }
});

// POST /vehiculos - Crear nuevo vehículo en MongoDB
app.post('/vehiculos', async (req, res) => {
  try {
    const { marca, modelo, anio, color } = req.body;
    // Validación de campos obligatorios según reglas de negocio
    if (!marca || !modelo || !anio) 
      return res.status(400).json({ ok: false, error: 'Marca, modelo y año obligatorios' });
    // Validación de rango para el año: entre 1900 y 2100
    if (isNaN(anio) || anio < 1900 || anio > 2100) 
      return res.status(400).json({ ok: false, error: 'Año inválido' });
    // Creamos una nueva instancia del modelo Vehiculo con los datos
    // Mongoose validará automáticamente contra el esquema definido en ./Vehiculo.js
    const nuevo = new Vehiculo({ marca, modelo, anio: parseInt(anio), color });
    // Guardamos el documento en MongoDB de forma asíncrona
    await nuevo.save();
    // Respondemos con el documento creado (incluye _id generado por MongoDB)
    res.status(201).json({ ok: true, message: 'Creado', database: 'mongo', data: nuevo });
  } catch (error) {
    console.error(error);
    // Manejo de errores de validación de Mongoose
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