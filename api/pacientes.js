// api/pacientes.js
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: {
        rejectUnauthorized: false // Necesario para la mayoría de servicios en la nube
    }
});

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method } = req;
    const urlParts = req.url.split('/');
    const id = urlParts[urlParts.length - 1];

    try {
        // GET - Obtener todos los pacientes o uno específico
        if (method === 'GET') {
            if (id && !isNaN(id)) {
                // Obtener un paciente específico
                const result = await pool.query(
                    'SELECT * FROM pacientes WHERE id = $1',
                    [parseInt(id)]
                );
                if (result.rows.length === 0) {
                    res.status(404).json({ error: 'Paciente no encontrado' });
                    return;
                }
                res.status(200).json(result.rows[0]);
            } else {
                // Obtener todos los pacientes
                const result = await pool.query(
                    'SELECT * FROM pacientes ORDER BY id'
                );
                res.status(200).json(result.rows);
            }
            return;
        }

        // POST - Crear nuevo paciente
        if (method === 'POST') {
            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            if (!nombre || !cedula || !fecha_nac) {
                res.status(400).json({ error: 'Nombre, Cédula y Fecha de nacimiento son obligatorios' });
                return;
            }

            // Verificar cédula duplicada
            const existing = await pool.query(
                'SELECT id FROM pacientes WHERE cedula = $1',
                [cedula]
            );
            if (existing.rows.length > 0) {
                res.status(409).json({ error: 'Ya existe un paciente con esta cédula' });
                return;
            }

            const result = await pool.query(
                `INSERT INTO pacientes 
                 (nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                 RETURNING id`,
                [
                    nombre,
                    cedula,
                    telefono || null,
                    direccion || null,
                    fecha_nac,
                    condicion || 'Consulta general',
                    objetivo || null,
                    testimonio || null,
                    estado || 'Activo',
                    enlace || null,
                    avatar || null
                ]
            );

            res.status(201).json({ 
                id: result.rows[0].id, 
                message: 'Paciente registrado exitosamente' 
            });
            return;
        }

        // PUT - Actualizar paciente
        if (method === 'PUT') {
            if (!id || isNaN(id)) {
                res.status(400).json({ error: 'ID inválido' });
                return;
            }

            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            // Verificar si el paciente existe
            const existing = await pool.query(
                'SELECT id FROM pacientes WHERE id = $1',
                [parseInt(id)]
            );
            if (existing.rows.length === 0) {
                res.status(404).json({ error: 'Paciente no encontrado' });
                return;
            }

            // Si se cambia la cédula, verificar que no exista en otro paciente
            if (cedula) {
                const cedulaCheck = await pool.query(
                    'SELECT id FROM pacientes WHERE cedula = $1 AND id != $2',
                    [cedula, parseInt(id)]
                );
                if (cedulaCheck.rows.length > 0) {
                    res.status(409).json({ error: 'Ya existe otro paciente con esta cédula' });
                    return;
                }
            }

            await pool.query(
                `UPDATE pacientes SET 
                 nombre = COALESCE($1, nombre),
                 cedula = COALESCE($2, cedula),
                 telefono = $3,
                 direccion = $4,
                 fecha_nac = COALESCE($5, fecha_nac),
                 condicion = $6,
                 objetivo = $7,
                 testimonio = $8,
                 estado = $9,
                 enlace = $10,
                 avatar = $11
                 WHERE id = $12`,
                [
                    nombre || null,
                    cedula || null,
                    telefono || null,
                    direccion || null,
                    fecha_nac || null,
                    condicion || 'Consulta general',
                    objetivo || null,
                    testimonio || null,
                    estado || 'Activo',
                    enlace || null,
                    avatar || null,
                    parseInt(id)
                ]
            );

            res.status(200).json({ message: 'Paciente actualizado exitosamente' });
            return;
        }

        // DELETE - Eliminar paciente
        if (method === 'DELETE') {
            if (!id || isNaN(id)) {
                res.status(400).json({ error: 'ID inválido' });
                return;
            }

            const result = await pool.query(
                'DELETE FROM pacientes WHERE id = $1 RETURNING id',
                [parseInt(id)]
            );
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Paciente no encontrado' });
                return;
            }

            res.status(200).json({ message: 'Paciente eliminado exitosamente' });
            return;
        }

        // Método no permitido
        res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            error: 'Error en el servidor', 
            details: error.message 
        });
    }
};
