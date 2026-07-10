// api/pacientes.js - Versión ultra simplificada
const { Pool } = require('pg');

// Intentar diferentes configuraciones de SSL
function createPool(sslConfig) {
    return new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: sslConfig,
        connectionTimeoutMillis: 10000,
    });
}

// Intentar conectar con diferentes configuraciones
async function tryConnect() {
    const configs = [
        { name: 'sin SSL', ssl: false },
        { name: 'SSL con rejectUnauthorized: false', ssl: { rejectUnauthorized: false } },
        { name: 'SSL estricto', ssl: true }
    ];

    for (const config of configs) {
        try {
            const pool = createPool(config.ssl);
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            await pool.end();
            return { success: true, config: config.name, pool };
        } catch (error) {
            console.log(`❌ Falló conexión ${config.name}:`, error.message);
        }
    }
    return { success: false, error: 'Todas las configuraciones de conexión fallaron' };
}

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ENDPOINT DE DIAGNÓSTICO
    if (req.url === '/api/pacientes/test') {
        const result = await tryConnect();
        return res.status(200).json({
            status: 'Prueba de conexión',
            result: result,
            environment: {
                DB_USER: process.env.DB_USER ? '✅' : '❌',
                DB_HOST: process.env.DB_HOST ? '✅' : '❌',
                DB_NAME: process.env.DB_NAME ? '✅' : '❌',
                DB_PASSWORD: process.env.DB_PASSWORD ? '✅' : '❌',
                DB_PORT: process.env.DB_PORT || '5432'
            }
        });
    }

    try {
        // Intentar conectar
        const connection = await tryConnect();
        if (!connection.success) {
            return res.status(503).json({
                error: 'No se pudo conectar a la base de datos',
                details: connection.error
            });
        }

        const pool = connection.pool;
        const { method } = req;
        const urlParts = req.url.split('/');
        const id = urlParts[urlParts.length - 1];

        // GET - Obtener pacientes
        if (method === 'GET') {
            if (id && !isNaN(id)) {
                const result = await pool.query('SELECT * FROM pacientes WHERE id = $1', [parseInt(id)]);
                await pool.end();
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Paciente no encontrado' });
                }
                return res.status(200).json(result.rows[0]);
            } else {
                const result = await pool.query('SELECT * FROM pacientes ORDER BY id');
                await pool.end();
                return res.status(200).json(result.rows);
            }
        }

        // POST - Crear paciente
        if (method === 'POST') {
            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            if (!nombre || !cedula || !fecha_nac) {
                await pool.end();
                return res.status(400).json({ error: 'Nombre, Cédula y Fecha de nacimiento son obligatorios' });
            }

            const result = await pool.query(
                `INSERT INTO pacientes 
                 (nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
                 RETURNING id`,
                [
                    nombre, cedula,
                    telefono || null, direccion || null, fecha_nac,
                    condicion || 'Consulta general',
                    objetivo || null, testimonio || null,
                    estado || 'Activo',
                    enlace || null, avatar || null
                ]
            );

            await pool.end();
            return res.status(201).json({ 
                id: result.rows[0].id, 
                message: 'Paciente registrado exitosamente' 
            });
        }

        await pool.end();
        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({ 
            error: 'Error en el servidor',
            message: error.message
        });
    }
};
