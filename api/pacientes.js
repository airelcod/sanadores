// api/pacientes.js
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL con manejo de SSL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // SSL solo si está explícitamente configurado
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
});

// Función para probar la conexión
async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a PostgreSQL:', error.message);
        return false;
    }
}

module.exports = async (req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ENDPOINT DE DIAGNÓSTICO
    if (req.url === '/api/pacientes/test' || req.url === '/api/test') {
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW() as time, version() as version');
            client.release();
            
            return res.status(200).json({
                status: '✅ Conexión exitosa a PostgreSQL',
                database: {
                    time: result.rows[0].time,
                    version: result.rows[0].version
                },
                environment: {
                    DB_USER: process.env.DB_USER ? '✅ Configurado' : '❌ No configurado',
                    DB_HOST: process.env.DB_HOST ? '✅ Configurado' : '❌ No configurado',
                    DB_NAME: process.env.DB_NAME ? '✅ Configurado' : '❌ No configurado',
                    DB_PORT: process.env.DB_PORT || '5432 (default)',
                    DB_SSL: process.env.DB_SSL || 'false (default)'
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: '❌ Error de conexión',
                error: error.message,
                environment: {
                    DB_USER: process.env.DB_USER ? '✅ Configurado' : '❌ No configurado',
                    DB_HOST: process.env.DB_HOST ? '✅ Configurado' : '❌ No configurado',
                    DB_NAME: process.env.DB_NAME ? '✅ Configurado' : '❌ No configurado',
                    DB_PORT: process.env.DB_PORT || '5432 (default)',
                    DB_SSL: process.env.DB_SSL || 'false (default)'
                }
            });
        }
    }

    const { method } = req;
    const urlParts = req.url.split('/');
    const id = urlParts[urlParts.length - 1];

    try {
        // Verificar conexión ANTES de cualquier operación
        const isConnected = await testConnection();
        if (!isConnected) {
            return res.status(503).json({ 
                error: 'No se pudo conectar a la base de datos',
                details: 'Verifica las variables de entorno DB_* en Vercel'
            });
        }

        // GET - Obtener todos los pacientes o uno específico
        if (method === 'GET') {
            if (id && !isNaN(id) && id !== 'test') {
                const result = await pool.query(
                    'SELECT * FROM pacientes WHERE id = $1',
                    [parseInt(id)]
                );
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Paciente no encontrado' });
                }
                return res.status(200).json(result.rows[0]);
            } else if (id !== 'test') {
                // Obtener todos los pacientes
                const result = await pool.query(
                    'SELECT * FROM pacientes ORDER BY id'
                );
                return res.status(200).json(result.rows);
            }
        }

        // POST - Crear nuevo paciente
        if (method === 'POST') {
            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            if (!nombre || !cedula || !fecha_nac) {
                return res.status(400).json({ error: 'Nombre, Cédula y Fecha de nacimiento son obligatorios' });
            }

            // Verificar cédula duplicada
            const existing = await pool.query(
                'SELECT id FROM pacientes WHERE cedula = $1',
                [cedula]
            );
            if (existing.rows.length > 0) {
                return res.status(409).json({ error: 'Ya existe un paciente con esta cédula' });
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

            return res.status(201).json({ 
                id: result.rows[0].id, 
                message: 'Paciente registrado exitosamente' 
            });
        }

        // PUT - Actualizar paciente
        if (method === 'PUT') {
            if (!id || isNaN(id)) {
                return res.status(400).json({ error: 'ID inválido' });
            }

            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            // Verificar si el paciente existe
            const existing = await pool.query(
                'SELECT id FROM pacientes WHERE id = $1',
                [parseInt(id)]
            );
            if (existing.rows.length === 0) {
                return res.status(404).json({ error: 'Paciente no encontrado' });
            }

            // Si se cambia la cédula, verificar que no exista en otro paciente
            if (cedula) {
                const cedulaCheck = await pool.query(
                    'SELECT id FROM pacientes WHERE cedula = $1 AND id != $2',
                    [cedula, parseInt(id)]
                );
                if (cedulaCheck.rows.length > 0) {
                    return res.status(409).json({ error: 'Ya existe otro paciente con esta cédula' });
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

            return res.status(200).json({ message: 'Paciente actualizado exitosamente' });
        }

        // DELETE - Eliminar paciente
        if (method === 'DELETE') {
            if (!id || isNaN(id)) {
                return res.status(400).json({ error: 'ID inválido' });
            }

            const result = await pool.query(
                'DELETE FROM pacientes WHERE id = $1 RETURNING id',
                [parseInt(id)]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Paciente no encontrado' });
            }

            return res.status(200).json({ message: 'Paciente eliminado exitosamente' });
        }

        // Método no permitido
        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({ 
            error: 'Error en el servidor', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
