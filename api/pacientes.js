// api/pacientes.js - Con Supabase REST API
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, Prefer');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Verificar variables de entorno
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return res.status(500).json({
            error: 'Variables de entorno faltantes',
            details: 'Configura SUPABASE_URL y SUPABASE_ANON_KEY en Vercel',
            received: {
                SUPABASE_URL: SUPABASE_URL ? '✅' : '❌',
                SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? '✅' : '❌'
            }
        });
    }

    const { method } = req;
    const urlParts = req.url.split('/');
    const id = urlParts[urlParts.length - 1];

    // Función helper para hacer requests a Supabase
    async function supabaseFetch(url, options = {}) {
        const defaultHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        };

        const response = await fetch(`${SUPABASE_URL}${url}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        return response;
    }

    try {
        // GET - Obtener pacientes
        if (method === 'GET') {
            let url = '/rest/v1/pacientes?select=*&order=id.asc';
            
            // Si hay un ID, obtener un paciente específico
            if (id && !isNaN(id) && id !== 'test') {
                url = `/rest/v1/pacientes?id=eq.${id}&select=*`;
                const response = await supabaseFetch(url);
                const data = await response.json();
                
                if (data.length === 0) {
                    return res.status(404).json({ error: 'Paciente no encontrado' });
                }
                return res.status(200).json(data[0]);
            } else if (id !== 'test') {
                const response = await supabaseFetch(url);
                const data = await response.json();
                return res.status(200).json(data);
            }
        }

        // POST - Crear paciente
        if (method === 'POST') {
            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            if (!nombre || !cedula || !fecha_nac) {
                return res.status(400).json({ error: 'Nombre, Cédula y Fecha de nacimiento son obligatorios' });
            }

            const newPatient = {
                nombre,
                cedula,
                telefono: telefono || null,
                direccion: direccion || null,
                fecha_nac,
                condicion: condicion || 'Consulta general',
                objetivo: objetivo || null,
                testimonio: testimonio || null,
                estado: estado || 'Activo',
                enlace: enlace || null,
                avatar: avatar || null
            };

            const response = await supabaseFetch('/rest/v1/pacientes', {
                method: 'POST',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(newPatient)
            });

            const data = await response.json();
            
            return res.status(201).json({
                id: data[0]?.id || data?.id,
                message: 'Paciente registrado exitosamente'
            });
        }

        // PUT - Actualizar paciente
        if (method === 'PUT') {
            if (!id || isNaN(id)) {
                return res.status(400).json({ error: 'ID inválido' });
            }

            const { nombre, cedula, telefono, direccion, fecha_nac, condicion, objetivo, testimonio, estado, enlace, avatar } = req.body;

            const updateData = {};
            if (nombre !== undefined) updateData.nombre = nombre;
            if (cedula !== undefined) updateData.cedula = cedula;
            if (telefono !== undefined) updateData.telefono = telefono || null;
            if (direccion !== undefined) updateData.direccion = direccion || null;
            if (fecha_nac !== undefined) updateData.fecha_nac = fecha_nac;
            if (condicion !== undefined) updateData.condicion = condicion;
            if (objetivo !== undefined) updateData.objetivo = objetivo || null;
            if (testimonio !== undefined) updateData.testimonio = testimonio || null;
            if (estado !== undefined) updateData.estado = estado;
            if (enlace !== undefined) updateData.enlace = enlace || null;
            if (avatar !== undefined) updateData.avatar = avatar || null;

            const response = await supabaseFetch(`/rest/v1/pacientes?id=eq.${id}`, {
                method: 'PATCH',
                headers: {
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateData)
            });

            const data = await response.json();
            
            if (data.length === 0) {
                return res.status(404).json({ error: 'Paciente no encontrado' });
            }

            return res.status(200).json({ message: 'Paciente actualizado exitosamente' });
        }

        // DELETE - Eliminar paciente
        if (method === 'DELETE') {
            if (!id || isNaN(id)) {
                return res.status(400).json({ error: 'ID inválido' });
            }

            await supabaseFetch(`/rest/v1/pacientes?id=eq.${id}`, {
                method: 'DELETE'
            });

            return res.status(200).json({ message: 'Paciente eliminado exitosamente' });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
            error: 'Error en el servidor',
            details: error.message
        });
    }
};
