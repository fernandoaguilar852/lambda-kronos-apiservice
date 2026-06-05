import mysql from 'mysql2/promise';
import config from '../config';

// Crear pool de conexiones MySQL
const mysqlPool = mysql.createPool(config.DATABASE[config.NODE_ENVIRONMENT]);

// Manejar conexiones del pool
mysqlPool.on('connection', (_connection) => {
    console.log('Nueva conexión MySQL establecida');
});

export const mysqlClient = mysqlPool;
export default mysqlPool;
