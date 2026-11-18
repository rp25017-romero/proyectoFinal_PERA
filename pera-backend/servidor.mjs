import { db } from './db.mjs';
import { crearServidor } from './api.mjs';

const servidor = crearServidor(db);
servidor.listen(3000, () => console.log('API PERA iniciada en el puerto 3000.'));
process.on('SIGTERM', () => servidor.close(() => db.end()));
