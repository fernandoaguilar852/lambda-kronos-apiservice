import { DefaultValues } from '../utils/Constans';

export default {
    NODE_ENVIRONMENT: process.env.NODE_ENVIRONMENT ?? DefaultValues.NODE_ENV_DEV,
    DATABASE: {
        LOCAL: {
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'kronos-app',
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        },
        DEV: {
            host: process.env.MYSQL_HOST || 'kronos-app.ctiw48myq04p.us-east-1.rds.amazonaws.com',
            user: process.env.MYSQL_USER || 'admin',
            password: process.env.MYSQL_PASSWORD || 'KratosMilo123**',
            database: process.env.MYSQL_DATABASE || 'kronos-app',
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        },
        PROD: {
            host: process.env.MYSQL_HOST || 'kronos-app.ctiw48myq04p.us-east-1.rds.amazonaws.com',
            user: process.env.MYSQL_USER || 'admin',
            password: process.env.MYSQL_PASSWORD || 'KratosMilo123**',
            database: process.env.MYSQL_DATABASE || 'kronos-app',
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        },
        QA: {
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'kronos-app',
            port: 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        }
    }
};
