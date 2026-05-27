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