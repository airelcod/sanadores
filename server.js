// server.js - Backend con Node.js nativo (sin Express)
// Ejecutar con: node server.js

const http = require('http');
const url = require('url');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuración de la base de datos
const pool = new Pool({
    user: 'postgres',
    host: 'db.oiknzautazhlkqpzhmdh.supabase.co',
    database: 'postgres',
    password: 'Negroyamarill1',
    port: 5432,
});

// Función para manejar las rutas
async function handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Configurar CORS para permitir peticiones desde cualquier origen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Ruta: Obtener todos los pacientes
    if (pathname === '/api/pacientes' && method === 'GET') {
        try {
            const result = await pool.query(
                'SELECT id, nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar FROM pacientes ORDER BY id'
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows));
        } catch (error) {
            console.error('Error al obtener pacientes:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al obtener pacientes' }));
        }
        return;
    }

    // Ruta: Obtener un paciente por ID
    if (pathname.startsWith('/api/pacientes/') && method === 'GET') {
        const id = parseInt(pathname.split('/')[3]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ID inválido' }));
            return;
        }

        try {
            const result = await pool.query(
                'SELECT id, nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar FROM pacientes WHERE id = $1',
                [id]
            );
            if (result.rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Paciente no encontrado' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result.rows[0]));
        } catch (error) {
            console.error('Error al obtener paciente:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al obtener paciente' }));
        }
        return;
    }

    // Ruta: Crear nuevo paciente
    if (pathname === '/api/pacientes' && method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = data;

                // Validar campos obligatorios
                if (!nombre || !cedula || !fecha_nac) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Nombre, Cédula y Fecha de nacimiento son obligatorios' }));
                    return;
                }

                // Verificar si la cédula ya existe
                const existing = await pool.query('SELECT id FROM pacientes WHERE cedula = $1', [cedula]);
                if (existing.rows.length > 0) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Ya existe un paciente con esta cédula' }));
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

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: result.rows[0].id,
                    message: 'Paciente registrado exitosamente'
                }));
            } catch (error) {
                console.error('Error al crear paciente:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error al crear paciente' }));
            }
        });
        return;
    }

    // Ruta: Actualizar paciente
    if (pathname.startsWith('/api/pacientes/') && method === 'PUT') {
        const id = parseInt(pathname.split('/')[3]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ID inválido' }));
            return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = data;

                // Verificar si el paciente existe
                const existing = await pool.query('SELECT id FROM pacientes WHERE id = $1', [id]);
                if (existing.rows.length === 0) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Paciente no encontrado' }));
                    return;
                }

                // Si se cambia la cédula, verificar que no exista en otro paciente
                if (cedula) {
                    const cedulaCheck = await pool.query(
                        'SELECT id FROM pacientes WHERE cedula = $1 AND id != $2',
                        [cedula, id]
                    );
                    if (cedulaCheck.rows.length > 0) {
                        res.writeHead(409, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Ya existe otro paciente con esta cédula' }));
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
                        id
                    ]
                );

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Paciente actualizado exitosamente' }));
            } catch (error) {
                console.error('Error al actualizar paciente:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error al actualizar paciente' }));
            }
        });
        return;
    }

    // Ruta: Eliminar paciente
    if (pathname.startsWith('/api/pacientes/') && method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3]);
        if (isNaN(id)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ID inválido' }));
            return;
        }

        try {
            const result = await pool.query('DELETE FROM pacientes WHERE id = $1 RETURNING id', [id]);
            if (result.rows.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Paciente no encontrado' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Paciente eliminado exitosamente' }));
        } catch (error) {
            console.error('Error al eliminar paciente:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error al eliminar paciente' }));
        }
        return;
    }

    // Ruta: Servir archivos estáticos (opcional, para el frontend)
    if (pathname === '/' || pathname === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Archivo no encontrado');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // Si ninguna ruta coincide
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
}

// Crear el servidor
const server = http.createServer(handleRequest);

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 API de pacientes en http://localhost:${PORT}/api/pacientes`);
});

// Manejar errores del servidor
server.on('error', (error) => {
    console.error('Error del servidor:', error);
});

// Cerrar conexiones al terminar
process.on('SIGINT', () => {
    pool.end();
    server.close();
    console.log('Servidor cerrado');
});